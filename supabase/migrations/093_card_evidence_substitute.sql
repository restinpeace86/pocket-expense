-- =============================================================================
-- 093_card_evidence_substitute.sql — 증빙 없음 → 법인카드 내역으로 증빙 대체 (D-170)
-- 사용자 결정(2026-10-29): 영수증을 잃어버려 "자료가 정말 없어요"로 올린 법인카드 영수증이 카드 내역 대조에서 같은 결제와 맞으면
-- 관리자가 [카드 내역으로 증빙 대체] — 증빙 종류를 카드 이용내역으로 바꾸고 그 결제(날짜·가맹점·금액·카드 끝 4자리)를 남긴다.
-- 영수증 원본과 맞춰 본 것이 아니므로 세무 자료에 "영수증 원본 대조 없음"으로 표시한다(크로스 체크 누락 표시).
-- 마감된 항목은 바꿀 수 없다(D-045). 세무 자료 행에 evidence_substitute를 더한다(084 함수 + 한 칸).
-- =============================================================================

alter table public.expense_items add column evidence_substitute jsonb check (evidence_substitute is null or jsonb_typeof(evidence_substitute) = 'object');

create or replace function public.substitute_card_evidence(p_item_id uuid, p_date date, p_merchant text, p_amount integer, p_last4 text)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_admin public.members := private.require_admin();
  i public.expense_items;
begin
  select * into i from public.expense_items where id = p_item_id and company_id = v_admin.company_id for update;
  if i.id is null then raise exception 'NOT_FOUND'; end if;
  if i.closed_month is not null then raise exception 'ITEM_CLOSED'; end if;
  if i.evidence_kind is distinct from 'none' or i.receipt_path is not null then raise exception 'NOT_NO_EVIDENCE'; end if;
  if i.payment_method <> 'corporate_card' or i.amount is distinct from p_amount then raise exception 'CARD_ROW_MISMATCH'; end if;
  update public.expense_items
     set evidence_kind = 'card_history',
         evidence_substitute = jsonb_build_object('source', 'card_statement', 'date', p_date, 'merchant', left(coalesce(p_merchant, ''), 100), 'amount', p_amount,
                                                  'last4', case when p_last4 ~ '^[0-9]{4}$' then p_last4 end, 'by', v_admin.name, 'at', now())
   where id = p_item_id;
end;
$$;
revoke all on function public.substitute_card_evidence(uuid, date, text, integer, text) from public, anon;
grant execute on function public.substitute_card_evidence(uuid, date, text, integer, text) to authenticated;

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
           'account_title_overridden', i.account_title_overridden, 'tax_review_request', i.tax_review_request, 'tax_review_resolved_at', i.tax_review_resolved_at,
           'evidence_substitute', i.evidence_substitute
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
