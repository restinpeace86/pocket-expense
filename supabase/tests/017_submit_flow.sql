-- =============================================================================
-- 017_submit_flow.sql — 상신 검증·재계산·계정과목 스냅샷·승인·반려·재상신·지급 완료 (T9, migration 033)
-- 회사 A: 최고 관리자 a_sup, 관리자 a_adm, 직원 a_e1. 회사 B: 최고 관리자 b_sup.
-- =============================================================================
begin;

create or replace function public._t_expect(p_sql text, p_code text, p_label text)
returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlerrm = p_code then return; end if;
    raise exception 'FAIL [%] expected % but got %', p_label, p_code, sqlerrm;
  end;
  raise exception 'FAIL [%] expected % but succeeded', p_label, p_code;
end;
$$;
grant execute on function public._t_expect(text, text, text) to authenticated;

insert into auth.users (id, instance_id, aud, role, email)
select u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u::text || '@test.local'
from unnest(array['a4100000-0000-0000-0000-000000000001', 'a4100000-0000-0000-0000-000000000002', 'a4100000-0000-0000-0000-000000000003', 'b4100000-0000-0000-0000-000000000001']::uuid[]) u;
insert into public.companies (id, name, invite_code, business_number, meal_limit_per_person, meal_limit_mode) values
  ('c4100000-0000-0000-0000-00000000000a', '상신회사A', 'SBMAAAAA', '1000000411', 10000, 'split'),
  ('c4100000-0000-0000-0000-00000000000b', '상신회사B', 'SBMBBBBB', '1000000412', 10000, 'split');
select private.seed_account_defaults('c4100000-0000-0000-0000-00000000000a');
insert into public.members (id, auth_user_id, company_id, name, phone, role, status, privacy_agreed_at) values
  ('a4200000-0000-0000-0000-000000000001', 'a4100000-0000-0000-0000-000000000001', 'c4100000-0000-0000-0000-00000000000a', 'A대표', '01096401000', 'super_admin', 'approved', now()),
  ('a4200000-0000-0000-0000-000000000002', 'a4100000-0000-0000-0000-000000000002', 'c4100000-0000-0000-0000-00000000000a', 'A관리자', '01096401001', 'admin', 'approved', now()),
  ('a4200000-0000-0000-0000-000000000003', 'a4100000-0000-0000-0000-000000000003', 'c4100000-0000-0000-0000-00000000000a', 'A직원', '01096401002', 'employee', 'approved', now()),
  ('b4200000-0000-0000-0000-000000000001', 'b4100000-0000-0000-0000-000000000001', 'c4100000-0000-0000-0000-00000000000b', 'B대표', '01097401000', 'super_admin', 'approved', now());
insert into public.corporate_cards (id, company_id, nickname, last4) values ('a4300000-0000-0000-0000-000000000001', 'c4100000-0000-0000-0000-00000000000a', 'A 법인', '7890');

-- 소명서 3건: ① 직원 사비 식대(검증 실패 → 고쳐서 상신 → 승인 → 지급) ② 직원 법인카드 미팅(반려 → 재상신 → 승인 = 정산 없음)
--            ③ 관리자 본인 소명서(본인 승인 불가, 대표가 승인)  ④ 대표 본인 소명서(결재 생략)
insert into public.expense_claims (id, company_id, member_id, title, default_payment_method) values
  ('a4400000-0000-0000-0000-000000000001', 'c4100000-0000-0000-0000-00000000000a', 'a4200000-0000-0000-0000-000000000003', '', 'personal_card'),
  ('a4400000-0000-0000-0000-000000000002', 'c4100000-0000-0000-0000-00000000000a', 'a4200000-0000-0000-0000-000000000003', '거래처 미팅', 'corporate_card'),
  ('a4400000-0000-0000-0000-000000000003', 'c4100000-0000-0000-0000-00000000000a', 'a4200000-0000-0000-0000-000000000002', '관리자 택시', 'personal_card'),
  ('a4400000-0000-0000-0000-000000000004', 'c4100000-0000-0000-0000-00000000000a', 'a4200000-0000-0000-0000-000000000001', '대표 간식', 'corporate_card');
