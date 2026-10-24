-- =============================================================================
-- 062_condolence_target.sql — 경조사비 내부(임직원) / 외부(거래처) 구분 (D-123)
-- - 결의서에서 고르면 영수증이 따라간다(카테고리와 같은 방식). 계정과목: 내부 → 복리후생비, 외부 → 기업업무추진비
-- - 계정과목 매핑에 condolence_target을 더한다(경조사비만). 기존 경조사비 매핑·결의서·영수증은 외부(지금까지의 계정과목)로
-- - 함수 재정의: seed_account_defaults·item_follow_claim_category·set_claim_category(054), submit_claim(033),
--   override_item_account_title(035), claim_problems(061) — 원래 정의 + 경조사비 대상
-- =============================================================================

alter table public.expense_claims add column condolence_target text check (condolence_target in ('internal', 'external'));
alter table public.expense_items add column condolence_target text check (condolence_target in ('internal', 'external'));
alter table public.account_title_mappings add column condolence_target text check (condolence_target in ('internal', 'external'));
grant update (condolence_target) on public.expense_claims to authenticated;

-- 기존 데이터: 경조사비는 지금까지 기업업무추진비였으므로 외부로
update public.account_title_mappings set condolence_target = 'external' where category = 'condolence';
update public.expense_claims set condolence_target = 'external' where category = 'condolence';
update public.expense_items set condolence_target = 'external' where category = 'condolence';

alter table public.account_title_mappings drop constraint account_title_mappings_unique_classification;
alter table public.account_title_mappings
  add constraint account_title_mappings_unique_classification unique nulls not distinct (company_id, category, trip_type, purchase_type, condolence_target);
alter table public.account_title_mappings
  add constraint account_title_mappings_condolence_target_only check ((category = 'condolence') = (condolence_target is not null));

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
    (p_company_id, 'seminar', v_edu),
    (p_company_id, 'books', v_print),
    (p_company_id, 'training', v_edu),
    (p_company_id, 'company_car', v_vehicle),
    (p_company_id, 'saas', v_fees)
    on conflict on constraint account_title_mappings_unique_classification do nothing;
  -- 경조사비(D-123): 내부(임직원) → 복리후생비, 외부(거래처) → 기업업무추진비
  insert into public.account_title_mappings (company_id, category, condolence_target, account_title_id) values
    (p_company_id, 'condolence', 'internal', v_welfare),
    (p_company_id, 'condolence', 'external', v_entertain)
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

-- 모든 회사에 내부(임직원) → 복리후생비 매핑 추가
do $$
declare c uuid;
begin
  for c in select id from public.companies loop
    perform private.seed_account_defaults(c);
  end loop;
end;
$$;

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
  new.condolence_target := case when c.category = 'condolence' then c.condolence_target end; -- 경조사비 대상(D-123)
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

drop function public.set_claim_category(uuid, public.expense_category, public.purchase_type, text, text, text, text, text, integer, uuid, public.trip_transport);
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
  p_trip_transport public.trip_transport default null,
  p_condolence_target text default null -- 경조사비 대상: internal(임직원) / external(거래처) (D-123)
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
  if p_condolence_target is not null and p_condolence_target not in ('internal', 'external') then raise exception 'INVALID_CONDOLENCE_TARGET'; end if;
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
         vehicle_id = v_vehicle,
         condolence_target = case when p_category = 'condolence' then p_condolence_target end
   where id = p_claim_id;

  update public.expense_items
     set category = p_category,
         condolence_target = case when p_category = 'condolence' then p_condolence_target end,
         -- 카테고리를 바꾸면 "이 결의서가 맞아요" 확인을 다시 받는다
         category_mismatch_ack = case when v_claim.category is distinct from p_category then false else category_mismatch_ack end
   where claim_id = p_claim_id and not (category is not distinct from 'trip' and trip_type is not distinct from 'own_car');
  if p_headcount is not null and p_headcount is distinct from v_claim.headcount and p_category in ('meal', 'meeting') then
    update public.expense_items set headcount = p_headcount where claim_id = p_claim_id;
  end if;
  return private.recompute_claim(p_claim_id);
end;
$$;
revoke all on function public.set_claim_category(uuid, public.expense_category, public.purchase_type, text, text, text, text, text, integer, uuid, public.trip_transport, text) from public, anon;
grant execute on function public.set_claim_category(uuid, public.expense_category, public.purchase_type, text, text, text, text, text, integer, uuid, public.trip_transport, text) to authenticated;

create or replace function public.submit_claim(p_claim_id uuid)
returns public.claim_status
language plpgsql security definer
set search_path = ''
as $$
declare
  v_member public.members;
  v_claim public.expense_claims;
  v_line_id uuid;
  v_round integer;
  v_step record;
  v_order integer := 0;
  v_own_order integer;
  v_payout integer;
  v_payback integer;
  v_problems jsonb;
