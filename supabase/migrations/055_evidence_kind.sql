-- =============================================================================
-- 055_evidence_kind.sql — 영수증 대신 증빙 공통 틀 (D-108)
-- 증빙 자료는 영수증만이 아니다: 인보이스·결제 메일, 앱 이용 내역, 카드 결제 내역, 청첩장·부고 안내(문자·모바일 초대장), 기타 자료.
-- 모든 경비에는 자료(사진·PDF)가 있어야 하고, 정말 없을 때만 '증빙 없음' + 사유(5자 이상) — 결재 화면·세무 자료에 그대로 표시.
-- - expense_items.evidence_kind(자료 종류), no_evidence_reason(증빙 없음 사유). 예전 항목은 비어 있음 = 사진이 있으면 영수증으로 본다.
-- - 영수증 없이 추가한 항목에 나중에 자료 붙이기: attach_item_evidence()가 저장 경로를 정하고 직원이 그 경로에 올린다(AI 인식·크레딧 없음).
-- =============================================================================

create type public.evidence_kind as enum ('receipt', 'invoice', 'app_history', 'card_history', 'invitation', 'other', 'none');
alter table public.expense_items
  add column evidence_kind public.evidence_kind,
  add column no_evidence_reason text check (char_length(no_evidence_reason) <= 300);
grant update (evidence_kind, no_evidence_reason) on public.expense_items to authenticated;
comment on column public.expense_items.evidence_kind is '증빙 자료 종류(D-108). 비어 있고 사진이 있으면 영수증. none = 증빙 없음(no_evidence_reason 필수)';

-- 자료 종류 기본값·정리: 사진이 있으면 AI가 본 종류 → 없으면 영수증 / 사진이 있는데 증빙 없음이면 기타 자료 / 증빙 없음이면 증빙 구분은 기타
create or replace function private.item_evidence_defaults()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if new.receipt_path is not null then
    if new.evidence_kind is null then
      new.evidence_kind := case when new.ai_parsed_payload->>'suggested_evidence_kind' in ('receipt', 'invoice', 'app_history', 'card_history', 'invitation', 'other')
                                then (new.ai_parsed_payload->>'suggested_evidence_kind')::public.evidence_kind else 'receipt' end;
    elsif new.evidence_kind = 'none' then
      new.evidence_kind := 'other';
    end if;
  end if;
  if new.evidence_kind = 'none' then
    new.evidence_type := coalesce(new.evidence_type, 'other');
  else
    new.no_evidence_reason := null;
  end if;
  return new;
end;
$$;
revoke all on function private.item_evidence_defaults() from public, anon, authenticated;
create trigger expense_items_evidence_defaults before insert or update on public.expense_items
  for each row execute function private.item_evidence_defaults();

-- 영수증 없이 추가한 항목에 자료 붙이기: 경로를 정해 주고(결의서 폴더) 직원이 그 경로에 올린다. 실패하면 detach로 되돌린다
create or replace function public.attach_item_evidence(p_item_id uuid, p_is_pdf boolean default false, p_thumb_ext text default 'webp')
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_item public.expense_items;
  v_claim public.expense_claims;
  v_dir text;
  v_path text;
  v_thumb text;
begin
  select * into v_item from public.expense_items where id = p_item_id;
  if not found then raise exception 'NOT_FOUND' using errcode = '42501'; end if;
  v_claim := private.lock_my_editable_claim(v_item.claim_id);
  if v_item.receipt_path is not null then raise exception 'ALREADY_HAS_EVIDENCE'; end if;
  if v_item.category = 'trip' and v_item.trip_type = 'own_car' then raise exception 'NOT_ALLOWED'; end if;
  if p_thumb_ext not in ('webp', 'jpg') then raise exception 'INVALID_FILE'; end if;
  v_dir := v_claim.company_id || '/' || v_claim.member_id || '/' || v_claim.id;
  v_path := v_dir || '/' || v_item.id || '_doc' || case when p_is_pdf then '.pdf' else '.jpg' end;
  v_thumb := case when p_is_pdf then null else v_dir || '/' || v_item.id || '_doc_thumb.' || p_thumb_ext end;
  update public.expense_items
     set receipt_path = v_path, receipt_thumb_path = v_thumb,
         evidence_kind = case when evidence_kind is null or evidence_kind = 'none' then 'other' else evidence_kind end
   where id = p_item_id;
  return jsonb_build_object('receipt_path', v_path, 'thumb_path', v_thumb);
end;
$$;
revoke all on function public.attach_item_evidence(uuid, boolean, text) from public, anon;
grant execute on function public.attach_item_evidence(uuid, boolean, text) to authenticated;

-- 붙인 자료 떼기: 직원이 붙인 자료만(AI로 읽은 영수증은 크레딧·보관 규칙이 있어 영수증 삭제로만)
create or replace function public.detach_item_evidence(p_item_id uuid)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare v_item public.expense_items;
begin
  select * into v_item from public.expense_items where id = p_item_id;
  if not found then raise exception 'NOT_FOUND' using errcode = '42501'; end if;
  perform private.lock_my_editable_claim(v_item.claim_id);
  if v_item.parse_status <> 'none' or v_item.receipt_path is null then raise exception 'NOT_ALLOWED'; end if;
  update public.expense_items set receipt_path = null, receipt_thumb_path = null where id = p_item_id;
  return jsonb_build_object('receipt_path', v_item.receipt_path, 'thumb_path', v_item.receipt_thumb_path);
end;
$$;
revoke all on function public.detach_item_evidence(uuid) from public, anon;
grant execute on function public.detach_item_evidence(uuid) to authenticated;

