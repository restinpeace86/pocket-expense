-- =============================================================================
-- 052_category_check_vehicles.sql — 3차 개선 (D-103, D-104, D-105)
-- 1) 회사차량 설정(company_vehicles): 법인카드와 같은 권한(같은 회사 열람, 관리자만 쓰기). 결의서는 회사차량 카테고리일 때 차량 1대를 고른다.
-- 2) 카테고리가 안 맞는 영수증은 조용히 바꾸지 않는다: AI가 본 종류(식사류·물품·출장)가 결의서 카테고리와 다르면
--    직원이 [이 결의서가 맞아요](category_mismatch_ack) 또는 [새 결의서로 옮기기](move_item_to_new_claim)를 고르기 전까지 상신을 막는다.
-- 3) 상신 검증: 카테고리를 정할 수 없는 결의서(영수증 카테고리가 섞였거나 비어 있음), 차량 미선택, 확인 안 한 불일치.
-- =============================================================================

-- ── 1. 회사차량 ─────────────────────────────────────────────────────────────
create table public.company_vehicles (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  nickname text not null check (length(btrim(nickname)) between 1 and 30),
  plate_number text not null check (length(btrim(plate_number)) between 2 and 20),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, company_id)
);
create unique index company_vehicles_active_plate on public.company_vehicles (company_id, plate_number) where is_active;
create index company_vehicles_company_idx on public.company_vehicles (company_id);
create trigger set_updated_at before update on public.company_vehicles for each row execute function public.set_updated_at();

alter table public.company_vehicles enable row level security;
alter table public.company_vehicles force row level security;
grant select, insert, update, delete on public.company_vehicles to authenticated;
create policy company_vehicles_select on public.company_vehicles for select to authenticated
  using (company_id = (select private.current_company_id()));
create policy company_vehicles_insert on public.company_vehicles for insert to authenticated
  with check (company_id = (select private.current_company_id()) and (select private.is_admin()));
create policy company_vehicles_update on public.company_vehicles for update to authenticated
  using (company_id = (select private.current_company_id()) and (select private.is_admin()))
  with check (company_id = (select private.current_company_id()) and (select private.is_admin()));
create policy company_vehicles_delete on public.company_vehicles for delete to authenticated
  using (company_id = (select private.current_company_id()) and (select private.is_admin()));

-- 결의서의 차량: 같은 회사 차량만(복합 FK). 직원은 set_claim_category()로만 바꾼다(컬럼 권한 없음)
alter table public.expense_claims add column vehicle_id uuid;
alter table public.expense_claims
  add constraint expense_claims_vehicle_fk foreign key (vehicle_id, company_id) references public.company_vehicles (id, company_id) on delete set null (vehicle_id);
create index expense_claims_vehicle_idx on public.expense_claims (vehicle_id) where vehicle_id is not null;

-- ── 2. 카테고리 확인 ────────────────────────────────────────────────────────
alter table public.expense_items add column category_mismatch_ack boolean not null default false;
comment on column public.expense_items.category_mismatch_ack is 'AI가 본 종류가 결의서 카테고리와 달라도 직원이 "이 결의서가 맞아요"를 고름(D-104). 결의서 카테고리가 바뀌면 다시 false';

-- 종류 묶음: 식사류(식대·미팅·회식) / 물품 / 출장. AI는 4대 카테고리만 추천하므로 그 밖의 카테고리는 비교하지 않는다
create or replace function private.category_group(p text)
returns text
language sql immutable
set search_path = ''
as $$
  select case when p in ('meal', 'meeting', 'team_dinner') then 'food' when p = 'purchase' then 'goods' when p = 'trip' then 'trip' end;
$$;

-- 결의서 카테고리와 AI가 본 종류가 다른가(출장 결의서는 모두 출장비라 비교하지 않음)
create or replace function private.category_mismatch(p_claim public.expense_category, p_ai text)
returns boolean
language sql immutable
set search_path = ''
as $$
  select coalesce(p_claim is not null and p_claim <> 'trip'
         and private.category_group(p_claim::text) is not null
         and private.category_group(p_ai) is not null
         and private.category_group(p_ai) <> private.category_group(p_claim::text), false);
