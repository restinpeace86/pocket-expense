-- =============================================================================
-- 005_member_management.sql — 멤버 편집·역할 변경·최고 관리자 넘기기·비활성화·부서 관리 권한/격리 테스트 (T3-4, T3-3)
-- 회사 A(대표 a_sup, 관리자 a_adm·a_adm2, 직원 a_e1·a_e2·a_e3), 회사 B(대표 b_sup, 직원 b_e1)
-- a_e2는 A 결재라인 사전 검토자 → 비활성화 차단 대상
-- =============================================================================
begin;

-- 오류 기대 헬퍼 (트랜잭션과 함께 롤백된다)
create function public._t_expect(p_sql text, p_code text, p_label text)
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
from unnest(array[
  'ae000000-0000-0000-0000-000000000001', 'ae000000-0000-0000-0000-000000000002', 'ae000000-0000-0000-0000-000000000003',
  'ae000000-0000-0000-0000-000000000004', 'ae000000-0000-0000-0000-000000000005', 'ae000000-0000-0000-0000-000000000006',
  'be000000-0000-0000-0000-000000000001', 'be000000-0000-0000-0000-000000000002'
]::uuid[]) u;
insert into public.companies (id, name, invite_code, business_number) values
  ('cc000000-0000-0000-0000-000000000000', '관리회사A', 'MGMTAAAA', '1000000021'),
  ('cd000000-0000-0000-0000-000000000000', '관리회사B', 'MGMTBBBB', '1000000022');
insert into public.departments (id, company_id, name) values
  ('dc000000-0000-0000-0000-000000000001', 'cc000000-0000-0000-0000-000000000000', 'A개발'),
  ('dc000000-0000-0000-0000-000000000002', 'cc000000-0000-0000-0000-000000000000', 'A영업'),
  ('dd000000-0000-0000-0000-000000000001', 'cd000000-0000-0000-0000-000000000000', 'B개발');
insert into public.members (id, auth_user_id, company_id, name, phone, role, status, department_id, privacy_agreed_at) values
  ('ac000000-0000-0000-0000-000000000001', 'ae000000-0000-0000-0000-000000000001', 'cc000000-0000-0000-0000-000000000000', 'A대표', '01030001000', 'super_admin', 'approved', null, now()),
  ('ac000000-0000-0000-0000-000000000002', 'ae000000-0000-0000-0000-000000000002', 'cc000000-0000-0000-0000-000000000000', 'A관리', '01030001001', 'admin', 'approved', null, now()),
  ('ac000000-0000-0000-0000-000000000003', 'ae000000-0000-0000-0000-000000000003', 'cc000000-0000-0000-0000-000000000000', 'A관리2', '01030001002', 'admin', 'approved', null, now()),
  ('ac000000-0000-0000-0000-000000000004', 'ae000000-0000-0000-0000-000000000004', 'cc000000-0000-0000-0000-000000000000', 'A직원1', '01030001003', 'employee', 'approved', 'dc000000-0000-0000-0000-000000000001', now()),
  ('ac000000-0000-0000-0000-000000000005', 'ae000000-0000-0000-0000-000000000005', 'cc000000-0000-0000-0000-000000000000', 'A직원2', '01030001004', 'employee', 'approved', 'dc000000-0000-0000-0000-000000000001', now()),
  ('ac000000-0000-0000-0000-000000000006', 'ae000000-0000-0000-0000-000000000006', 'cc000000-0000-0000-0000-000000000000', 'A직원3', '01030001005', 'employee', 'approved', 'dc000000-0000-0000-0000-000000000002', now()),
  ('bc000000-0000-0000-0000-000000000001', 'be000000-0000-0000-0000-000000000001', 'cd000000-0000-0000-0000-000000000000', 'B대표', '01040001000', 'super_admin', 'approved', null, now()),
  ('bc000000-0000-0000-0000-000000000002', 'be000000-0000-0000-0000-000000000002', 'cd000000-0000-0000-0000-000000000000', 'B직원', '01040001001', 'employee', 'approved', 'dd000000-0000-0000-0000-000000000001', now());
insert into public.approval_lines (id, company_id, name) values
  ('a1000000-0000-0000-0000-000000000001', 'cc000000-0000-0000-0000-000000000000', '기본');
insert into public.approval_line_steps (approval_line_id, company_id, step_order, approver_member_id) values
  ('a1000000-0000-0000-0000-000000000001', 'cc000000-0000-0000-0000-000000000000', 1, 'ac000000-0000-0000-0000-000000000005');

