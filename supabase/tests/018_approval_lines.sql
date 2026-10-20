-- =============================================================================
-- 018_approval_lines.sql — 사전 검토 결재라인 설정·사전 검토 결재 (T4, migration 034)
-- 회사 A: 대표 a_sup, 관리자 a_adm, 팀장 a_lead(직원), 영업팀 직원 a_e1, 다른 팀 직원 a_e2. 회사 B: 대표 b_sup(다른 회사 직원 b_e1)
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
from unnest(array['a5100000-0000-0000-0000-000000000001', 'a5100000-0000-0000-0000-000000000002', 'a5100000-0000-0000-0000-000000000003', 'a5100000-0000-0000-0000-000000000004', 'a5100000-0000-0000-0000-000000000005', 'b5100000-0000-0000-0000-000000000001', 'b5100000-0000-0000-0000-000000000002']::uuid[]) u;
insert into public.companies (id, name, invite_code, business_number) values
  ('c5100000-0000-0000-0000-00000000000a', '결재회사A', 'APRAAAAA', '1000000511'),
  ('c5100000-0000-0000-0000-00000000000b', '결재회사B', 'APRBBBBB', '1000000512');
insert into public.departments (id, company_id, name) values
  ('d5100000-0000-0000-0000-000000000001', 'c5100000-0000-0000-0000-00000000000a', '영업팀'),
  ('d5100000-0000-0000-0000-000000000002', 'c5100000-0000-0000-0000-00000000000a', '개발팀'),
  ('d5100000-0000-0000-0000-000000000009', 'c5100000-0000-0000-0000-00000000000b', 'B팀');
insert into public.approval_lines (company_id, name) values ('c5100000-0000-0000-0000-00000000000a', '기본 결재라인'), ('c5100000-0000-0000-0000-00000000000b', '기본 결재라인');
insert into public.members (id, auth_user_id, company_id, name, phone, role, status, privacy_agreed_at, department_id) values
  ('a5200000-0000-0000-0000-000000000001', 'a5100000-0000-0000-0000-000000000001', 'c5100000-0000-0000-0000-00000000000a', 'A대표', '01096501000', 'super_admin', 'approved', now(), null),
  ('a5200000-0000-0000-0000-000000000002', 'a5100000-0000-0000-0000-000000000002', 'c5100000-0000-0000-0000-00000000000a', 'A관리자', '01096501001', 'admin', 'approved', now(), null),
  ('a5200000-0000-0000-0000-000000000003', 'a5100000-0000-0000-0000-000000000003', 'c5100000-0000-0000-0000-00000000000a', '박팀장', '01096501002', 'employee', 'approved', now(), 'd5100000-0000-0000-0000-000000000001'),
  ('a5200000-0000-0000-0000-000000000004', 'a5100000-0000-0000-0000-000000000004', 'c5100000-0000-0000-0000-00000000000a', '영업직원', '01096501003', 'employee', 'approved', now(), 'd5100000-0000-0000-0000-000000000001'),
  ('a5200000-0000-0000-0000-000000000005', 'a5100000-0000-0000-0000-000000000005', 'c5100000-0000-0000-0000-00000000000a', '개발직원', '01096501004', 'employee', 'approved', now(), 'd5100000-0000-0000-0000-000000000002'),
  ('b5200000-0000-0000-0000-000000000001', 'b5100000-0000-0000-0000-000000000001', 'c5100000-0000-0000-0000-00000000000b', 'B대표', '01097501000', 'super_admin', 'approved', now(), null),
  ('b5200000-0000-0000-0000-000000000002', 'b5100000-0000-0000-0000-000000000002', 'c5100000-0000-0000-0000-00000000000b', 'B직원', '01097501001', 'employee', 'approved', now(), null);
insert into public.expense_claims (id, company_id, member_id, title, description) values
  ('a5300000-0000-0000-0000-000000000001', 'c5100000-0000-0000-0000-00000000000a', 'a5200000-0000-0000-0000-000000000004', '영업 식대', '거래처 미팅 후 식사'),
  ('a5300000-0000-0000-0000-000000000002', 'c5100000-0000-0000-0000-00000000000a', 'a5200000-0000-0000-0000-000000000005', '개발 식대', '야근 식사'),
  ('a5300000-0000-0000-0000-000000000003', 'c5100000-0000-0000-0000-00000000000a', 'a5200000-0000-0000-0000-000000000003', '팀장 본인 식대', '팀 회의 식사');