$$;
revoke all on function private.category_group(text), private.category_mismatch(public.expense_category, text) from public, anon, authenticated;

create or replace function public.ack_item_category(p_item_id uuid, p_ack boolean default true)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare v_item public.expense_items;
begin
  select * into v_item from public.expense_items where id = p_item_id;
  if not found then raise exception 'NOT_FOUND' using errcode = '42501'; end if;
  perform private.lock_my_editable_claim(v_item.claim_id);
  update public.expense_items set category_mismatch_ack = coalesce(p_ack, true) where id = p_item_id;
end;
$$;
revoke all on function public.ack_item_category(uuid, boolean) from public, anon;
grant execute on function public.ack_item_category(uuid, boolean) to authenticated;

-- 영수증 하나를 AI가 본 종류의 새 결의서(작성 중)로 옮긴다. 사진 파일 경로 이동은 서버가 이어서 한다(경로에 결의서 id가 들어 있음)
create or replace function public.move_item_to_new_claim(p_item_id uuid)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_item public.expense_items;
  v_old public.expense_claims;
  v_cat public.expense_category;
  v_new uuid;
begin
  select * into v_item from public.expense_items where id = p_item_id;
  if not found then raise exception 'NOT_FOUND' using errcode = '42501'; end if;
  v_old := private.lock_my_editable_claim(v_item.claim_id);
  if v_item.category = 'trip' and v_item.trip_type = 'own_car' then raise exception 'NOT_ALLOWED'; end if;
  v_cat := case when v_item.ai_parsed_payload->>'suggested_category' in ('meal', 'meeting', 'purchase', 'trip')
                then (v_item.ai_parsed_payload->>'suggested_category')::public.expense_category end;
  if v_cat is null then raise exception 'NO_SUGGESTED_CATEGORY'; end if;

  insert into public.expense_claims (company_id, member_id, title, default_payment_method, category, is_business_trip, purchase_type)
  values (v_old.company_id, v_old.member_id, '', v_old.default_payment_method, v_cat, v_cat = 'trip',
          case when v_cat = 'purchase' and v_item.ai_parsed_payload->>'suggested_purchase_type' in ('pantry', 'office_supplies', 'small_equipment')
               then (v_item.ai_parsed_payload->>'suggested_purchase_type')::public.purchase_type end)
  returning id into v_new;

  update public.expense_items
     set claim_id = v_new, sort_order = 1, category_mismatch_ack = false,
         trip_type = case when v_cat = 'trip' then trip_type end
   where id = p_item_id;
  update public.receipt_usage_records set claim_id = v_new, claim_title = '', claim_status = 'draft' where item_id = p_item_id;
  perform private.recompute_claim(v_old.id);
  perform private.recompute_claim(v_new);
  return jsonb_build_object('claim_id', v_new, 'category', v_cat, 'receipt_path', v_item.receipt_path, 'thumb_path', v_item.receipt_thumb_path);
end;
$$;
revoke all on function public.move_item_to_new_claim(uuid) from public, anon;
grant execute on function public.move_item_to_new_claim(uuid) to authenticated;

-- ── 3. 결의서 카테고리 저장(048 정의 + 차량 + 카테고리가 바뀌면 확인 다시) ─────────────
drop function public.set_claim_category(uuid, public.expense_category, public.purchase_type, text, text, text, text, text, integer);
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
  p_vehicle_id uuid default null
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
  -- 차량: 회사차량 결의서만, 같은 회사의 사용 중인 차량만(이미 골라 둔 차량이 사용 중지돼도 그대로 둔다)
  if p_category = 'company_car' and p_vehicle_id is not null then
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
revoke all on function public.set_claim_category(uuid, public.expense_category, public.purchase_type, text, text, text, text, text, integer, uuid) from public, anon;
grant execute on function public.set_claim_category(uuid, public.expense_category, public.purchase_type, text, text, text, text, text, integer, uuid) to authenticated;

-- ── 4. 상신 검증 (048 정의 + 카테고리 확정·차량·불일치 확인) ─────────────────────
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
  -- 회사차량: 등록된 차량이 있으면 어느 차인지 고른다
  if v_claim.category = 'company_car' and v_claim.vehicle_id is null
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
