-- =============================================================================
-- 044_tax_month_export.sql — 세무 마감 화면·엑셀·ZIP용 데이터 한 번에 (T10, tax-export.md §2·§3)
-- tax_month_export(M): 관리자만. 자기 회사의 M 대상 항목(마감 완료면 마감된 항목, 아니면 대기 대상)을
--   엑셀 시트1에 필요한 값으로 풀어서(결의서·청구자·부서·카드·결재자·자차) 순번 순으로 돌려주고,
--   같은 달 사용 항목 중 빠진 것(작성중·결재중·반려) 건수와 마감 상태를 함께 준다.
-- (id 목록으로 따로 조회하면 수백 건일 때 주소 길이 제한에 걸려 한 함수로 묶는다)
-- =============================================================================

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
           'receipt_path', i.receipt_path, 'route_card_path', i.route_card_path) || jsonb_build_object('item_custom', i.item_custom_payload
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
