-- =============================================================================
-- 064_per_diem.sql — 출장 일비(하루 정액, 식비 포함) (D-124, 사용자 결정 A안)
-- - 회사 설정: per_diem_enabled + per_diem_amount(하루). 관리자만(set_company_per_diem)
-- - 출장 결의서(작성 중·반려)에 '출장 일비' 줄 1개를 자동으로: 금액 = 하루 금액 × 출장 일수(끝 - 시작 + 1, 최대 60일),
--   사비 지급, 증빙 없음(사유: 회사 여비 규정), 계정과목 = 출장비 매핑(여비교통비). 조건이 안 맞으면 줄을 지운다
-- - 직원은 일비 줄을 직접 넣거나 고치거나 지울 수 없다(RLS). 서버 함수만
-- - 일비를 쓰는 회사는 출장 식비(trip meal) 영수증이 있으면 상신 막힘('per_diem_meal')
-- =============================================================================

alter table public.companies
  add column per_diem_enabled boolean not null default false,
  add column per_diem_amount integer not null default 0 check (per_diem_amount between 0 and 1000000);

create or replace function public.set_company_per_diem(p_enabled boolean, p_amount integer)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare v_admin public.members := private.require_admin();
begin
  if p_amount is null or p_amount < 0 or p_amount > 1000000 or (p_enabled and p_amount = 0) then raise exception 'INVALID_PER_DIEM'; end if;
  update public.companies set per_diem_enabled = coalesce(p_enabled, false), per_diem_amount = p_amount where id = v_admin.company_id;
end;
$$;
revoke all on function public.set_company_per_diem(boolean, integer) from public, anon;
grant execute on function public.set_company_per_diem(boolean, integer) to authenticated;

-- 출장비 › 출장 일비 계정과목 매핑(여비교통비) — 모든 회사
do $$
declare c uuid;
begin
  for c in select id from public.companies loop
    perform private.seed_account_defaults(c);
  end loop;
end;
$$;