begin
  v_member := private.require_member();

  select * into v_claim from public.expense_claims where id = p_claim_id for update;
  if not found or v_claim.company_id <> v_member.company_id or v_claim.member_id <> v_member.id then
    raise exception 'NOT_FOUND' using errcode = '42501';
  end if;
  if v_claim.status not in ('draft', 'rejected') then
    raise exception 'INVALID_STATUS';
  end if;

  v_problems := private.claim_problems(p_claim_id);
  if jsonb_array_length(v_problems->'header') > 0 or jsonb_array_length(v_problems->'items') > 0 then
    raise exception 'CLAIM_INCOMPLETE' using detail = v_problems::text;
  end if;

  -- 금액을 서버에서 다시 계산해 확정 (§5)
  perform private.recompute_claim(p_claim_id);

  -- 계정과목 스냅샷 (§7): 관리자가 바꾼 항목은 그대로, 매핑이 없으면 비움
  update public.expense_items i
     set (account_title_id, account_title_name, account_title_code) = (
       select t.id, t.name, t.code
         from public.account_title_mappings m
         join public.account_titles t on t.id = m.account_title_id and t.company_id = m.company_id
        where m.company_id = i.company_id and m.category = i.category
          and m.trip_type is not distinct from i.trip_type and m.purchase_type is not distinct from i.purchase_type
          and m.condolence_target is not distinct from i.condolence_target
     )
   where i.claim_id = p_claim_id and not i.account_title_overridden;

  v_round := v_claim.current_round + 1;

  -- 결재라인 선택: 부서별 → 회사 기본 (D-039)
  select id into v_line_id from public.approval_lines
   where company_id = v_member.company_id and department_id = v_member.department_id;
  if v_line_id is null then
    select id into v_line_id from public.approval_lines
     where company_id = v_member.company_id and department_id is null;
  end if;

  if v_line_id is not null then
    for v_step in
      select s.step_order, s.approver_member_id, m.status as approver_status
        from public.approval_line_steps s
        join public.members m on m.id = s.approver_member_id and m.company_id = s.company_id
       where s.approval_line_id = v_line_id and s.company_id = v_member.company_id
       order by s.step_order
    loop
      if v_step.approver_status <> 'approved' then
        raise exception 'INACTIVE_REVIEWER';
      end if;
      v_order := v_order + 1;
      insert into public.claim_approvals (claim_id, company_id, round, step_order, step_kind, approver_member_id, status)
      values (p_claim_id, v_member.company_id, v_round, v_order, 'review', v_step.approver_member_id, 'waiting');
      if v_step.approver_member_id = v_member.id then
        v_own_order := v_order;
      end if;
    end loop;
  end if;

  v_order := v_order + 1;
  insert into public.claim_approvals (claim_id, company_id, round, step_order, step_kind, approver_member_id, status)
  values (p_claim_id, v_member.company_id, v_round, v_order, 'final', null, 'waiting');

  -- 최고 관리자 본인 소명서: 결재 생략 (D-026)
  if v_member.role = 'super_admin' then
    update public.claim_approvals set status = 'skipped'
     where claim_id = p_claim_id and round = v_round;
    select payout, payback into v_payout, v_payback from private.claim_settlement(p_claim_id);
    update public.expense_claims set
      status = case when v_payout = 0 and v_payback = 0 then 'paid'::public.claim_status else 'approved'::public.claim_status end,
      settlement_required = (v_payout > 0 or v_payback > 0),
      self_approved = true,
      current_round = v_round,
      submitted_at = now(),
      approved_at = now(),
      paid_at = case when v_payout = 0 and v_payback = 0 then now() else null end
     where id = p_claim_id;
    return (select status from public.expense_claims where id = p_claim_id);
  end if;

  if v_own_order is not null then
    update public.claim_approvals set status = 'skipped'
     where claim_id = p_claim_id and round = v_round and step_order <= v_own_order;
  end if;

  update public.claim_approvals set status = 'pending'
   where id = (select id from public.claim_approvals
                where claim_id = p_claim_id and round = v_round and status = 'waiting'
                order by step_order limit 1);

  update public.expense_claims set
    status = 'submitted', current_round = v_round, submitted_at = now(), self_approved = false, settlement_required = null
   where id = p_claim_id;
  return 'submitted';
end;
$$;

create or replace function public.override_item_account_title(p_item_id uuid, p_account_title_id uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_member public.members := private.require_member();
  v_item public.expense_items;
  v_title public.account_titles;
begin
  if v_member.role not in ('super_admin', 'admin') then
    raise exception 'NOT_ALLOWED' using errcode = '42501';
  end if;
  select * into v_item from public.expense_items where id = p_item_id and company_id = v_member.company_id for update;
  if not found then raise exception 'NOT_FOUND' using errcode = '42501'; end if;
  if v_item.closed_month is not null then raise exception 'ITEM_CLOSED'; end if;

  if p_account_title_id is null then
    -- 매핑 기준으로 되돌림 (매핑이 없으면 비움)
    update public.expense_items i
       set (account_title_id, account_title_name, account_title_code) = (
             select t.id, t.name, t.code
               from public.account_title_mappings m
               join public.account_titles t on t.id = m.account_title_id and t.company_id = m.company_id
              where m.company_id = i.company_id and m.category = i.category
                and m.trip_type is not distinct from i.trip_type and m.purchase_type is not distinct from i.purchase_type
                and m.condolence_target is not distinct from i.condolence_target),
           account_title_overridden = false,
           updated_at = now()
     where i.id = p_item_id;
    return;
  end if;

  select * into v_title from public.account_titles where id = p_account_title_id and company_id = v_member.company_id;
  if not found then raise exception 'NOT_FOUND' using errcode = '42501'; end if;
  update public.expense_items
     set account_title_id = v_title.id, account_title_name = v_title.name, account_title_code = v_title.code,
         account_title_overridden = true, updated_at = now()
   where id = p_item_id;
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
