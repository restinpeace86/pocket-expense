-- =============================================================================
-- 004_member_admin.sql — 가입 승인·거절·초대 코드 재발급 격리 테스트 (T3)
-- 회사 A(대표 a_sup, 직원 a_emp, 대기 a_p1·a_p2), 회사 B(대표 b_sup, 대기 b_p1)
-- =============================================================================
begin;

insert into auth.users (id, instance_id, aud, role, email)
select u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u::text || '@test.local'
from unnest(array[
  'aa000000-0000-0000-0000-000000000001', 'aa000000-0000-0000-0000-000000000002', 'aa000000-0000-0000-0000-000000000003',
  'aa000000-0000-0000-0000-000000000004', 'bb000000-0000-0000-0000-000000000001', 'bb000000-0000-0000-0000-000000000002'
]::uuid[]) u;
insert into public.companies (id, name, invite_code, business_number) values
  ('ca000000-0000-0000-0000-000000000000', '승인회사A', 'APPRVAAA', '1000000011'),
  ('cb000000-0000-0000-0000-000000000000', '승인회사B', 'APPRVBBB', '1000000012');
insert into public.members (id, auth_user_id, company_id, name, phone, role, status, privacy_agreed_at) values
  ('a9000000-0000-0000-0000-000000000001', 'aa000000-0000-0000-0000-000000000001', 'ca000000-0000-0000-0000-000000000000', 'A대표', '01010001000', 'super_admin', 'approved', now()),
  ('a9000000-0000-0000-0000-000000000002', 'aa000000-0000-0000-0000-000000000002', 'ca000000-0000-0000-0000-000000000000', 'A직원', '01010001001', 'employee', 'approved', now()),
  ('a9000000-0000-0000-0000-000000000003', 'aa000000-0000-0000-0000-000000000003', 'ca000000-0000-0000-0000-000000000000', 'A대기1', '01010001002', 'employee', 'pending', now()),
  ('a9000000-0000-0000-0000-000000000004', 'aa000000-0000-0000-0000-000000000004', 'ca000000-0000-0000-0000-000000000000', 'A대기2', '01010001003', 'employee', 'pending', now()),
  ('b9000000-0000-0000-0000-000000000001', 'bb000000-0000-0000-0000-000000000001', 'cb000000-0000-0000-0000-000000000000', 'B대표', '01020001000', 'super_admin', 'approved', now()),
  ('b9000000-0000-0000-0000-000000000002', 'bb000000-0000-0000-0000-000000000002', 'cb000000-0000-0000-0000-000000000000', 'B대기', '01020001001', 'employee', 'pending', now());
insert into public.member_bank_accounts (member_id, company_id, bank_name, account_number, account_holder)
values ('a9000000-0000-0000-0000-000000000004', 'ca000000-0000-0000-0000-000000000000', '은행', '1', 'A대기2');

