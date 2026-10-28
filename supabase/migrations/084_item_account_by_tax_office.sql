-- =============================================================================
-- 084_item_account_by_tax_office.sql — 영수증별 계정과목 조정도 세무사무소가 (D-156, 사용자 결정 A안)
-- - 등록된 세무사무소와 연결된 회사: 관리자는 결재 때 영수증별 계정과목을 바꿀 수 없고 [세무사 확인 요청] 메모만 남긴다
-- - 세무사무소(그 회사를 볼 수 있는 구성원)가 세무 자료 화면에서 승인·지급된 영수증의 계정과목을 바꾼다(마감된 달은 불가, D-045)
--   바꾸면 확인 요청은 처리됨으로, 회사 계정과목 변경 이력(account_title_changes)에 남는다
-- - 세무 자료 행에 계정 조정 여부·확인 요청을 함께 넘겨 세무 엑셀 '확인 필요'에도 보인다
-- =============================================================================

alter table public.expense_items
  add column tax_review_request text check (tax_review_request is null or char_length(tax_review_request) <= 200),
  add column tax_review_requested_by text,
  add column tax_review_requested_at timestamptz,
  add column tax_review_resolved_at timestamptz;

alter table public.account_title_changes drop constraint account_title_changes_entity_check;
alter table public.account_title_changes add constraint account_title_changes_entity_check check (entity in ('title', 'mapping', 'item'));

-- 회사 관리자: 세무사무소가 관리하는 동안은 영수증별 계정과목을 바꾸지 못한다
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
  if private.company_tax_office_managed(v_member.company_id) then raise exception 'TAX_OFFICE_MANAGES_ACCOUNTS'; end if;
  select * into v_item from public.expense_items where id = p_item_id and company_id = v_member.company_id for update;
  if not found then raise exception 'NOT_FOUND' using errcode = '42501'; end if;
  if v_item.closed_month is not null then raise exception 'ITEM_CLOSED'; end if;

  if p_account_title_id is null then
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

-- 회사 관리자: 세무사 확인 요청(메모). 빈 메모면 요청을 지운다
create or replace function public.request_item_tax_review(p_item_id uuid, p_memo text)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_admin public.members := private.require_admin();
  v_memo text := nullif(btrim(coalesce(p_memo, '')), '');
begin
  if v_memo is not null and char_length(v_memo) > 200 then raise exception 'INVALID_TEXT_LENGTH'; end if;
  update public.expense_items i
     set tax_review_request = v_memo,
         tax_review_requested_by = case when v_memo is null then null else v_admin.name end,
         tax_review_requested_at = case when v_memo is null then null else now() end,
         tax_review_resolved_at = null,
         updated_at = now()
   where i.id = p_item_id and i.company_id = v_admin.company_id
     and exists (select 1 from public.expense_claims c where c.id = i.claim_id and c.status <> 'draft');
  if not found then raise exception 'NOT_FOUND'; end if;
end;
$$;

-- 세무사무소: 영수증별 계정과목 조정(null = 분류 기준으로 되돌리기)
create or replace function public.tax_office_override_item_account_title(p_item_id uuid, p_account_title_id uuid)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_item public.expense_items;
  v_status text;
  v_old text;
  v_title public.account_titles;
  m public.tax_office_members := private.my_tax_office_member();
  v_office text;
