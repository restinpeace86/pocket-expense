-- =============================================================================
-- bench_rls.sql — 조회 성능 측정 (트랜잭션 후 ROLLBACK, 데이터 흔적 없음) — spec/common/performance.md §7
-- 규모: 회사 200 · 멤버 6,000(회사당 30) · 소명서 84,000(1년치, 멤버당 14) · 항목 252,000(소명서당 3)
-- 측정: 실제 화면에서 쓸 조회 패턴(목록 나눠 불러오기·월별·결재함·정산 대기·사진 권한)을 관리자/직원/검토자 관점에서
-- 기준: 각 조회 50ms 이하 (넘으면 인덱스·쿼리를 고친다). 날짜(date) 컬럼은 date 값과 비교해야 인덱스를 끝까지 쓴다(::date).
-- 실행 후 npm run bench:db가 자동으로 표를 압축한다(무료 요금제 디스크 보호).
-- 실행: npm run bench:db
-- =============================================================================
begin;

insert into auth.users (id, instance_id, aud, role, email)
select gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'u' || lpad(g::text, 5, '0') || '@bench.local'
from generate_series(1, 6000) g;

insert into public.companies (name, invite_code, business_number)
select 'BENCH' || lpad(g::text, 3, '0'), translate(upper(substr(md5('bench' || g), 1, 8)), '01', '23'), lpad(g::text, 10, '9')
from generate_series(1, 200) g;

with u as (select id, row_number() over (order by email) rn from auth.users where email like '%@bench.local'),
     c as (select id, row_number() over (order by name) cn from public.companies where name like 'BENCH%')
insert into public.members (auth_user_id, company_id, name, phone, role, status, privacy_agreed_at)
select u.id, c.id, 'M' || u.rn, '010' || lpad(u.rn::text, 8, '0'),
       case when (u.rn - 1) % 30 = 0 then 'super_admin' else 'employee' end::public.member_role, 'approved', now()
from u join c on c.cn = ((u.rn - 1) / 30) + 1;

-- 1년치: 멤버당 14건, 약 26일 간격
insert into public.expense_claims (company_id, member_id, title, description, status, submitted_at, approved_at, settlement_required, total_amount, created_at)
select m.company_id, m.id, '소명서 ' || g, '벤치', s.st,
       case when s.st <> 'draft' then now() - (g * 26 || ' days')::interval end,
       case when s.st in ('approved', 'paid') then now() - (g * 26 - 2 || ' days')::interval end,
       case when s.st in ('approved', 'paid') then true end,
       30000, now() - (g * 26 + 1 || ' days')::interval
from public.members m
cross join generate_series(1, 14) g
cross join lateral (select (array['draft', 'submitted', 'approved', 'paid'])[1 + (g % 4)]::public.claim_status st) s
where m.name like 'M%';

insert into public.expense_items (claim_id, company_id, category, amount, expense_date, receipt_path, receipt_thumb_path)
select c.id, c.company_id, 'meal', 10000, (c.created_at - (g || ' days')::interval)::date,
       c.company_id || '/' || c.member_id || '/' || c.id || '/' || gen_random_uuid() || '.jpg',
       c.company_id || '/' || c.member_id || '/' || c.id || '/' || gen_random_uuid() || '_thumb.webp'
from public.expense_claims c cross join generate_series(1, 3) g
where c.title like '소명서 %';

-- 상신된 건: 관리자 최종 승인 단계 + 1/3은 사전 검토 단계(검토자 = 같은 회사 첫 직원)
insert into public.claim_approvals (claim_id, company_id, round, step_order, step_kind, approver_member_id, status)
select c.id, c.company_id, 1, 1, 'review', r.id, case when c.status = 'submitted' then 'pending' else 'approved' end::public.approval_step_status
from public.expense_claims c
join (select distinct on (company_id) company_id, id from public.members where role = 'employee' and name like 'M%' order by company_id, name) r
  on r.company_id = c.company_id