-- B 대표: A의 대기자를 승인·거절할 수 없고, 자기 회사 코드만 바뀐다
select set_config('request.jwt.claims', '{"sub":"bb000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
do $$
declare v_ok boolean;
begin
  begin perform public.approve_member('a9000000-0000-0000-0000-000000000003'); v_ok := false;
  exception when others then v_ok := sqlerrm = 'NOT_FOUND'; end;
  if not v_ok then raise exception 'FAIL [B_SUP] approved A pending member'; end if;
  begin perform public.reject_member('a9000000-0000-0000-0000-000000000003'); v_ok := false;
  exception when others then v_ok := sqlerrm = 'NOT_FOUND'; end;
  if not v_ok then raise exception 'FAIL [B_SUP] rejected A pending member'; end if;
  perform public.regenerate_invite_code();
end $$;
reset role;
do $$
begin
  if (select status from public.members where id = 'a9000000-0000-0000-0000-000000000003') <> 'pending' then raise exception 'FAIL [B_SUP] A member changed'; end if;
  if (select invite_code from public.companies where id = 'ca000000-0000-0000-0000-000000000000') <> 'APPRVAAA' then raise exception 'FAIL [B_SUP] changed A invite code'; end if;
  if (select invite_code from public.companies where id = 'cb000000-0000-0000-0000-000000000000') = 'APPRVBBB' then raise exception 'FAIL [B_SUP] own invite code not regenerated'; end if;
end $$;

-- A 직원: 승인·거절·재발급 불가
select set_config('request.jwt.claims', '{"sub":"aa000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
do $$
declare v_ok boolean;
begin
  begin perform public.approve_member('a9000000-0000-0000-0000-000000000003'); v_ok := false;
  exception when others then v_ok := sqlerrm = 'NOT_ALLOWED'; end;
  if not v_ok then raise exception 'FAIL [A_EMP] employee approved member'; end if;
  begin perform public.regenerate_invite_code(); v_ok := false;
  exception when others then v_ok := sqlerrm = 'NOT_ALLOWED'; end;
  if not v_ok then raise exception 'FAIL [A_EMP] employee regenerated invite code'; end if;
end $$;
reset role;

-- 승인 대기 멤버 본인: 다른 대기자를 승인할 수 없다(승인된 멤버가 아님)
select set_config('request.jwt.claims', '{"sub":"aa000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
do $$
declare v_ok boolean;
begin
  begin perform public.approve_member('a9000000-0000-0000-0000-000000000003'); v_ok := false;
  exception when others then v_ok := sqlerrm = 'NOT_A_MEMBER'; end;
  if not v_ok then raise exception 'FAIL [A_P1] pending member self-approved'; end if;
end $$;
reset role;

-- A 대표: 승인·거절·재발급
select set_config('request.jwt.claims', '{"sub":"aa000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
do $$
declare v_ok boolean; v_code text;
begin
  perform public.approve_member('a9000000-0000-0000-0000-000000000003');
  begin perform public.approve_member('a9000000-0000-0000-0000-000000000003'); v_ok := false;
  exception when others then v_ok := sqlerrm = 'NOT_PENDING'; end;
  if not v_ok then raise exception 'FAIL [A_SUP] approved twice'; end if;
  begin perform public.reject_member('a9000000-0000-0000-0000-000000000002'); v_ok := false;
  exception when others then v_ok := sqlerrm = 'NOT_PENDING'; end;
  if not v_ok then raise exception 'FAIL [A_SUP] rejected an approved member'; end if;
  begin perform public.approve_member('b9000000-0000-0000-0000-000000000002'); v_ok := false;
  exception when others then v_ok := sqlerrm = 'NOT_FOUND'; end;
  if not v_ok then raise exception 'FAIL [A_SUP] approved B pending member'; end if;

  perform public.reject_member('a9000000-0000-0000-0000-000000000004');
  v_code := public.regenerate_invite_code();
  if v_code !~ '^[A-HJ-NP-Z2-9]{8}$' or v_code = 'APPRVAAA' then raise exception 'FAIL [A_SUP] bad regenerated code %', v_code; end if;
end $$;
reset role;

do $$
begin
  if (select status from public.members where id = 'a9000000-0000-0000-0000-000000000003') <> 'approved'
     or (select approved_at from public.members where id = 'a9000000-0000-0000-0000-000000000003') is null then
    raise exception 'FAIL [FINAL] approve not stored';
  end if;
  if exists (select 1 from public.members where id = 'a9000000-0000-0000-0000-000000000004')
     or exists (select 1 from public.member_bank_accounts where member_id = 'a9000000-0000-0000-0000-000000000004') then
    raise exception 'FAIL [FINAL] rejected member or bank account remains';
  end if;
  if (select status from public.members where id = 'b9000000-0000-0000-0000-000000000002') <> 'pending' then raise exception 'FAIL [FINAL] B member changed'; end if;
end $$;

select 'MEMBER_ADMIN_OK' as result;
rollback;