begin
  select * into v_item from public.expense_items where id = p_item_id for update;
  if not found or m.id is null or not exists (select 1 from private.tax_office_company_ids() c where c = v_item.company_id) then
    raise exception 'NOT_FOUND';
  end if;
  select status into v_status from public.expense_claims where id = v_item.claim_id;
  if v_status not in ('approved', 'paid') then raise exception 'NOT_FOUND'; end if;
  if v_item.closed_month is not null then raise exception 'ITEM_CLOSED'; end if;
  v_old := v_item.account_title_name;

  if p_account_title_id is null then
    update public.expense_items i
       set (account_title_id, account_title_name, account_title_code) = (
             select t.id, t.name, t.code
               from public.account_title_mappings mp
               join public.account_titles t on t.id = mp.account_title_id and t.company_id = mp.company_id
              where mp.company_id = i.company_id and mp.category = i.category
                and mp.trip_type is not distinct from i.trip_type and mp.purchase_type is not distinct from i.purchase_type
                and mp.condolence_target is not distinct from i.condolence_target),
           account_title_overridden = false,
           tax_review_resolved_at = case when i.tax_review_request is not null then now() end,
           updated_at = now()
     where i.id = p_item_id
    returning * into v_item;
  else
    select * into v_title from public.account_titles where id = p_account_title_id and company_id = v_item.company_id;
    if not found then raise exception 'NOT_FOUND'; end if;
    update public.expense_items
       set account_title_id = v_title.id, account_title_name = v_title.name, account_title_code = v_title.code,
           account_title_overridden = true,
           tax_review_resolved_at = case when tax_review_request is not null then now() end,
           updated_at = now()
     where id = p_item_id
    returning * into v_item;
  end if;

  select name into v_office from public.tax_offices where id = m.office_id;
  insert into public.account_title_changes (company_id, entity, action, detail, actor_name, office_name)
  values (v_item.company_id, 'item', 'update',
          jsonb_build_object('merchant', v_item.merchant_name, 'expense_date', v_item.expense_date, 'amount', v_item.amount,
                             'old_title', v_old, 'new_title', v_item.account_title_name, 'reverted', p_account_title_id is null),
          m.name, v_office);
  return jsonb_build_object('id', v_item.account_title_id, 'name', v_item.account_title_name, 'code', v_item.account_title_code, 'overridden', v_item.account_title_overridden);
end;
$$;
revoke all on function public.request_item_tax_review(uuid, text), public.tax_office_override_item_account_title(uuid, uuid) from public, anon;
grant execute on function public.request_item_tax_review(uuid, text), public.tax_office_override_item_account_title(uuid, uuid) to authenticated;

-- 세무 자료 행에 계정 조정 여부·세무사 확인 요청 추가(관리자 세무 마감·세무사무소 공용)
create or replace function private.tax_month_export_for(p_company uuid, p_month text)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_closing public.monthly_closings;
  v_rows jsonb;
  v_excluded jsonb;
begin
  if p_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then raise exception 'INVALID_MONTH'; end if;
  select * into v_closing from public.monthly_closings where company_id = p_company and year_month = p_month;

  with target as (
    select t.item_id, t.kind, t.seq from private.tax_month_items_for(p_company, p_month) t
  ), appr as (
    -- 결의서 마지막 회차의 승인 단계: "김팀장(10/12) → 이대표(10/13)"
    select a.claim_id,
           string_agg(coalesce(m.name, '?') || '(' || to_char(a.acted_at at time zone 'Asia/Seoul', 'FMMM/FMDD') || ')', ' → ' order by a.step_order) as approvers
      from public.claim_approvals a
      join public.expense_claims c on c.id = a.claim_id and a.round = c.current_round
      left join public.members m on m.id = a.acted_by_member_id
     where a.company_id = p_company and a.status = 'approved'
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
           'evidence_kind', coalesce(i.evidence_kind::text, case when i.receipt_path is not null then 'receipt' end), 'no_evidence_reason', i.no_evidence_reason,
           'applied_fuel_mode', i.applied_fuel_mode, 'applied_fuel_price', i.applied_fuel_price, 'applied_fuel_type', i.applied_fuel_type,
           'account_title_overridden', i.account_title_overridden, 'tax_review_request', i.tax_review_request, 'tax_review_resolved_at', i.tax_review_resolved_at
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
   where i.company_id = p_company and c.status in ('draft', 'submitted', 'rejected')
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

revoke all on function private.tax_month_export_for(uuid, text) from public, anon, authenticated;
