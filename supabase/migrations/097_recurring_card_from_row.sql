-- =============================================================================
-- 097_recurring_card_from_row.sql — 정기 결제 결의서의 법인카드를 카드 내역에서 채움 (D-171 보완)
-- 시나리오 점검(2026-10-29)에서 발견: 정기 결제를 카드 없이 등록하면 [정기 결제로 처리]로 만든 결의서가
-- "사용한 법인카드"가 비어 상신이 막혔다. 등록된 카드가 없으면 그 카드 결제의 끝 4자리로 회사 법인카드를 찾는다.
-- =============================================================================

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
  v_card uuid;
begin
  select * into r from public.recurring_payments where id = p_recurring_id and company_id = v_admin.company_id;
  if r.id is null then raise exception 'NOT_FOUND'; end if;
  if p_date is null or p_amount is null or p_amount < 1 then raise exception 'CARD_ROW_MISMATCH'; end if;
  if not exists (select 1 from public.members where id = r.assignee_member_id and company_id = r.company_id and status = 'approved') then raise exception 'ASSIGNEE_INACTIVE'; end if;
  v_period := case when r.cycle = 'monthly' then date_trunc('month', p_date)::date else date_trunc('year', p_date)::date end;
  -- 예전 방식(결제일 날짜로 저장)과 함께 월(연) 단위로 본다
  if exists (select 1 from public.expense_claims where recurring_payment_id = r.id
               and date_trunc(case when r.cycle = 'monthly' then 'month' else 'year' end, recurring_period)::date = v_period) then raise exception 'RECURRING_ALREADY'; end if;
  -- 정기 결제에 카드를 안 골랐으면 카드 내역의 끝 4자리로 회사 법인카드를 찾는다(시나리오 점검 2026-10-29)
  v_card := coalesce(r.corporate_card_id, (select id from public.corporate_cards where company_id = r.company_id and last4 = p_last4 order by created_at limit 1));
  v_label := case when r.cycle = 'monthly' then to_char(v_period, 'FMYYYY"년" FMMM"월"') else to_char(v_period, 'FMYYYY"년"') end;
  insert into public.expense_claims (company_id, member_id, title, description, category, default_payment_method, recurring_payment_id, recurring_period)
  values (r.company_id, r.assignee_member_id,
          left('[온라인 SaaS 구독료] ' || r.service_name || ' ' || v_label, 100),
          left(r.service_name || ' ' || v_label || ' 정기 결제 구독료(카드 내역으로 결제 확인)', 1000),
          'saas', 'corporate_card', r.id, v_period)
  returning id into v_claim;
  insert into public.expense_items (claim_id, company_id, sort_order, category, payment_method, corporate_card_id, evidence_type, evidence_kind, evidence_substitute,
                                    expense_date, merchant_name, amount, headcount, parse_status, purpose)
  values (v_claim, r.company_id, 1, 'saas', 'corporate_card', v_card, 'card_slip', 'card_history',
          jsonb_build_object('source', 'card_statement', 'date', p_date, 'merchant', left(coalesce(p_merchant, ''), 100), 'amount', p_amount,
                             'last4', case when p_last4 ~ '^[0-9]{4}$' then p_last4 end, 'by', v_admin.name, 'at', now(), 'recurring', r.service_name),
          p_date, left(coalesce(nullif(btrim(p_merchant), ''), r.service_name), 100), p_amount, 1, 'none', left(r.service_name || ' ' || v_label || ' 구독료', 200));
  perform private.recompute_claim(v_claim);
  return v_claim;
end;
$$;