-- 일비 줄 맞추기
create or replace function private.sync_per_diem(p_claim_id uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  c public.expense_claims;
  co public.companies;
  v_days integer;
  v_amount integer;
  v_purpose text;
  v_item uuid;
begin
  select * into c from public.expense_claims where id = p_claim_id;
  if not found or c.status not in ('draft', 'rejected') then return; end if;
  select * into co from public.companies where id = c.company_id;
  if co.per_diem_enabled and co.per_diem_amount > 0 and c.category = 'trip'
     and c.trip_start_date is not null and c.trip_end_date is not null and c.trip_end_date >= c.trip_start_date then
    v_days := least(c.trip_end_date - c.trip_start_date + 1, 60);
    v_amount := co.per_diem_amount * v_days;
    v_purpose := '출장 일비 하루 ' || to_char(co.per_diem_amount, 'FM999,999,999') || '원 × ' || v_days || '일(식비 포함)';
    select id into v_item from public.expense_items where claim_id = p_claim_id and trip_type = 'per_diem' order by sort_order limit 1;
    if v_item is null then
      insert into public.expense_items (claim_id, company_id, sort_order, category, trip_type, payment_method, evidence_type, evidence_kind, no_evidence_reason,
                                        parse_status, expense_date, merchant_name, amount, purpose, headcount)
      select p_claim_id, c.company_id, coalesce(max(sort_order), 0) + 1, 'trip', 'per_diem', 'personal_card', 'other', 'none', '회사 여비 규정에 따른 출장 일비(영수증 없음)',
             'none', c.trip_start_date, '출장 일비', v_amount, v_purpose, 1
        from public.expense_items where claim_id = p_claim_id;
    else
      update public.expense_items
         set amount = v_amount, purpose = v_purpose, expense_date = c.trip_start_date, payment_method = 'personal_card', corporate_card_id = null,
             evidence_type = 'other', evidence_kind = 'none', no_evidence_reason = '회사 여비 규정에 따른 출장 일비(영수증 없음)', merchant_name = '출장 일비'
       where id = v_item and (amount is distinct from v_amount or purpose is distinct from v_purpose or expense_date is distinct from c.trip_start_date);
      delete from public.expense_items where claim_id = p_claim_id and trip_type = 'per_diem' and id <> v_item;
    end if;
  else
    delete from public.expense_items where claim_id = p_claim_id and trip_type = 'per_diem';
  end if;
end;
$$;
revoke all on function private.sync_per_diem(uuid) from public, anon, authenticated;

create or replace function private.recompute_claim(p_claim_id uuid)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_claim public.expense_claims;
  v_company public.companies;
  v_override integer;
  v_fuel text;
  r record;
  a record;
  v_result jsonb;
begin
  -- 출장 일비 줄을 출장 기간에 맞춘다(작성 중·반려만, D-124)
  perform private.sync_per_diem(p_claim_id);
  select * into v_claim from public.expense_claims where id = p_claim_id;
  select * into v_company from public.companies where id = v_claim.company_id;
  select meal_limit_override, coalesce(fuel_type, 'gasoline') into v_override, v_fuel from public.members where id = v_claim.member_id;
  -- 자차 유류비: 금액은 직원이 넣지 않는다. 상신 때도 이 계산을 거쳐 단가·유가가 스냅샷된다
  --   fixed : 편도 거리 × km당 단가(원 단위 반올림) × 왕복 2
  --   opinet: 올림( 출장 당일 전국 평균 유가 ÷ 12km/L × 총 주행 거리 ) — 유가가 없으면 fixed로 계산
  update public.expense_items i
     set (amount, applied_fuel_rate_per_km, applied_fuel_price, applied_fuel_type, applied_fuel_mode) = (
           select case when i.route_one_way_km is null then null
                       when p.price is not null then ceil(p.price * i.route_one_way_km * (case when i.is_round_trip then 2 else 1 end) / 12.0)::integer
                       else round(i.route_one_way_km * v_company.fuel_rate_per_km)::integer * case when i.is_round_trip then 2 else 1 end end,
                  case when p.price is not null then round(p.price / 12.0)::integer else v_company.fuel_rate_per_km end,
                  p.price,
                  case when p.price is not null then v_fuel end,
                  case when p.price is not null then 'opinet' else 'fixed' end
             from (select case when v_company.fuel_rate_mode = 'opinet'
                               then private.oil_price_on(coalesce(i.expense_date, (now() at time zone 'Asia/Seoul')::date), v_fuel) end as price) p),
         payment_method = 'personal_card',
         corporate_card_id = null
   where i.claim_id = v_claim.id and i.category = 'trip' and i.trip_type = 'own_car';
  for r in select id, category, trip_type, amount, headcount from public.expense_items where claim_id = v_claim.id loop
    select * into a from private.item_amounts(r.category, r.trip_type, r.amount, r.headcount, v_company, v_override);
    update public.expense_items
       set company_supported_amount = a.supported,
           personal_burden_amount = a.burden,
           applied_meal_limit_per_person = a.applied_limit,
           applied_meal_limit_mode = a.applied_mode,
           updated_at = now()
     where id = r.id;
  end loop;
  update public.expense_claims c
     set item_count = s.n,
         total_amount = s.total,
         total_company_supported = s.supported,
         total_personal_burden = s.burden,
         updated_at = now()
    from (
      select count(*)::integer n, coalesce(sum(amount), 0)::integer total,
             coalesce(sum(company_supported_amount), 0)::integer supported, coalesce(sum(personal_burden_amount), 0)::integer burden
      from public.expense_items where claim_id = v_claim.id
    ) s
   where c.id = v_claim.id
  returning jsonb_build_object('item_count', c.item_count, 'total_amount', c.total_amount,
                               'total_company_supported', c.total_company_supported, 'total_personal_burden', c.total_personal_burden)
    into v_result;
  return v_result;
end;
$$;

create or replace function private.claim_problems(p_claim_id uuid)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_claim public.expense_claims;
  v_header text[] := '{}';
  v_count integer;
  v_has_cards boolean;
  v_items jsonb;
  v_by_claim boolean;
  v_custom text[];
  v_per_diem boolean;
begin
  select * into v_claim from public.expense_claims where id = p_claim_id;
  v_by_claim := v_claim.category is not null;
  if length(btrim(coalesce(v_claim.title, ''))) = 0 then v_header := array_append(v_header, 'title'); end if;
  if length(btrim(coalesce(v_claim.description, ''))) = 0 then v_header := array_append(v_header, 'description'); end if;
  -- 결의서 카테고리가 없으면: 영수증 카테고리가 하나로 정해질 때만 상신(섞였거나 비어 있으면 고르게 한다)
  if not v_by_claim and (
       (select count(distinct category) from public.expense_items where claim_id = p_claim_id and category is not null) > 1
       or exists (select 1 from public.expense_items where claim_id = p_claim_id and category is null)) then
    v_header := array_append(v_header, 'category');
  end if;
  if v_claim.category = 'meeting' and length(btrim(coalesce(v_claim.meeting_purpose, ''))) = 0 then v_header := array_append(v_header, 'meeting_purpose'); end if;
  -- 경조사비(D-123): 내부(임직원)/외부(거래처)를 골라야 하고, 외부면 거래처명
  if v_claim.category = 'condolence' then
    if v_claim.condolence_target is null then v_header := array_append(v_header, 'condolence_target');
    elsif v_claim.condolence_target = 'external' and length(btrim(coalesce(v_claim.client_name, ''))) = 0 then v_header := array_append(v_header, 'client_name'); end if;
  end if;
  if v_claim.category = 'purchase' then
    if v_claim.purchase_type is null then v_header := array_append(v_header, 'purchase_type'); end if;
    if length(btrim(coalesce(v_claim.purchase_purpose, ''))) = 0 then v_header := array_append(v_header, 'purchase_purpose'); end if;
  end if;
  -- 회사차량(결의서 또는 회사차량으로 간 출장): 등록된 차량이 있으면 어느 차인지 고른다
  if (v_claim.category = 'company_car' or (v_claim.category = 'trip' and v_claim.trip_transport = 'company_car')) and v_claim.vehicle_id is null
     and exists (select 1 from public.company_vehicles where company_id = v_claim.company_id and is_active) then
    v_header := array_append(v_header, 'vehicle');
  end if;
  if v_claim.is_business_trip then
    if length(btrim(coalesce(v_claim.trip_destination, ''))) = 0 then v_header := array_append(v_header, 'trip_destination'); end if;
    if v_claim.trip_start_date is null or v_claim.trip_end_date is null then v_header := array_append(v_header, 'trip_period');
    elsif v_claim.trip_end_date < v_claim.trip_start_date then v_header := array_append(v_header, 'trip_period_order'); end if;
    if length(btrim(coalesce(v_claim.trip_purpose, ''))) = 0 then v_header := array_append(v_header, 'trip_purpose'); end if;
  end if;
  select count(*) into v_count from public.expense_items where claim_id = p_claim_id;
  if v_count = 0 then v_header := array_append(v_header, 'no_items'); end if;
  if v_count > 30 then v_header := array_append(v_header, 'too_many_items'); end if;
  select exists (select 1 from public.corporate_cards where company_id = v_claim.company_id and is_active) into v_has_cards;
  select per_diem_enabled and per_diem_amount > 0 into v_per_diem from public.companies where id = v_claim.company_id;

  select coalesce(jsonb_agg(jsonb_build_object('item_id', id, 'sort_order', sort_order, 'fields', to_jsonb(f)) order by sort_order), '[]'::jsonb)
    into v_items
    from (
      select i.id, i.sort_order, array_remove(array[
        case when i.parse_status = 'parsing' then 'parsing' end,
        -- 출장 일비에 식비가 들어 있다(D-124 A안): 출장 식비 영수증은 따로 받지 않는다
        case when v_per_diem and i.category = 'trip' and i.trip_type = 'meal' then 'per_diem_meal' end,
        case when i.category is null and v_by_claim then 'category' end, -- 결의서 카테고리가 없으면 위 header에서 묻는다
        -- AI가 본 종류가 결의서와 다르면 직원이 확인하거나 옮겨야 한다(조용히 바꾸지 않음, D-104)
        case when not i.category_mismatch_ack and not (i.category = 'trip' and i.trip_type = 'own_car')
                  and private.category_mismatch(v_claim.category, i.ai_parsed_payload->>'suggested_category') then 'category_mismatch' end,
        case when i.payment_method = 'corporate_card' and v_has_cards and i.corporate_card_id is null then 'corporate_card' end,
        case when i.evidence_type is null then 'evidence_type' end,
        case when i.expense_date is null then 'expense_date' end,
        case when i.amount is null or i.amount <= 0 then 'amount' end,
        -- 증빙 자료: 사진·PDF(영수증 또는 영수증 대신 자료). 없으면 '증빙 없음' + 사유 5자 이상일 때만(D-108). 자차 유류비는 경로 카드가 증빙
        case when i.receipt_path is null and not (i.category = 'trip' and i.trip_type = 'own_car') and i.evidence_kind is distinct from 'none' then 'receipt' end,
        case when i.receipt_path is null and i.evidence_kind = 'none' and length(btrim(coalesce(i.no_evidence_reason, ''))) < 5 then 'no_evidence_reason' end,
        case when (i.category = 'meal' or (i.category = 'trip' and i.trip_type = 'meal')) and coalesce(i.headcount, 1) < 1 then 'headcount' end,
        case when not v_by_claim and i.category = 'meeting' and length(btrim(coalesce(i.purpose, ''))) = 0 then 'purpose' end,
        case when not v_by_claim and i.category = 'purchase' and i.purchase_type is null then 'purchase_type' end,
        case when not v_by_claim and i.category = 'purchase' and length(btrim(coalesce(i.purpose, ''))) = 0 then 'purpose' end,
        case when i.category = 'trip' and i.trip_type is null then 'trip_type' end,
        case when i.category = 'trip' and i.trip_type = 'lodging' and (i.trip_start_date is null or i.trip_end_date is null) then 'lodging_period' end,
        case when i.category = 'trip' and i.trip_type = 'other' and length(btrim(coalesce(i.purpose, ''))) = 0 then 'purpose' end,
        case when i.category = 'trip' and i.trip_type = 'own_car' and (i.start_location is null or i.end_location is null or coalesce(i.distance_km, 0) <= 0) then 'own_car_route' end
      ], null) as f
      from public.expense_items i
      where i.claim_id = p_claim_id
    ) x
   where cardinality(f) > 0;
  -- 회사 추가 항목(D-120): 지금 쓰는 양식에서 관리자가 '직원이 작성 · 필수'로 정한 칸이 비어 있으면 'custom:칸 이름'
  select coalesce(array_agg('custom:' || (f->>'label') order by n), '{}')
    into v_custom
    from public.form_templates t,
         jsonb_array_elements(coalesce(t.schema->'header', '[]'::jsonb) || coalesce(t.schema->'footer', '[]'::jsonb)) with ordinality as x(f, n)
   where t.company_id = v_claim.company_id and t.is_active
     and f->>'key' like 'custom.%' and f->>'mode' = 'input' and coalesce((f->>'required')::boolean, false)
     and coalesce((f->>'pending')::boolean, false) = false
     and length(btrim(coalesce(v_claim.header_custom_payload->>(f->>'key'), ''))) = 0;
  v_header := v_header || v_custom;
  return jsonb_build_object('header', to_jsonb(v_header), 'items', v_items);
end;
$$;
revoke all on function private.claim_problems(uuid) from public, anon, authenticated;

-- 직원은 일비 줄을 직접 넣거나 고치거나 지울 수 없다(서버 함수만)
drop policy items_insert on public.expense_items;
drop policy items_update on public.expense_items;
drop policy items_delete on public.expense_items;
create policy items_insert on public.expense_items for insert to authenticated
  with check (company_id = (select private.current_company_id()) and private.can_edit_claim(claim_id) and trip_type is distinct from 'per_diem');
create policy items_update on public.expense_items for update to authenticated
  using (company_id = (select private.current_company_id()) and private.can_edit_claim(claim_id) and trip_type is distinct from 'per_diem')
  with check (company_id = (select private.current_company_id()) and private.can_edit_claim(claim_id) and trip_type is distinct from 'per_diem');
create policy items_delete on public.expense_items for delete to authenticated
  using (company_id = (select private.current_company_id()) and private.can_edit_claim(claim_id) and closed_month is null and trip_type is distinct from 'per_diem');