insert into public.expense_items (claim_id, company_id, sort_order, category, payment_method, evidence_type, expense_date, amount, headcount, receipt_path)
select c, 'c5100000-0000-0000-0000-00000000000a', 1, 'meal', 'personal_card', 'card_slip', '2026-10-15', 9000, 1, 'c5100000-0000-0000-0000-00000000000a/x/' || c || '/1.jpg'
from unnest(array['a5300000-0000-0000-0000-000000000001', 'a5300000-0000-0000-0000-000000000002', 'a5300000-0000-0000-0000-000000000003']::uuid[]) c;

-- ── 결재라인 저장 권한·검사 ───────────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"a5100000-0000-0000-0000-000000000004","role":"authenticated"}', true);
set local role authenticated;
select public._t_expect($q$select public.save_approval_line(null, array['a5200000-0000-0000-0000-000000000003'::uuid])$q$, 'NOT_ALLOWED', 'employee save');
reset role;
select set_config('request.jwt.claims', '{"sub":"a5100000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select public._t_expect($q$select public.save_approval_line('d5100000-0000-0000-0000-000000000001', array['b5200000-0000-0000-0000-000000000002'::uuid])$q$, 'INVALID_REVIEWER', 'other company reviewer');
select public._t_expect($q$select public.save_approval_line('d5100000-0000-0000-0000-000000000009', array['a5200000-0000-0000-0000-000000000003'::uuid])$q$, 'NOT_FOUND', 'other company department');
select public._t_expect($q$select public.save_approval_line('d5100000-0000-0000-0000-000000000001', array['a5200000-0000-0000-0000-000000000003'::uuid, 'a5200000-0000-0000-0000-000000000003'::uuid])$q$, 'DUPLICATE_REVIEWER', 'duplicate');
select public._t_expect($q$select public.save_approval_line(null, array['a5200000-0000-0000-0000-000000000001'::uuid, 'a5200000-0000-0000-0000-000000000002'::uuid, 'a5200000-0000-0000-0000-000000000003'::uuid, 'a5200000-0000-0000-0000-000000000004'::uuid, 'a5200000-0000-0000-0000-000000000005'::uuid])$q$, 'TOO_MANY_REVIEWERS', 'five');
do $$
begin
  -- 영업팀: 박팀장 검토 → 관리자 승인 (두 번 저장해도 한 줄)
  perform public.save_approval_line('d5100000-0000-0000-0000-000000000001', array['a5200000-0000-0000-0000-000000000002'::uuid]);
  perform public.save_approval_line('d5100000-0000-0000-0000-000000000001', array['a5200000-0000-0000-0000-000000000003'::uuid]);
  if (select count(*) from public.approval_lines where department_id = 'd5100000-0000-0000-0000-000000000001') <> 1 then raise exception 'FAIL line duplicated'; end if;
  if (select string_agg(approver_member_id::text, ',' order by step_order) from public.approval_line_steps s join public.approval_lines l on l.id = s.approval_line_id where l.department_id = 'd5100000-0000-0000-0000-000000000001')
     <> 'a5200000-0000-0000-0000-000000000003' then raise exception 'FAIL steps replaced'; end if;
  -- 개발팀 라인을 만들었다가 0명으로 저장하면 지워져 기본 결재라인을 따른다
  perform public.save_approval_line('d5100000-0000-0000-0000-000000000002', array['a5200000-0000-0000-0000-000000000003'::uuid]);
  perform public.save_approval_line('d5100000-0000-0000-0000-000000000002', '{}');
  if exists (select 1 from public.approval_lines where department_id = 'd5100000-0000-0000-0000-000000000002') then raise exception 'FAIL empty dept line kept'; end if;
end $$;
reset role;

-- B 대표는 A 회사 결재라인을 볼 수 없다
select set_config('request.jwt.claims', '{"sub":"b5100000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
do $$ begin if (select count(*) from public.approval_line_steps) <> 0 or (select count(*) from public.approval_lines where company_id = 'c5100000-0000-0000-0000-00000000000a') <> 0 then raise exception 'FAIL [B] sees A lines'; end if; end $$;
reset role;

-- ── 영업직원 상신 → 박팀장 검토 차례, 관리자는 아직 승인 불가 ──────────────────────────
select set_config('request.jwt.claims', '{"sub":"a5100000-0000-0000-0000-000000000004","role":"authenticated"}', true);
set local role authenticated;
do $$ begin if public.submit_claim('a5300000-0000-0000-0000-000000000001') <> 'submitted' then raise exception 'FAIL submit'; end if; end $$;
reset role;
select set_config('request.jwt.claims', '{"sub":"a5100000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select public._t_expect($q$select public.approve_claim('a5300000-0000-0000-0000-000000000001')$q$, 'NOT_ALLOWED', 'admin during review');
reset role;
-- 다른 직원(검토자 아님)은 볼 수도 처리할 수도 없다
select set_config('request.jwt.claims', '{"sub":"a5100000-0000-0000-0000-000000000005","role":"authenticated"}', true);
set local role authenticated;
do $$ begin if exists (select 1 from public.expense_claims where id = 'a5300000-0000-0000-0000-000000000001') then raise exception 'FAIL other employee sees claim'; end if; end $$;
select public._t_expect($q$select public.approve_claim('a5300000-0000-0000-0000-000000000001')$q$, 'NOT_ALLOWED', 'other employee approve');
reset role;
-- 박팀장: 볼 수 있고, 검토 승인하면 관리자 차례
select set_config('request.jwt.claims', '{"sub":"a5100000-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  if not exists (select 1 from public.expense_claims where id = 'a5300000-0000-0000-0000-000000000001') then raise exception 'FAIL reviewer cannot see'; end if;
  if public.approve_claim('a5300000-0000-0000-0000-000000000001', '확인했습니다') <> 'submitted' then raise exception 'FAIL review approve'; end if;
end $$;
select public._t_expect($q$select public.approve_claim('a5300000-0000-0000-0000-000000000001')$q$, 'NOT_ALLOWED', 'reviewer final');
reset role;
select set_config('request.jwt.claims', '{"sub":"a5100000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
do $$ begin if public.approve_claim('a5300000-0000-0000-0000-000000000001') <> 'approved' then raise exception 'FAIL final approve'; end if; end $$;
reset role;

-- 개발직원(부서 라인 없음) → 기본 결재라인(직통): 바로 관리자 차례
select set_config('request.jwt.claims', '{"sub":"a5100000-0000-0000-0000-000000000005","role":"authenticated"}', true);
set local role authenticated;
do $$ begin perform public.submit_claim('a5300000-0000-0000-0000-000000000002'); end $$;
reset role;
do $$
begin
  if (select string_agg(step_kind::text || ':' || status::text, ',' order by step_order) from public.claim_approvals where claim_id = 'a5300000-0000-0000-0000-000000000002') <> 'final:pending' then raise exception 'FAIL default line'; end if;
end $$;

-- 박팀장 본인 소명서: 본인 검토 단계는 건너뛰고 관리자 차례
select set_config('request.jwt.claims', '{"sub":"a5100000-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
do $$ begin perform public.submit_claim('a5300000-0000-0000-0000-000000000003'); end $$;
reset role;
do $$
begin
  if (select string_agg(step_kind::text || ':' || status::text, ',' order by step_order) from public.claim_approvals where claim_id = 'a5300000-0000-0000-0000-000000000003') <> 'review:skipped,final:pending' then raise exception 'FAIL self skip'; end if;
end $$;

-- 검토자가 비활성이면 상신을 막는다
update public.members set status = 'inactive' where id = 'a5200000-0000-0000-0000-000000000003';
update public.expense_claims set status = 'rejected' where id = 'a5300000-0000-0000-0000-000000000001';
select set_config('request.jwt.claims', '{"sub":"a5100000-0000-0000-0000-000000000004","role":"authenticated"}', true);
set local role authenticated;
select public._t_expect($q$select public.submit_claim('a5300000-0000-0000-0000-000000000001')$q$, 'INACTIVE_REVIEWER', 'inactive reviewer');
reset role;

select 'APPROVAL_LINES_OK' as result;
rollback;