update public.expense_claims set description = '소명' where id in ('a4400000-0000-0000-0000-000000000002', 'a4400000-0000-0000-0000-000000000003', 'a4400000-0000-0000-0000-000000000004');
insert into public.expense_items (id, claim_id, company_id, sort_order, category, payment_method, corporate_card_id, evidence_type, expense_date, amount, headcount, purpose, trip_type, purchase_type, receipt_path) values
  -- ①: 금액·증빙 비어 있음, 식대 15,000원 1명 → 한도 10,000
  ('a4500000-0000-0000-0000-000000000001', 'a4400000-0000-0000-0000-000000000001', 'c4100000-0000-0000-0000-00000000000a', 1, 'meal', 'personal_card', null, null, '2026-10-15', null, 1, null, null, null, 'c4100000-0000-0000-0000-00000000000a/x/a4400000-0000-0000-0000-000000000001/1.jpg'),
  ('a4500000-0000-0000-0000-000000000002', 'a4400000-0000-0000-0000-000000000002', 'c4100000-0000-0000-0000-00000000000a', 1, 'meeting', 'corporate_card', 'a4300000-0000-0000-0000-000000000001', 'card_slip', '2026-10-15', 45000, 2, null, null, null, 'c4100000-0000-0000-0000-00000000000a/x/a4400000-0000-0000-0000-000000000002/1.jpg'),
  ('a4500000-0000-0000-0000-000000000003', 'a4400000-0000-0000-0000-000000000003', 'c4100000-0000-0000-0000-00000000000a', 1, 'trip', 'personal_card', null, 'card_slip', '2026-10-15', 12000, 1, null, 'taxi', null, 'c4100000-0000-0000-0000-00000000000a/x/a4400000-0000-0000-0000-000000000003/1.jpg'),
  ('a4500000-0000-0000-0000-000000000004', 'a4400000-0000-0000-0000-000000000004', 'c4100000-0000-0000-0000-00000000000a', 1, 'purchase', 'corporate_card', 'a4300000-0000-0000-0000-000000000001', 'card_slip', '2026-10-15', 20000, 1, '탕비실 커피', null, 'pantry', 'c4100000-0000-0000-0000-00000000000a/x/a4400000-0000-0000-0000-000000000004/1.jpg');

-- ── 직원: 빠진 칸 확인 → 상신 거부 → 고치고 상신 ─────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"a4100000-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
do $$
declare p jsonb;
begin
  p := public.check_claim_for_submit('a4400000-0000-0000-0000-000000000001');
  if p->'header' <> '["title", "description"]'::jsonb then raise exception 'FAIL [A_E] header problems: %', p; end if;
  if p->'items'->0->'fields' <> '["evidence_type", "amount"]'::jsonb then raise exception 'FAIL [A_E] item problems: %', p; end if;
  -- 미팅 소명서: 목적이 빠짐
  if public.check_claim_for_submit('a4400000-0000-0000-0000-000000000002')->'items'->0->'fields' <> '["purpose"]'::jsonb then raise exception 'FAIL [A_E] meeting purpose'; end if;
end $$;
select public._t_expect($q$select public.submit_claim('a4400000-0000-0000-0000-000000000001')$q$, 'CLAIM_INCOMPLETE', 'A_E incomplete');
select public._t_expect($q$select public.check_claim_for_submit('a4400000-0000-0000-0000-000000000003')$q$, 'NOT_FOUND', 'A_E check other member');
do $$
begin
  update public.expense_claims set title = '팀 점심', description = '프로젝트 회의 후 점심' where id = 'a4400000-0000-0000-0000-000000000001';
  update public.expense_items set amount = 15000, evidence_type = 'card_slip' where id = 'a4500000-0000-0000-0000-000000000001';
  -- 화면을 거치지 않아 계산값이 비어 있어도 상신 때 서버가 다시 계산한다
  if public.submit_claim('a4400000-0000-0000-0000-000000000001') <> 'submitted' then raise exception 'FAIL [A_E] submit'; end if;
  update public.expense_items set purpose = 'A사 계약 협의' where id = 'a4500000-0000-0000-0000-000000000002';
  if public.submit_claim('a4400000-0000-0000-0000-000000000002') <> 'submitted' then raise exception 'FAIL [A_E] submit meeting'; end if;