where c.status <> 'draft' and c.title like '소명서 %' and (abs(hashtext(c.id::text)) % 3) = 0;
insert into public.claim_approvals (claim_id, company_id, round, step_order, step_kind, approver_member_id, status)
select c.id, c.company_id, 1, 2, 'final', null, case when c.status = 'submitted' then 'pending' else 'approved' end::public.approval_step_status
from public.expense_claims c where c.status <> 'draft' and c.title like '소명서 %';

analyze public.members; analyze public.expense_claims; analyze public.expense_items; analyze public.claim_approvals;

-- 측정 대상: BENCH001 회사의 최고 관리자(M1), 검토자(M2 = 회사 첫 직원), 직원(M3)
select set_config('bench.admin_uid', (select auth_user_id::text from public.members where name = 'M1'), true);
select set_config('bench.reviewer_uid', (select auth_user_id::text from public.members where name = 'M2'), true);
select set_config('bench.emp_uid', (select auth_user_id::text from public.members where name = 'M3'), true);
select set_config('bench.company_id', (select company_id::text from public.members where name = 'M1'), true);
select set_config('bench.emp_id', (select id::text from public.members where name = 'M3'), true);
select set_config('bench.reviewer_id', (select id::text from public.members where name = 'M2'), true);
select set_config('bench.claim_id', (select id::text from public.expense_claims where member_id = (select id from public.members where name = 'M3') order by created_at desc limit 1), true);
-- 목록 "더 보기" 커서: 관리자 목록 50번째 값
select set_config('bench.cursor_at', (select submitted_at::text from public.expense_claims where company_id = current_setting('bench.company_id')::uuid and submitted_at is not null order by submitted_at desc, id desc offset 49 limit 1), true);
select set_config('bench.cursor_id', (select id::text from public.expense_claims where company_id = current_setting('bench.company_id')::uuid and submitted_at is not null order by submitted_at desc, id desc offset 49 limit 1), true);
select set_config('bench.receipt', (select receipt_path from public.expense_items where claim_id = current_setting('bench.claim_id')::uuid limit 1), true);
select set_config('bench.thumb', (select receipt_thumb_path from public.expense_items where claim_id = current_setting('bench.claim_id')::uuid limit 1), true);

create schema bench;
create function bench.ms(q text) returns numeric language plpgsql as $$
declare p json;
begin
  execute 'explain (analyze, format json) ' || q into p;
  return round((p->0->>'Execution Time')::numeric, 2);
end $$;
grant usage on schema bench to authenticated;
grant execute on function bench.ms(text) to authenticated;