-- ── 상신 검증 (054 정의 + 영수증 대신 증빙·증빙 없음 사유) ──
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

  select coalesce(jsonb_agg(jsonb_build_object('item_id', id, 'sort_order', sort_order, 'fields', to_jsonb(f)) order by sort_order), '[]'::jsonb)
    into v_items
    from (
      select i.id, i.sort_order, array_remove(array[
        case when i.parse_status = 'parsing' then 'parsing' end,
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
  return jsonb_build_object('header', to_jsonb(v_header), 'items', v_items);
end;
$$;
revoke all on function private.claim_problems(uuid) from public, anon, authenticated;

-- ── 세무 자료 (044 정의 + 자료 종류·증빙 없음 사유) ──
create or replace function public.tax_month_export(p_month text)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_admin public.members := private.require_admin();
  v_closing public.monthly_closings;
  v_rows jsonb;
  v_excluded jsonb;
begin
  if p_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then raise exception 'INVALID_MONTH'; end if;
  select * into v_closing from public.monthly_closings where company_id = v_admin.company_id and year_month = p_month;

  with target as (
    select t.item_id, t.kind, t.seq from public.tax_month_items(p_month) t
  ), appr as (
    -- 결의서 마지막 회차의 승인 단계: "김팀장(10/12) → 이대표(10/13)"
    select a.claim_id,
           string_agg(coalesce(m.name, '?') || '(' || to_char(a.acted_at at time zone 'Asia/Seoul', 'FMMM/FMDD') || ')', ' → ' order by a.step_order) as approvers
      from public.claim_approvals a
      join public.expense_claims c on c.id = a.claim_id and a.round = c.current_round
      left join public.members m on m.id = a.acted_by_member_id
     where a.company_id = v_admin.company_id and a.status = 'approved'
     group by a.claim_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'seq', t.seq, 'kind', t.kind,
           'claim_id', c.id, 'claim_title', c.title, 'claim_description', c.description, 'exception_memo', c.exception_memo,
           'is_trip', c.is_business_trip, 'trip_destination', c.trip_destination, 'trip_start', c.trip_start_date, 'trip_end', c.trip_end_date, 'trip_purpose', c.trip_purpose,
           'claim_status', c.status, 'self_approved', c.self_approved, 'submitted_at', c.submitted_at, 'approved_at', c.approved_at, 'paid_at', c.paid_at,
           'approvers', ap.approvers, 'header_custom', c.header_custom_payload) || jsonb_build_object(
           'item_id', i.id, 'expense_date', i.expense_date, 'merchant_name', i.merchant_name, 'merchant_business_number', i.merchant_business_number,
           'evidence_type', i.evidence_type, 'supply_amount', i.supply_amount, 'vat_amount', i.vat_amount, 'amount', i.amount,
           'payment_method', i.payment_method, 'card_nickname', cc.nickname, 'card_last4', coalesce(cc.last4, i.card_last4),
           'account_title_name', i.account_title_name, 'account_title_code', i.account_title_code,
           'category', i.category, 'trip_type', i.trip_type, 'purchase_type', i.purchase_type,
           'department', d.name, 'member_name', m.name, 'position', m.position, 'employee_number', m.employee_number, 'vehicle_number', m.vehicle_number,
           'purpose', i.purpose, 'headcount', i.headcount, 'attendees', i.attendees, 'client_name', i.client_name,
           'lodging_in', i.trip_start_date, 'lodging_out', i.trip_end_date,
           'start_location', i.start_location, 'end_location', i.end_location, 'is_round_trip', i.is_round_trip,
           'route_one_way_km', i.route_one_way_km, 'distance_km', i.distance_km, 'distance_source', i.distance_source,
           'applied_meal_limit_per_person', i.applied_meal_limit_per_person, 'applied_fuel_rate_per_km', i.applied_fuel_rate_per_km,
           'company_supported_amount', i.company_supported_amount, 'personal_burden_amount', i.personal_burden_amount,
           'receipt_path', i.receipt_path, 'route_card_path', i.route_card_path) || jsonb_build_object('item_custom', i.item_custom_payload,
           'evidence_kind', coalesce(i.evidence_kind::text, case when i.receipt_path is not null then 'receipt' end), 'no_evidence_reason', i.no_evidence_reason
         ) order by t.seq), '[]'::jsonb)
    into v_rows
    from target t
    join public.expense_items i on i.id = t.item_id
    join public.expense_claims c on c.id = i.claim_id
    join public.members m on m.id = c.member_id
    left join public.departments d on d.id = m.department_id
    left join public.corporate_cards cc on cc.id = i.corporate_card_id
    left join appr ap on ap.claim_id = c.id;

  select jsonb_build_object(
           'draft', count(*) filter (where c.status = 'draft'),
           'submitted', count(*) filter (where c.status = 'submitted'),
           'rejected', count(*) filter (where c.status = 'rejected'),
           'claims', count(distinct c.id))
    into v_excluded
    from public.expense_items i
    join public.expense_claims c on c.id = i.claim_id
   where i.company_id = v_admin.company_id and c.status in ('draft', 'submitted', 'rejected')
     and to_char(i.expense_date, 'YYYY-MM') = p_month;

  return jsonb_build_object(
    'month', p_month,
    'status', case when v_closing.status = 'closed' then 'closed' else 'pending' end,
    'closed_at', v_closing.closed_at,
    'reopened_at', v_closing.reopened_at,
    'reopen_reason', v_closing.reopen_reason,
    'rows', v_rows,
    'excluded', v_excluded);
end;
$$;

revoke all on function public.tax_month_export(text) from public, anon;
grant execute on function public.tax_month_export(text) to authenticated;