end $$;
-- 상신 뒤에는 고칠 수 없고, 직원은 승인할 수 없다
select public._t_expect($q$select public.submit_claim('a4400000-0000-0000-0000-000000000001')$q$, 'INVALID_STATUS', 'A_E resubmit submitted');
select public._t_expect($q$select public.approve_claim('a4400000-0000-0000-0000-000000000001')$q$, 'NOT_ALLOWED', 'A_E approve own');
reset role;

do $$
begin
  -- 재계산: 15,000원 중 회사 10,000 / 개인 5,000, 계정과목 스냅샷
  if (select row(company_supported_amount, personal_burden_amount, account_title_name)::text from public.expense_items where id = 'a4500000-0000-0000-0000-000000000001')
     <> row(10000, 5000, '복리후생비')::text then
    raise exception 'FAIL recompute/account snapshot: %', (select row(company_supported_amount, personal_burden_amount, account_title_name)::text from public.expense_items where id = 'a4500000-0000-0000-0000-000000000001');
  end if;
  if (select account_title_name from public.expense_items where id = 'a4500000-0000-0000-0000-000000000002') <> '기업업무추진비' then raise exception 'FAIL meeting account'; end if;
  if (select row(status, current_round, total_amount, total_company_supported)::text from public.expense_claims where id = 'a4400000-0000-0000-0000-000000000001')
     <> row('submitted'::public.claim_status, 1, 15000, 10000)::text then
    raise exception 'FAIL claim after submit';
  end if;
  if (select count(*) from public.claim_approvals where claim_id = 'a4400000-0000-0000-0000-000000000001' and step_kind = 'final' and status = 'pending') <> 1 then raise exception 'FAIL final step'; end if;
end $$;

-- ── 다른 회사 대표: 볼 수도 처리할 수도 없다 ────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"b4100000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select public._t_expect($q$select public.approve_claim('a4400000-0000-0000-0000-000000000001')$q$, 'NOT_FOUND', 'B_SUP approve A');
select public._t_expect($q$select public.reject_claim('a4400000-0000-0000-0000-000000000001', '다른 회사 반려 시도')$q$, 'NOT_FOUND', 'B_SUP reject A');
select public._t_expect($q$select public.mark_claims_paid(array['a4400000-0000-0000-0000-000000000001'::uuid])$q$, 'INVALID_CLAIMS', 'B_SUP pay A');
do $$ begin if (select count(*) from public.expense_claims) <> 0 then raise exception 'FAIL [B_SUP] sees A claims'; end if; end $$;
reset role;

