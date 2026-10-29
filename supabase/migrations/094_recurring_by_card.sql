-- =============================================================================
-- 094_recurring_by_card.sql — 정기 결제: 날짜로 자동 생성 대신 실제 결제(카드 내역)와 맞을 때 결의서 (D-171, D-110 변경)
-- 사용자 결정(2026-10-29): 결제일에 근거 없이 결의서를 만들지 않는다.
-- - 정기 결제 등록은 "매달 내는 것 목록" — 카드 내역 대조에서 가맹점(카드 내역 가맹점 이름 키워드 또는 서비스명)·금액(±10%)이 맞으면
--   [정기 결제로 처리] → 담당자 앞으로 결의서(작성 중), 그 카드 결제가 증빙(카드 이용내역). 같은 기간은 한 번만
-- - 담당자 개인카드 정기 결제는 카드 내역이 없으니 결제일에 담당자에게 "결제 내역 올려 상신" 알림만(결의서는 만들지 않음)
-- - 예전 자동 생성 함수(generate_recurring_claims)는 cron에서 더 부르지 않는다(함수는 남김)
-- =============================================================================

alter table public.recurring_payments add column merchant_keyword text check (merchant_keyword is null or char_length(merchant_keyword) between 1 and 60);

-- 카드 결제 1건으로 정기 결제 결의서 만들기(관리자)
create or replace function public.create_recurring_claim_from_card(p_recurring_id uuid, p_date date, p_merchant text, p_amount integer, p_last4 text)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_admin public.members := private.require_admin();
  r public.recurring_payments;
  v_period date;
  v_label text;
  v_claim uuid;
begin
  select * into r from public.recurring_payments where id = p_recurring_id and company_id = v_admin.company_id;
  if r.id is null then raise exception 'NOT_FOUND'; end if;
  if p_date is null or p_amount is null or p_amount < 1 then raise exception 'CARD_ROW_MISMATCH'; end if;
  if not exists (select 1 from public.members where id = r.assignee_member_id and company_id = r.company_id and status = 'approved') then raise exception 'ASSIGNEE_INACTIVE'; end if;
  v_period := case when r.cycle = 'monthly' then date_trunc('month', p_date)::date else date_trunc('year', p_date)::date end;
  if exists (select 1 from public.expense_claims where recurring_payment_id = r.id and recurring_period = v_period) then raise exception 'RECURRING_ALREADY'; end if;
  v_label := case when r.cycle = 'monthly' then to_char(v_period, 'FMYYYY"년" FMMM"월"') else to_char(v_period, 'FMYYYY"년"') end;
  insert into public.expense_claims (company_id, member_id, title, description, category, default_payment_method, recurring_payment_id, recurring_period)
  values (r.company_id, r.assignee_member_id,
          left('[온라인 SaaS 구독료] ' || r.service_name || ' ' || v_label, 100),
          left(r.service_name || ' ' || v_label || ' 정기 결제 구독료(카드 내역으로 결제 확인)', 1000),
          'saas', 'corporate_card', r.id, v_period)
  returning id into v_claim;
  insert into public.expense_items (claim_id, company_id, sort_order, category, payment_method, corporate_card_id, evidence_type, evidence_kind, evidence_substitute,
                                    expense_date, merchant_name, amount, headcount, parse_status, purpose)
  values (v_claim, r.company_id, 1, 'saas', 'corporate_card', r.corporate_card_id, 'card_slip', 'card_history',
          jsonb_build_object('source', 'card_statement', 'date', p_date, 'merchant', left(coalesce(p_merchant, ''), 100), 'amount', p_amount,
                             'last4', case when p_last4 ~ '^[0-9]{4}$' then p_last4 end, 'by', v_admin.name, 'at', now(), 'recurring', r.service_name),
          p_date, left(coalesce(nullif(btrim(p_merchant), ''), r.service_name), 100), p_amount, 1, 'none', left(r.service_name || ' ' || v_label || ' 구독료', 200));
  perform private.recompute_claim(v_claim);
  return v_claim;
end;
$$;
revoke all on function public.create_recurring_claim_from_card(uuid, date, text, integer, text) from public, anon;
grant execute on function public.create_recurring_claim_from_card(uuid, date, text, integer, text) to authenticated;

-- 개인카드 정기 결제의 결제일 알림 대상(cron, service role) — 그 기간 결의서가 아직 없는 것만
create or replace function public.recurring_personal_due(p_today date default ((now() at time zone 'Asia/Seoul')::date))
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  r record;
  v_period date;
  v_out jsonb := '[]'::jsonb;
begin
  for r in
    select p.* from public.recurring_payments p
      join public.members m on m.id = p.assignee_member_id and m.company_id = p.company_id and m.status = 'approved'
     where p.is_active and p.payment_method = 'personal_card'
  loop
    v_period := private.recurring_due_period(r.cycle, r.billing_day, r.billing_month, r.starts_on, p_today);
    continue when v_period is null;
    continue when exists (select 1 from public.expense_claims where recurring_payment_id = r.id and recurring_period = v_period);
    v_out := v_out || jsonb_build_object('recurring_id', r.id, 'company_id', r.company_id, 'member_id', r.assignee_member_id, 'service_name', r.service_name, 'amount', r.amount,
                                         'period_label', case when r.cycle = 'monthly' then to_char(v_period, 'FMYYYY"년" FMMM"월"') else to_char(v_period, 'FMYYYY"년"') end);
  end loop;
  return v_out;
end;
$$;
revoke all on function public.recurring_personal_due(date) from public, anon, authenticated;
grant execute on function public.recurring_personal_due(date) to service_role;
