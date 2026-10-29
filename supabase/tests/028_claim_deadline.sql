-- =============================================================================
-- 028_claim_deadline.sql — 청구 기한 판정(TS와 같은 규칙) + 관리자 홈 기한 초과 건수 (migration 046)
-- =============================================================================
begin;

do $$
begin
  -- D-161: 회사 설정과 관계없이 사용한 달의 다음 달 2일(쉬는 날이면 앞 영업일)
  if private.claim_deadline_date('2026-10-16', 'next_month_day', 5) <> '2026-11-02'
     or private.claim_deadline_date('2026-12-31', 'none', null) <> '2026-12-31'
     or private.claim_deadline_date('2026-09-20', 'days_after', 10) <> '2026-10-02'
     or private.claim_deadline_date(null, 'end_of_month', null) is not null then
    raise exception 'FAIL deadline rule';
  end if;
end;
$$;

insert into auth.users (id, instance_id, aud, role, email)
select u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u::text || '@test.local'
from unnest(array['a2800000-0000-0000-0000-000000000001', 'a2800000-0000-0000-0000-000000000002']::uuid[]) u;
insert into public.companies (id, name, invite_code, business_number, claim_deadline_type, claim_deadline_days) values
  ('c2800000-0000-0000-0000-00000000000a', '기한회사', 'DLNEAAAA', '1000000281', 'next_month_day', 5);
insert into public.members (id, auth_user_id, company_id, name, phone, role, status, privacy_agreed_at) values
  ('a2810000-0000-0000-0000-000000000001', 'a2800000-0000-0000-0000-000000000001', 'c2800000-0000-0000-0000-00000000000a', '대표', '01092801001', 'super_admin', 'approved', now()),
  ('a2810000-0000-0000-0000-000000000002', 'a2800000-0000-0000-0000-000000000002', 'c2800000-0000-0000-0000-00000000000a', '직원', '01092801002', 'employee', 'approved', now());
-- 9/20 결제 → 10/2(금)까지. 10/3(한국) 상신은 초과, 10/2 23시(한국) 상신은 아님
insert into public.expense_claims (id, company_id, member_id, title, status, submitted_at) values
  ('a2820000-0000-0000-0000-000000000001', 'c2800000-0000-0000-0000-00000000000a', 'a2810000-0000-0000-0000-000000000002', '늦은 상신', 'submitted', '2026-10-02T16:30:00Z'),
  ('a2820000-0000-0000-0000-000000000002', 'c2800000-0000-0000-0000-00000000000a', 'a2810000-0000-0000-0000-000000000002', '제때 상신', 'submitted', '2026-10-02T14:00:00Z');
insert into public.expense_items (claim_id, company_id, sort_order, category, payment_method, expense_date, amount, headcount) values
  ('a2820000-0000-0000-0000-000000000001', 'c2800000-0000-0000-0000-00000000000a', 1, 'meal', 'personal_card', '2026-09-20', 9000, 1),
  ('a2820000-0000-0000-0000-000000000002', 'c2800000-0000-0000-0000-00000000000a', 1, 'meal', 'personal_card', '2026-09-20', 9000, 1);

select set_config('request.jwt.claims', '{"sub":"a2800000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  if (public.admin_dashboard('2026-10')->'todo'->>'overdue_claims')::int <> 1 then
    raise exception 'FAIL overdue count %', public.admin_dashboard('2026-10')->'todo';
  end if;
end;
$$;
reset role;

select 'CLAIM_DEADLINE_OK' as result;
rollback;