-- ── B 대표: A 멤버·A 부서를 어떤 방식으로도 건드릴 수 없다 ───────────────────────────
select set_config('request.jwt.claims', '{"sub":"be000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select public._t_expect($q$select public.update_member('ac000000-0000-0000-0000-000000000004', '해킹', '01099998888', null, null, null)$q$, 'NOT_FOUND', 'B_SUP update A');
select public._t_expect($q$select public.set_member_role('ac000000-0000-0000-0000-000000000004', 'admin')$q$, 'NOT_FOUND', 'B_SUP role A');
select public._t_expect($q$select public.transfer_super_admin('ac000000-0000-0000-0000-000000000004')$q$, 'NOT_FOUND', 'B_SUP transfer A');
select public._t_expect($q$select public.deactivate_member('ac000000-0000-0000-0000-000000000004')$q$, 'NOT_FOUND', 'B_SUP deactivate A');
select public._t_expect($q$select public.member_deactivation_check('ac000000-0000-0000-0000-000000000004')$q$, 'NOT_FOUND', 'B_SUP check A');
select public._t_expect($q$select public.update_member('bc000000-0000-0000-0000-000000000002', 'B직원', '01040001001', 'dc000000-0000-0000-0000-000000000001', null, null)$q$, 'INVALID_DEPARTMENT', 'B_SUP assign A dept');
select public._t_expect($q$insert into public.departments (company_id, name) values ('cc000000-0000-0000-0000-000000000000', '침투')$q$,
  'new row violates row-level security policy for table "departments"', 'B_SUP insert A dept');
do $$
declare n integer;
begin
  update public.departments set name = '변조' where id = 'dc000000-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL [B_SUP] updated A dept'; end if;
  delete from public.departments where id = 'dc000000-0000-0000-0000-000000000002';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL [B_SUP] deleted A dept'; end if;
  if (select count(*) from public.departments) <> 1 then raise exception 'FAIL [B_SUP] sees other company departments'; end if;
  -- 자기 회사 부서는 관리할 수 있다
  insert into public.departments (company_id, name, sort_order) values ('cd000000-0000-0000-0000-000000000000', 'B영업', 1);
  update public.departments set name = 'B개발본부' where id = 'dd000000-0000-0000-0000-000000000001';
end $$;
reset role;

-- ── A 관리자: 일반 멤버와 본인만 편집, 역할·넘기기 불가, 관리자·대표 비활성화 불가 ──────
select set_config('request.jwt.claims', '{"sub":"ae000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select public.update_member('ac000000-0000-0000-0000-000000000004', ' 김직원 ', '010-3000-1003', 'dc000000-0000-0000-0000-000000000002', ' 대리 ', 'E-01');
select public.update_member('ac000000-0000-0000-0000-000000000002', 'A관리', '01030001001', null, '과장', null);
select public._t_expect($q$select public.update_member('ac000000-0000-0000-0000-000000000003', 'x', '01030001002', null, null, null)$q$, 'NOT_ALLOWED', 'A_ADM edit admin');
select public._t_expect($q$select public.update_member('ac000000-0000-0000-0000-000000000001', 'x', '01030001000', null, null, null)$q$, 'NOT_ALLOWED', 'A_ADM edit super');
select public._t_expect($q$select public.update_member('ac000000-0000-0000-0000-000000000004', '', '01030001003', null, null, null)$q$, 'INVALID_NAME', 'A_ADM empty name');
select public._t_expect($q$select public.update_member('ac000000-0000-0000-0000-000000000004', 'x', '123', null, null, null)$q$, 'INVALID_PHONE', 'A_ADM bad phone');
select public._t_expect($q$select public.set_member_role('ac000000-0000-0000-0000-000000000004', 'admin')$q$, 'NOT_ALLOWED', 'A_ADM set role');
select public._t_expect($q$select public.transfer_super_admin('ac000000-0000-0000-0000-000000000002')$q$, 'NOT_ALLOWED', 'A_ADM transfer');
select public._t_expect($q$select public.deactivate_member('ac000000-0000-0000-0000-000000000003')$q$, 'NOT_ALLOWED', 'A_ADM deactivate admin');
select public._t_expect($q$select public.deactivate_member('ac000000-0000-0000-0000-000000000001')$q$, 'SUPER_ADMIN_LOCKED', 'A_ADM deactivate super');
select public._t_expect($q$select public.deactivate_member('ac000000-0000-0000-0000-000000000005')$q$, 'MEMBER_IN_APPROVAL_LINE', 'A_ADM deactivate reviewer');
do $$
declare v jsonb := public.member_deactivation_check('ac000000-0000-0000-0000-000000000005');
begin
  if (v->>'blocked')::boolean is not true or (v->>'approval_line_steps')::int <> 1 then raise exception 'FAIL [A_ADM] check not blocked: %', v; end if;
  v := public.member_deactivation_check('ac000000-0000-0000-0000-000000000004');
  if (v->>'blocked')::boolean is not false then raise exception 'FAIL [A_ADM] check wrongly blocked: %', v; end if;
end $$;
select public.deactivate_member('ac000000-0000-0000-0000-000000000004');
select public._t_expect($q$select public.deactivate_member('ac000000-0000-0000-0000-000000000004')$q$, 'NOT_APPROVED', 'A_ADM deactivate twice');
reset role;

-- ── A 직원: 멤버 편집·부서 관리 불가 ────────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"ae000000-0000-0000-0000-000000000006","role":"authenticated"}', true);
set local role authenticated;
select public._t_expect($q$select public.update_member('ac000000-0000-0000-0000-000000000005', 'x', '01030001004', null, null, null)$q$, 'NOT_ALLOWED', 'A_EMP edit');
select public._t_expect($q$select public.member_deactivation_check('ac000000-0000-0000-0000-000000000005')$q$, 'NOT_ALLOWED', 'A_EMP check');
select public._t_expect($q$insert into public.departments (company_id, name) values ('cc000000-0000-0000-0000-000000000000', '직원부서')$q$,
  'new row violates row-level security policy for table "departments"', 'A_EMP insert dept');
reset role;

-- ── 비활성화된 A 직원1: 회사 데이터를 볼 수 없고 관리 함수도 쓸 수 없다 ───────────────
select set_config('request.jwt.claims', '{"sub":"ae000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  if (select count(*) from public.departments) <> 0 then raise exception 'FAIL [A_INACTIVE] sees departments'; end if;
  if (select count(*) from public.members) <> 1 then raise exception 'FAIL [A_INACTIVE] sees other members'; end if;
end $$;
select public._t_expect($q$select public.update_member('ac000000-0000-0000-0000-000000000005', 'x', '01030001004', null, null, null)$q$, 'NOT_A_MEMBER', 'A_INACTIVE edit');
reset role;

-- ── A 대표: 역할 변경·넘기기 ─────────────────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"ae000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select public._t_expect($q$select public.set_member_role('ac000000-0000-0000-0000-000000000001', 'employee')$q$, 'SUPER_ADMIN_LOCKED', 'A_SUP demote self');
select public._t_expect($q$select public.set_member_role('ac000000-0000-0000-0000-000000000006', 'super_admin')$q$, 'INVALID_ROLE', 'A_SUP role super');
select public._t_expect($q$select public.set_member_role('ac000000-0000-0000-0000-000000000004', 'admin')$q$, 'NOT_APPROVED', 'A_SUP promote inactive');
select public._t_expect($q$select public.deactivate_member('ac000000-0000-0000-0000-000000000001')$q$, 'SUPER_ADMIN_LOCKED', 'A_SUP deactivate self');
select public._t_expect($q$select public.transfer_super_admin('ac000000-0000-0000-0000-000000000001')$q$, 'INVALID_TARGET', 'A_SUP transfer self');
select public._t_expect($q$select public.transfer_super_admin('bc000000-0000-0000-0000-000000000002')$q$, 'NOT_FOUND', 'A_SUP transfer to B');
select public.set_member_role('ac000000-0000-0000-0000-000000000006', 'admin');
select public.set_member_role('ac000000-0000-0000-0000-000000000003', 'employee');
select public.update_member('ac000000-0000-0000-0000-000000000002', 'A관리', '01030001001', 'dc000000-0000-0000-0000-000000000001', '부장', null);
select public.transfer_super_admin('ac000000-0000-0000-0000-000000000002');
-- 넘긴 뒤에는 관리자 권한만 남는다
select public._t_expect($q$select public.set_member_role('ac000000-0000-0000-0000-000000000003', 'admin')$q$, 'NOT_ALLOWED', 'A_SUP after transfer');
reset role;

do $$
begin
  if (select count(*) from public.members where company_id = 'cc000000-0000-0000-0000-000000000000' and role = 'super_admin') <> 1
     or (select role from public.members where id = 'ac000000-0000-0000-0000-000000000002') <> 'super_admin'
     or (select role from public.members where id = 'ac000000-0000-0000-0000-000000000001') <> 'admin' then
    raise exception 'FAIL [FINAL] transfer not applied';
  end if;
  if (select role from public.members where id = 'ac000000-0000-0000-0000-000000000006') <> 'admin'
     or (select role from public.members where id = 'ac000000-0000-0000-0000-000000000003') <> 'employee' then
    raise exception 'FAIL [FINAL] role change not applied';
  end if;
  if (select row(name, phone, department_id, position, employee_number, status)::text from public.members where id = 'ac000000-0000-0000-0000-000000000004')
     <> row('김직원', '01030001003', 'dc000000-0000-0000-0000-000000000002'::uuid, '대리', 'E-01', 'inactive'::public.member_status)::text then
    raise exception 'FAIL [FINAL] edit/deactivate not stored';
  end if;
  if (select name from public.departments where id = 'dc000000-0000-0000-0000-000000000001') <> 'A개발'
     or not exists (select 1 from public.departments where id = 'dc000000-0000-0000-0000-000000000002') then
    raise exception 'FAIL [FINAL] A departments changed by B';
  end if;
  if (select role from public.members where id = 'bc000000-0000-0000-0000-000000000001') <> 'super_admin'
     or (select name from public.members where id = 'bc000000-0000-0000-0000-000000000002') <> 'B직원' then
    raise exception 'FAIL [FINAL] B members changed';
  end if;
end $$;

-- 부서 삭제: 소속 멤버는 부서 없음(회사는 그대로), 부서별 결재라인은 함께 삭제
insert into public.approval_lines (company_id, name, department_id) values ('cc000000-0000-0000-0000-000000000000', 'A영업 라인', 'dc000000-0000-0000-0000-000000000002');
select set_config('request.jwt.claims', '{"sub":"ae000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
delete from public.departments where id = 'dc000000-0000-0000-0000-000000000002';
reset role;
do $$
begin
  if (select row(department_id, company_id)::text from public.members where id = 'ac000000-0000-0000-0000-000000000006')
     <> row(null::uuid, 'cc000000-0000-0000-0000-000000000000'::uuid)::text then
    raise exception 'FAIL [DEPT] member department not cleared or company changed';
  end if;
  if exists (select 1 from public.approval_lines where department_id = 'dc000000-0000-0000-0000-000000000002') then
    raise exception 'FAIL [DEPT] department approval line remains';
  end if;
end $$;

-- ── 자가운전보조금 수령 표시 (D-070) ──────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"ae000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
-- 관리자(A관리, 넘기기 후 최고 관리자)가 직원 표시, 인자 없이 편집하면 값 유지
select public.update_member('ac000000-0000-0000-0000-000000000005', 'A직원2', '01030001004', null, null, null, true);
select public.update_member('ac000000-0000-0000-0000-000000000005', 'A직원2', '01030001004', null, '사원', null);
select public._t_expect($q$update public.members set receives_car_allowance = false where id = 'ac000000-0000-0000-0000-000000000005'$q$,
  'permission denied for table members', 'A_ADM direct car allowance');
reset role;
select set_config('request.jwt.claims', '{"sub":"be000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select public._t_expect($q$select public.update_member('ac000000-0000-0000-0000-000000000005', 'x', '01030001004', null, null, null, false)$q$, 'NOT_FOUND', 'B_SUP car allowance A');
reset role;
select set_config('request.jwt.claims', '{"sub":"ae000000-0000-0000-0000-000000000005","role":"authenticated"}', true);
set local role authenticated;
select public._t_expect($q$update public.members set receives_car_allowance = false where auth_user_id = 'ae000000-0000-0000-0000-000000000005'$q$,
  'permission denied for table members', 'A_EMP self car allowance');
reset role;
do $$
begin
  if (select row(receives_car_allowance, position)::text from public.members where id = 'ac000000-0000-0000-0000-000000000005')
     <> row(true, '사원')::text then
    raise exception 'FAIL [CAR] car allowance not stored or reset by edit without it';
  end if;
end $$;

select 'MEMBER_MANAGEMENT_OK' as result;
rollback;