-- ── A 관리자: 반려(사유·지목 검사) → 승인 / 본인 소명서는 승인 불가 ────────────────────
select set_config('request.jwt.claims', '{"sub":"a4100000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select public._t_expect($q$select public.reject_claim('a4400000-0000-0000-0000-000000000002', '짧음')$q$, 'REASON_TOO_SHORT', 'A_ADM short reason');
select public._t_expect($q$select public.reject_claim('a4400000-0000-0000-0000-000000000002', '영수증 금액 확인 필요', array['a4500000-0000-0000-0000-000000000001'::uuid])$q$, 'INVALID_FLAGGED_ITEMS', 'A_ADM flag other claim item');
do $$
begin
  if public.reject_claim('a4400000-0000-0000-0000-000000000002', '참석자를 적어 주세요', array['a4500000-0000-0000-0000-000000000002'::uuid]) <> 'rejected' then raise exception 'FAIL [A_ADM] reject'; end if;
  -- 사비 식대 승인 → 지급할 돈이 있으니 정산 대기
  if public.approve_claim('a4400000-0000-0000-0000-000000000001', '확인') <> 'approved' then raise exception 'FAIL [A_ADM] approve'; end if;
end $$;
select public._t_expect($q$select public.approve_claim('a4400000-0000-0000-0000-000000000001')$q$, 'INVALID_STATUS', 'A_ADM approve twice');
reset role;

-- 관리자 본인 소명서: 본인은 승인 못 하고 대표가 승인
select set_config('request.jwt.claims', '{"sub":"a4100000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
do $$ begin if public.submit_claim('a4400000-0000-0000-0000-000000000003') <> 'submitted' then raise exception 'FAIL [A_ADM] own submit'; end if; end $$;
select public._t_expect($q$select public.approve_claim('a4400000-0000-0000-0000-000000000003')$q$, 'NOT_ALLOWED', 'A_ADM approve own');
reset role;

-- ── 직원: 반려 사유 보고 고쳐서 재상신 (회차 2) ─────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"a4100000-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  if (select rejection_reason from public.expense_claims where id = 'a4400000-0000-0000-0000-000000000002') <> '참석자를 적어 주세요' then raise exception 'FAIL [A_E] reason not visible'; end if;
  if (select flagged_item_ids from public.claim_approvals where claim_id = 'a4400000-0000-0000-0000-000000000002' and status = 'rejected') <> array['a4500000-0000-0000-0000-000000000002'::uuid] then raise exception 'FAIL [A_E] flagged not visible'; end if;
  update public.expense_items set attendees = 'A사 김부장' where id = 'a4500000-0000-0000-0000-000000000002';
  if public.submit_claim('a4400000-0000-0000-0000-000000000002') <> 'submitted' then raise exception 'FAIL [A_E] resubmit'; end if;
  if (select current_round from public.expense_claims where id = 'a4400000-0000-0000-0000-000000000002') <> 2 then raise exception 'FAIL [A_E] round'; end if;
end $$;
-- 직원은 지급 완료 처리를 할 수 없다
select public._t_expect($q$select public.mark_claims_paid(array['a4400000-0000-0000-0000-000000000001'::uuid])$q$, 'NOT_ALLOWED', 'A_E mark paid');
reset role;

-- ── 대표: 관리자 소명서 승인, 법인카드 미팅(정산 없음 → 바로 paid), 지급 완료, 본인 소명서 결재 생략 ──
select set_config('request.jwt.claims', '{"sub":"a4100000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  if public.approve_claim('a4400000-0000-0000-0000-000000000003') <> 'approved' then raise exception 'FAIL [A_SUP] approve admin claim'; end if;
  if public.approve_claim('a4400000-0000-0000-0000-000000000002') <> 'paid' then raise exception 'FAIL [A_SUP] corporate claim should be paid directly'; end if;
  if public.mark_claims_paid(array['a4400000-0000-0000-0000-000000000001'::uuid, 'a4400000-0000-0000-0000-000000000003'::uuid]) <> 2 then raise exception 'FAIL [A_SUP] mark paid'; end if;
  if public.submit_claim('a4400000-0000-0000-0000-000000000004') <> 'paid' then raise exception 'FAIL [A_SUP] self approval'; end if;
end $$;
select public._t_expect($q$select public.mark_claims_paid(array['a4400000-0000-0000-0000-000000000001'::uuid])$q$, 'INVALID_CLAIMS', 'A_SUP pay twice');
reset role;

do $$
begin
  if (select string_agg(status::text || ':' || coalesce(settlement_required::text, '-') || ':' || self_approved, ',' order by id) from public.expense_claims where company_id = 'c4100000-0000-0000-0000-00000000000a')
     <> 'paid:true:false,paid:false:false,paid:true:false,paid:false:true' then
    raise exception 'FAIL final states: %', (select string_agg(status::text || ':' || coalesce(settlement_required::text, '-') || ':' || self_approved, ',' order by id) from public.expense_claims where company_id = 'c4100000-0000-0000-0000-00000000000a');
  end if;
  if (select paid_by_member_id from public.expense_claims where id = 'a4400000-0000-0000-0000-000000000001') <> 'a4200000-0000-0000-0000-000000000001' then raise exception 'FAIL paid_by'; end if;
  if (select count(*) from public.claim_approvals where claim_id = 'a4400000-0000-0000-0000-000000000002') <> 2 then raise exception 'FAIL history rounds kept'; end if;
end $$;

select 'SUBMIT_FLOW_OK' as result;
rollback;