-- 관리자 관점 (화면 쿼리는 company_id를 명시한다)
select set_config('request.jwt.claims', json_build_object('sub', current_setting('bench.admin_uid'), 'role', 'authenticated')::text, true);
set local role authenticated;
select set_config('bench.r_admin', json_build_object(
  'claims_page1_50', bench.ms(format('select id, title, status, total_amount, submitted_at from public.expense_claims where company_id = %L and submitted_at is not null order by submitted_at desc, id desc limit 50', current_setting('bench.company_id'))),
  'claims_page2_cursor', bench.ms(format('select id, title, status, total_amount, submitted_at from public.expense_claims where company_id = %L and submitted_at is not null and (submitted_at, id) < (%L::timestamptz, %L::uuid) order by submitted_at desc, id desc limit 50', current_setting('bench.company_id'), current_setting('bench.cursor_at'), current_setting('bench.cursor_id'))),
  'claims_this_month', bench.ms(format('select id, title, status, total_amount from public.expense_claims where company_id = %L and submitted_at >= date_trunc(''month'', now()) order by submitted_at desc limit 50', current_setting('bench.company_id'))),
  'approval_queue_submitted', bench.ms(format('select id, title, submitted_at from public.expense_claims where company_id = %L and status = ''submitted'' order by submitted_at asc limit 50', current_setting('bench.company_id'))),
  'payout_waiting', bench.ms(format('select id, title, approved_at from public.expense_claims where company_id = %L and status = ''approved'' and settlement_required order by approved_at asc limit 50', current_setting('bench.company_id'))),
  'pending_count', bench.ms(format('select count(*) from public.expense_claims where company_id = %L and status = ''submitted''', current_setting('bench.company_id'))),
  'month_items_sum', bench.ms(format('select count(*), sum(amount) from public.expense_items where company_id = %L and expense_date >= date_trunc(''month'', current_date)::date', current_setting('bench.company_id'))),
  'tax_close_month_items', bench.ms(format('select i.id, i.amount, i.receipt_path from public.expense_items i join public.expense_claims c on c.id = i.claim_id where i.company_id = %L and i.expense_date >= (date_trunc(''month'', current_date) - interval ''1 month'')::date and i.expense_date < date_trunc(''month'', current_date)::date and c.status in (''approved'', ''paid'')', current_setting('bench.company_id'))),
  'claim_detail_items', bench.ms(format('select * from public.expense_items where company_id = %L and claim_id = %L', current_setting('bench.company_id'), current_setting('bench.claim_id'))),
  'members_all', bench.ms(format('select id, name, status from public.members where company_id = %L', current_setting('bench.company_id'))),
  'receipt_policy_check', bench.ms(format('select 1 from public.expense_items i where i.receipt_path = %L and i.company_id = %L', current_setting('bench.receipt'), current_setting('bench.company_id'))),
  'thumb_policy_check', bench.ms(format('select 1 from public.expense_items i where i.receipt_thumb_path = %L and i.company_id = %L', current_setting('bench.thumb'), current_setting('bench.company_id'))),
  'visible_claims', (select count(*) from public.expense_claims),
  'visible_items', (select count(*) from public.expense_items)
)::text, true);
reset role;

-- 직원 관점
select set_config('request.jwt.claims', json_build_object('sub', current_setting('bench.emp_uid'), 'role', 'authenticated')::text, true);
set local role authenticated;
select set_config('bench.r_emp', json_build_object(
  'my_claims_page_20', bench.ms(format('select id, title, status, total_amount from public.expense_claims where company_id = %L and member_id = %L order by created_at desc, id desc limit 20', current_setting('bench.company_id'), current_setting('bench.emp_id'))),
  'my_unpaid_sum', bench.ms(format('select count(*), sum(total_amount) from public.expense_claims where company_id = %L and member_id = %L and status = ''approved''', current_setting('bench.company_id'), current_setting('bench.emp_id'))),
  'my_claim_detail_items', bench.ms(format('select * from public.expense_items where company_id = %L and claim_id = %L', current_setting('bench.company_id'), current_setting('bench.claim_id'))),
  'visible_claims', (select count(*) from public.expense_claims),
  'visible_items', (select count(*) from public.expense_items)
)::text, true);
reset role;

-- 사전 검토자 관점 (결재함)
select set_config('request.jwt.claims', json_build_object('sub', current_setting('bench.reviewer_uid'), 'role', 'authenticated')::text, true);
set local role authenticated;
select set_config('bench.r_reviewer', json_build_object(
  'review_inbox', bench.ms(format('select a.claim_id, a.step_order from public.claim_approvals a where a.company_id = %L and a.approver_member_id = %L and a.status = ''pending'' limit 50', current_setting('bench.company_id'), current_setting('bench.reviewer_id'))),
  'visible_claims', (select count(*) from public.expense_claims)
)::text, true);
reset role;

select current_setting('bench.r_admin')::json as admin, current_setting('bench.r_emp')::json as employee, current_setting('bench.r_reviewer')::json as reviewer,
       (select count(*) from public.expense_claims) as total_claims, (select count(*) from public.expense_items) as total_items;
rollback;
