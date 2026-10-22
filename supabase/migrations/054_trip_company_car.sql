-- =============================================================================
-- 054_trip_company_car.sql — 회사차량으로 간 출장 + 교육훈련비 (D-106, D-107)
-- 1) 출장 이동 수단 [회사차량]: 차량을 고르고, 그 출장의 주유·통행료·주차 영수증은 회사차량 주유/통행료·주차(차량유지비).
--    숙박·식사·대중교통 등은 그대로 여비교통비(한 출장 결의서 안에서 계정과목이 나뉘는 유일한 예외).
-- 2) 세미나·컨퍼런스 참가, 교육·훈련 → 교육훈련비(D-102의 도서인쇄비에서 변경, 업무용 도서는 도서인쇄비 그대로).
--    기존 회사는 그 매핑이 아직 기본값(도서인쇄비)일 때만 바꾼다(관리자가 바꾼 매핑은 그대로).
-- =============================================================================

-- ── 기본 계정과목·매핑 (051 정의 + 교육훈련비 + 회사차량 출장 유형) ──
create or replace function private.seed_account_defaults(p_company_id uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_welfare uuid; v_travel uuid; v_entertain uuid; v_supplies uuid; v_print uuid; v_vehicle uuid; v_fees uuid; v_edu uuid;
  v_next integer;
  t public.trip_type;
  p public.purchase_type;
begin
  select coalesce(max(sort_order), 0) into v_next from public.account_titles where company_id = p_company_id;

  insert into public.account_titles (company_id, name, sort_order) values (p_company_id, '복리후생비', 1) on conflict (company_id, name) do nothing;
  insert into public.account_titles (company_id, name, sort_order) values (p_company_id, '여비교통비', 2) on conflict (company_id, name) do nothing;
  insert into public.account_titles (company_id, name, sort_order) values (p_company_id, '기업업무추진비', 3) on conflict (company_id, name) do nothing;
  insert into public.account_titles (company_id, name, sort_order) values (p_company_id, '소모품비', greatest(4, v_next + 1)) on conflict (company_id, name) do nothing;
  select coalesce(max(sort_order), 0) into v_next from public.account_titles where company_id = p_company_id;
  insert into public.account_titles (company_id, name, sort_order) values (p_company_id, '도서인쇄비', v_next + 1) on conflict (company_id, name) do nothing;
  select coalesce(max(sort_order), 0) into v_next from public.account_titles where company_id = p_company_id;
  insert into public.account_titles (company_id, name, sort_order) values (p_company_id, '차량유지비', v_next + 1) on conflict (company_id, name) do nothing;
  select coalesce(max(sort_order), 0) into v_next from public.account_titles where company_id = p_company_id;
  insert into public.account_titles (company_id, name, sort_order) values (p_company_id, '지급수수료', v_next + 1) on conflict (company_id, name) do nothing;
  select coalesce(max(sort_order), 0) into v_next from public.account_titles where company_id = p_company_id;
  insert into public.account_titles (company_id, name, sort_order) values (p_company_id, '교육훈련비', v_next + 1) on conflict (company_id, name) do nothing;

  select id into v_welfare from public.account_titles where company_id = p_company_id and name = '복리후생비';
  select id into v_travel from public.account_titles where company_id = p_company_id and name = '여비교통비';
  select id into v_entertain from public.account_titles where company_id = p_company_id and name = '기업업무추진비';
  select id into v_supplies from public.account_titles where company_id = p_company_id and name = '소모품비';
  select id into v_print from public.account_titles where company_id = p_company_id and name = '도서인쇄비';
  select id into v_vehicle from public.account_titles where company_id = p_company_id and name = '차량유지비';
  select id into v_fees from public.account_titles where company_id = p_company_id and name = '지급수수료';
  select id into v_edu from public.account_titles where company_id = p_company_id and name = '교육훈련비';

  insert into public.account_title_mappings (company_id, category, account_title_id) values
    (p_company_id, 'meal', v_welfare),
    (p_company_id, 'meeting', v_entertain),
    (p_company_id, 'team_dinner', v_welfare),
    (p_company_id, 'condolence', v_entertain),
    (p_company_id, 'seminar', v_edu),
    (p_company_id, 'books', v_print),
    (p_company_id, 'training', v_edu),
    (p_company_id, 'company_car', v_vehicle),
    (p_company_id, 'saas', v_fees)
    on conflict on constraint account_title_mappings_unique_classification do nothing;
  foreach t in array enum_range(null::public.trip_type) loop
    insert into public.account_title_mappings (company_id, category, trip_type, account_title_id)
    values (p_company_id, 'trip', t, case when t in ('car_fuel', 'car_toll') then v_vehicle else v_travel end)
      on conflict on constraint account_title_mappings_unique_classification do nothing;
  end loop;
  foreach p in array enum_range(null::public.purchase_type) loop
    insert into public.account_title_mappings (company_id, category, purchase_type, account_title_id)
    values (p_company_id, 'purchase', p, case when p = 'pantry' then v_welfare else v_supplies end)
      on conflict on constraint account_title_mappings_unique_classification do nothing;
  end loop;
end;
$$;
revoke all on function private.seed_account_defaults(uuid) from public, anon, authenticated;

do $$
declare c uuid;
begin
  for c in select id from public.companies loop
    perform private.seed_account_defaults(c);
    update public.account_title_mappings m
       set account_title_id = (select id from public.account_titles where company_id = c and name = '교육훈련비')
     where m.company_id = c and m.category in ('seminar', 'training')
       and m.account_title_id = (select id from public.account_titles where company_id = c and name = '도서인쇄비');
  end loop;
end;
$$;

-- ── 영수증이 결의서를 따름 (048 정의 + 회사차량 출장 유형) ──
create or replace function private.item_follow_claim_category()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare c public.expense_claims;
begin
  select * into c from public.expense_claims where id = new.claim_id;
  if c.category is null then return new; end if;
  if new.category = 'trip' and new.trip_type = 'own_car' then return new; end if;
  new.category := c.category;
  if c.category <> 'trip' then new.trip_type := null; end if;
  -- 회사차량으로 간 출장(D-106): 톨비·주차는 회사차량 통행료·주차, AI가 주유로 본 영수증은 회사차량 주유(차량유지비).
  -- 다른 이동 수단으로 바꾸면 되돌린다
  if c.category = 'trip' then
    if c.trip_transport = 'company_car' then
      if new.trip_type = 'toll_parking' then new.trip_type := 'car_toll'; end if;
      if new.trip_type is null and new.ai_parsed_payload->>'suggested_trip_type' = 'car_fuel' then new.trip_type := 'car_fuel'; end if;
    else
      if new.trip_type = 'car_toll' then new.trip_type := 'toll_parking'; end if;
      if new.trip_type = 'car_fuel' then new.trip_type := 'other'; end if;
    end if;
  end if;
  if c.category = 'purchase' then
    new.purchase_type := c.purchase_type;
    new.purpose := nullif(concat_ws(' · ', nullif(btrim(coalesce(c.purchase_purpose, '')), ''), nullif(btrim(coalesce(c.purchase_items, '')), '')), '');
  else
    new.purchase_type := null;
  end if;
  if c.category = 'meeting' then
    new.purpose := nullif(btrim(coalesce(c.meeting_purpose, '')), '');
    new.client_name := nullif(btrim(coalesce(c.client_name, '')), '');
    new.attendees := nullif(btrim(coalesce(c.attendees, '')), '');
  else
    new.client_name := null;
    new.attendees := null;
  end if;
  return new;
end;
$$;
revoke all on function private.item_follow_claim_category() from public, anon, authenticated;

-- 회사차량이 아니게 되면 차량을 비운다
create or replace function private.claim_vehicle_consistency()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if new.vehicle_id is not null and not (new.category = 'company_car' or (new.category = 'trip' and new.trip_transport = 'company_car')) then
    new.vehicle_id := null;
  end if;
  return new;
end;
$$;
revoke all on function private.claim_vehicle_consistency() from public, anon, authenticated;
create trigger expense_claims_vehicle_consistency before update on public.expense_claims
  for each row execute function private.claim_vehicle_consistency();

-- 이동 수단이 바뀌면(함수·헤더 저장 어느 쪽이든) 출장 영수증 유형을 다시 맞춘다
create or replace function private.claim_transport_items()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if new.trip_transport is distinct from old.trip_transport then
    update public.expense_items set trip_type = trip_type
     where claim_id = new.id and category = 'trip' and trip_type is distinct from 'own_car';
  end if;
  return null;
end;
$$;
revoke all on function private.claim_transport_items() from public, anon, authenticated;
create trigger expense_claims_transport_items after update of trip_transport on public.expense_claims
  for each row execute function private.claim_transport_items();

-- ── 결의서 카테고리 저장 (052 정의 + 출장 이동 수단·회사차량 출장 차량) ──
drop function public.set_claim_category(uuid, public.expense_category, public.purchase_type, text, text, text, text, text, integer, uuid);
create or replace function public.set_claim_category(
  p_claim_id uuid,
  p_category public.expense_category,
  p_purchase_type public.purchase_type default null,
  p_meeting_purpose text default null,
  p_client_name text default null,
  p_attendees text default null,
  p_purchase_purpose text default null,
  p_purchase_items text default null,
  p_headcount integer default null,
  p_vehicle_id uuid default null,
  p_trip_transport public.trip_transport default null
)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_claim public.expense_claims := private.lock_my_editable_claim(p_claim_id);
  t text[] := array[btrim(coalesce(p_meeting_purpose, '')), btrim(coalesce(p_client_name, '')), btrim(coalesce(p_attendees, '')), btrim(coalesce(p_purchase_purpose, '')), btrim(coalesce(p_purchase_items, ''))];
  v_vehicle uuid;
begin
  if p_category is null then raise exception 'INVALID_CATEGORY'; end if;
  if char_length(t[1]) > 200 or char_length(t[2]) > 100 or char_length(t[3]) > 200 or char_length(t[4]) > 200 or char_length(t[5]) > 200 then
    raise exception 'INVALID_ITEM_TEXT';
  end if;
  if p_headcount is not null and (p_headcount < 1 or p_headcount > 99) then raise exception 'INVALID_HEADCOUNT'; end if;
  if p_category <> 'trip' and exists (select 1 from public.expense_items where claim_id = p_claim_id and category = 'trip' and trip_type = 'own_car') then
    raise exception 'OWN_CAR_ITEMS_EXIST';
  end if;
  -- 차량: 회사차량 결의서 또는 회사차량으로 간 출장만(D-106), 같은 회사의 사용 중인 차량만(이미 골라 둔 차량이 사용 중지돼도 그대로 둔다)
  if (p_category = 'company_car' or (p_category = 'trip' and p_trip_transport = 'company_car')) and p_vehicle_id is not null then
    select id into v_vehicle from public.company_vehicles
     where id = p_vehicle_id and company_id = v_claim.company_id and (is_active or id = v_claim.vehicle_id);
    if v_vehicle is null then raise exception 'INVALID_VEHICLE'; end if;
  end if;

  update public.expense_claims
     set category = p_category,
         is_business_trip = (p_category = 'trip'),
         purchase_type = p_purchase_type,
         meeting_purpose = nullif(t[1], ''),
         client_name = nullif(t[2], ''),
         attendees = nullif(t[3], ''),
         purchase_purpose = nullif(t[4], ''),
         purchase_items = nullif(t[5], ''),
         headcount = p_headcount,
         trip_transport = case when p_category = 'trip' then p_trip_transport end,
         vehicle_id = v_vehicle
   where id = p_claim_id;

  update public.expense_items
     set category = p_category,
         -- 카테고리를 바꾸면 "이 결의서가 맞아요" 확인을 다시 받는다
         category_mismatch_ack = case when v_claim.category is distinct from p_category then false else category_mismatch_ack end
   where claim_id = p_claim_id and not (category is not distinct from 'trip' and trip_type is not distinct from 'own_car');
  if p_headcount is not null and p_headcount is distinct from v_claim.headcount and p_category in ('meal', 'meeting') then
    update public.expense_items set headcount = p_headcount where claim_id = p_claim_id;
  end if;
  return private.recompute_claim(p_claim_id);
end;
$$;
revoke all on function public.set_claim_category(uuid, public.expense_category, public.purchase_type, text, text, text, text, text, integer, uuid, public.trip_transport) from public, anon;
grant execute on function public.set_claim_category(uuid, public.expense_category, public.purchase_type, text, text, text, text, text, integer, uuid, public.trip_transport) to authenticated;

-- ── 상신 검증 (052 정의 + 회사차량 출장도 차량 필수) ──
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
        case when i.receipt_path is null and not (i.category = 'trip' and i.trip_type = 'own_car') then 'receipt' end,
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
