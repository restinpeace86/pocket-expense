-- =============================================================================
-- bench_rls.sql — RLS 성능 측정 (트랜잭션 후 ROLLBACK, 데이터 흔적 없음)
-- 규모: 회사 50 · 멤버 1,500(회사당 30) · 소명서 21,000 · 항목 63,000
-- 실행: node scripts/supabase-sql.mjs --file supabase/tests/bench_rls.sql
-- 결과: 측정 대상 회사 관리자/직원 관점의 쿼리별 실행 시간(ms)과 보이는 건수
-- =============================================================================
begin;

insert into auth.users (id, instance_id, aud, role, email)
select gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'u' || lpad(g::text, 5, '0') || '@bench.local'
from generate_series(1, 1500) g;

insert into public.companies (name, invite_code, business_number)
select 'BENCH' || lpad(g::text, 3, '0'), translate(upper(substr(md5('bench' || g), 1, 8)), '01', '23'), lpad(g::text, 10, '9')
from generate_series(1, 50) g;

with u as (select id, row_number() over (order by email) rn from auth.users where email like '%@bench.local'),
     c as (select id, row_number() over (order by name) cn from public.companies where name like 'BENCH%')
insert into public.members (auth_user_id, company_id, name, phone, role, status, privacy_agreed_at)
select u.id, c.id, 'M' || u.rn, '010' || lpad(u.rn::text, 8, '0'),
       case when (u.rn - 1) % 30 = 0 then 'super_admin' else 'employee' end::public.member_role, 'approved', now()
from u join c on c.cn = ((u.rn - 1) / 30) + 1;

insert into public.expense_claims (company_id, member_id, title, description, status, submitted_at, total_amount)
select m.company_id, m.id, '소명서 ' || g, '벤치', (array['draft', 'submitted', 'approved', 'paid'])[1 + (g % 4)]::public.claim_status,
       now() - (g || ' hours')::interval, 30000
from public.members m cross join generate_series(1, 14) g
where m.name like 'M%';

insert into public.expense_items (claim_id, company_id, category, amount, expense_date)
select c.id, c.company_id, 'meal', 10000, current_date - (g * 3)
from public.expense_claims c cross join generate_series(1, 3) g
where c.title like '소명서 %';

-- 상신된 건: 관리자 최종 승인 단계 + 1/3은 사전 검토 단계(검토자 = 같은 회사 첫 직원)
insert into public.claim_approvals (claim_id, company_id, round, step_order, step_kind, approver_member_id, status)
select c.id, c.company_id, 1, 1, 'review', r.id, 'approved'
from public.expense_claims c
join lateral (select id from public.members m2 where m2.company_id = c.company_id and m2.role = 'employee' order by m2.name limit 1) r on true
where c.status <> 'draft' and (abs(hashtext(c.id::text)) % 3) = 0;
insert into public.claim_approvals (claim_id, company_id, round, step_order, step_kind, approver_member_id, status)
select c.id, c.company_id, 1, 2, 'final', null, case when c.status = 'submitted' then 'pending' else 'approved' end::public.approval_step_status
from public.expense_claims c where c.status <> 'draft' and c.title like '소명서 %';

analyze public.members; analyze public.expense_claims; analyze public.expense_items; analyze public.claim_approvals;

-- 측정 대상: BENCH001 회사의 최고 관리자(M1)와 직원(M2)
select set_config('bench.admin_uid', (select auth_user_id::text from public.members where name = 'M1'), true);
select set_config('bench.emp_uid', (select auth_user_id::text from public.members where name = 'M2'), true);
select set_config('bench.claim_id', (select id::text from public.expense_claims where member_id = (select id from public.members where name = 'M2') limit 1), true);

create schema bench;
create function bench.ms(q text) returns numeric language plpgsql as $$
declare p json;
begin
  execute 'explain (analyze, format json) ' || q into p;
  return round((p->0->>'Execution Time')::numeric, 2);
end $$;
grant usage on schema bench to authenticated;
grant execute on function bench.ms(text) to authenticated;

-- 관리자 관점
select set_config('request.jwt.claims', json_build_object('sub', current_setting('bench.admin_uid'), 'role', 'authenticated')::text, true);
set local role authenticated;
select set_config('bench.r_admin', json_build_object(
  'admin_claim_list_50', bench.ms('select id, title, status, total_amount from public.expense_claims order by submitted_at desc nulls last limit 50'),
  'admin_pending_count', bench.ms('select count(*) from public.expense_claims where status = ''submitted'''),
  'admin_month_items', bench.ms('select count(*), sum(amount) from public.expense_items where expense_date >= date_trunc(''month'', current_date)'),
  'admin_claim_detail_items', bench.ms(format('select * from public.expense_items where claim_id = %L', current_setting('bench.claim_id'))),
  'admin_approvals_pending', bench.ms('select count(*) from public.claim_approvals where status = ''pending'''),
  'admin_members', bench.ms('select count(*) from public.members'),
  'visible_claims', (select count(*) from public.expense_claims),
  'visible_items', (select count(*) from public.expense_items)
)::text, true);
reset role;

-- 직원 관점
select set_config('request.jwt.claims', json_build_object('sub', current_setting('bench.emp_uid'), 'role', 'authenticated')::text, true);
set local role authenticated;
select set_config('bench.r_emp', json_build_object(
  'emp_my_claims_20', bench.ms('select id, title, status from public.expense_claims order by created_at desc limit 20'),
  'emp_my_items', bench.ms('select count(*) from public.expense_items'),
  'emp_claim_detail_items', bench.ms(format('select * from public.expense_items where claim_id = %L', current_setting('bench.claim_id'))),
  'visible_claims', (select count(*) from public.expense_claims),
  'visible_items', (select count(*) from public.expense_items)
)::text, true);
reset role;

select current_setting('bench.r_admin')::json as admin, current_setting('bench.r_emp')::json as employee,
       (select count(*) from public.expense_claims) as total_claims, (select count(*) from public.expense_items) as total_items;
rollback;
