-- =============================================================================
-- 002_onboarding_isolation.sql — 회사 생성 · 가입 · 초대 수락 격리 테스트 (T2, 릴리스 차단)
-- 등장인물: u_a(회사 A 생성), u_b(회사 B 생성), u_join(A 공용 링크 가입), u_inv(B 개별 초대 수락), u_out(외부인), anon
-- =============================================================================
begin;

insert into auth.users (id, instance_id, aud, role, email) values
  ('a1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'u_a@test.local'),
  ('b1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'u_b@test.local'),
  ('a1000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'u_join@test.local'),
  ('b1000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'u_inv@test.local'),
  ('c1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'u_out@test.local');

-- ---------- u_a: 회사 A 생성 ----------
select set_config('request.jwt.claims', '{"sub":"a1000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select set_config('t.company_a', public.create_company('온보딩회사A', '123-45-67890', array['경영지원', '개발팀', ' 개발팀 ', ''], 'A대표', '010-1234-5678', '경영지원', '대표', true)::text, true);
do $$
declare r record; v_ok boolean; m jsonb;
begin
  m := public.my_membership();
  if m->>'role' <> 'super_admin' or m->>'status' <> 'approved' or m->>'company_id' <> current_setting('t.company_a') then
    raise exception 'FAIL [U_A] membership %', m;
  end if;
  for r in select * from (values
    ('departments(중복·공백 제거)', (select count(*) from public.departments), 2),
    ('approval_lines', (select count(*) from public.approval_lines), 1),
    ('approval_steps(직통)', (select count(*) from public.approval_line_steps), 0),
    ('account_titles', (select count(*) from public.account_titles), 3),
    ('mappings', (select count(*) from public.account_title_mappings), 9),
    ('ledger', (select count(*) from public.credit_ledger), 1),
    ('credits', (select receipt_credits_granted - receipt_credits_used from public.companies), 100)
  ) v(label, actual, expected) loop
    if r.actual <> r.expected then raise exception 'FAIL [U_A] %: expected %, got %', r.label, r.expected, r.actual; end if;
  end loop;
  if (select phone from public.members) <> '01012345678' then raise exception 'FAIL [U_A] phone not normalized'; end if;
  if (select business_number from public.companies) <> '1234567890' then raise exception 'FAIL [U_A] business number not normalized'; end if;

  -- 이미 회사가 있는 계정은 회사를 또 만들 수 없다 (1계정 1회사)
  begin
    perform public.create_company('두번째회사', '1112223334', array['팀'], 'A대표', '01012345678', '팀', null, true);
    v_ok := false;
  exception when others then v_ok := sqlerrm = 'ALREADY_MEMBER';
  end;
  if not v_ok then raise exception 'FAIL [U_A] created a second company'; end if;
end $$;
reset role;

-- ---------- 사업자등록번호 필수 (D-056): 외부인 계정으로 번호 없이 생성 시도 ----------
select set_config('request.jwt.claims', '{"sub":"c1000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
do $$
declare v_ok boolean;
begin
  begin
    perform public.create_company('번호없는회사', null, array['팀'], '외부인', '01011119999', '팀', null, true);
    v_ok := false;
  exception when others then v_ok := sqlerrm = 'INVALID_BUSINESS_NUMBER';
  end;
  if not v_ok then raise exception 'FAIL [BIZNO] created company without business number'; end if;
  begin
    perform public.create_company('짧은번호회사', '12345', array['팀'], '외부인', '01011119999', '팀', null, true);
    v_ok := false;
  exception when others then v_ok := sqlerrm = 'INVALID_BUSINESS_NUMBER';
  end;
  if not v_ok then raise exception 'FAIL [BIZNO] accepted malformed business number'; end if;
end $$;
reset role;
select set_config('request.jwt.claims', '{"sub":"a1000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
do $$ begin null; end $$;
reset role;
select set_config('t.code_a', (select invite_code from public.companies where id = current_setting('t.company_a')::uuid), true);

-- ---------- u_b: 회사 B 생성 + 개별 초대 발행 ----------
select set_config('request.jwt.claims', '{"sub":"b1000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select set_config('t.company_b', public.create_company('온보딩회사B', '2223344445', array['영업팀'], 'B대표', '01098765432', '영업팀', null, true)::text, true);
insert into public.member_invitations (company_id, name, phone, department_id, invited_by_member_id)
select current_setting('t.company_b')::uuid, 'B초대직원', '01055556666',
       (select id from public.departments where name = '영업팀'),
       (public.my_membership()->>'member_id')::uuid;
do $$
begin
  if (select count(*) from public.companies) <> 1 or (select count(*) from public.departments) <> 1 then
    raise exception 'FAIL [U_B] sees other company data';
  end if;
  if exists (select 1 from public.companies where id = current_setting('t.company_a')::uuid) then
    raise exception 'FAIL [U_B] sees company A';
  end if;
end $$;
reset role;
select set_config('t.token_b', (select token from public.member_invitations where company_id = current_setting('t.company_b')::uuid), true);
select set_config('t.dept_b', (select id::text from public.departments where company_id = current_setting('t.company_b')::uuid limit 1), true);
select set_config('t.dept_a', (select id::text from public.departments where company_id = current_setting('t.company_a')::uuid and name = '개발팀'), true);

-- ---------- u_join: A 공용 코드로 가입 ----------
select set_config('request.jwt.claims', '{"sub":"a1000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
do $$
declare v_ok boolean; m jsonb;
begin
  if public.get_invite_company(lower(current_setting('t.code_a'))) <> '온보딩회사A' then raise exception 'FAIL [U_JOIN] invite company name'; end if;
  if (select count(*) from public.get_invite_departments(current_setting('t.code_a'))) <> 2 then raise exception 'FAIL [U_JOIN] invite departments'; end if;
  if public.get_invite_company('ZZZZZZZZ') is not null then raise exception 'FAIL [U_JOIN] unknown code returned a company'; end if;

  -- 다른 회사(B)의 부서로 A에 가입 시도 → 거부
  begin
    perform public.join_company(current_setting('t.code_a'), 'A가입자', '01011112222', current_setting('t.dept_b')::uuid, null, null, null, null, null, null, true);
    v_ok := false;
  exception when others then v_ok := sqlerrm = 'INVALID_DEPARTMENT';
  end;
  if not v_ok then raise exception 'FAIL [U_JOIN] joined A with B department'; end if;
  -- 개인정보 동의 없이 가입 → 거부
  begin
    perform public.join_company(current_setting('t.code_a'), 'A가입자', '01011112222', current_setting('t.dept_a')::uuid, null, null, null, null, null, null, false);
    v_ok := false;
  exception when others then v_ok := sqlerrm = 'PRIVACY_REQUIRED';
  end;
  if not v_ok then raise exception 'FAIL [U_JOIN] joined without privacy consent'; end if;

  perform public.join_company(current_setting('t.code_a'), 'A가입자', '010 1111 2222', current_setting('t.dept_a')::uuid, '사원', null, null, '테스트은행', '123-456', 'A가입자', true);
  m := public.my_membership();
  if m->>'status' <> 'pending' or m->>'company_id' <> current_setting('t.company_a') or m->>'company_name' <> '온보딩회사A' then
    raise exception 'FAIL [U_JOIN] membership %', m;
  end if;
  -- 승인 대기는 자기 멤버 행 외 회사 데이터를 못 본다
  if (select count(*) from public.companies) <> 0 or (select count(*) from public.departments) <> 0
     or (select count(*) from public.members) <> 1 or (select count(*) from public.member_bank_accounts) <> 0 then
    raise exception 'FAIL [U_JOIN] pending member sees company data';
  end if;
  -- 이미 소속이 있으면 다른 회사 가입·초대 수락·회사 생성 불가
  begin
    perform public.accept_invitation(current_setting('t.token_b'), 'x', '01011112222', current_setting('t.dept_b')::uuid, null, null, null, null, null, null, true);
    v_ok := false;
  exception when others then v_ok := sqlerrm = 'ALREADY_MEMBER';
  end;
  if not v_ok then raise exception 'FAIL [U_JOIN] accepted B invitation while member of A'; end if;
end $$;
reset role;

-- ---------- u_a(A 대표): 가입 신청자를 보고, B는 못 본다 ----------
select set_config('request.jwt.claims', '{"sub":"a1000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  if (select count(*) from public.members where status = 'pending') <> 1 then raise exception 'FAIL [U_A] cannot see pending joiner'; end if;
  if (select count(*) from public.member_bank_accounts) <> 1 then raise exception 'FAIL [U_A] cannot see joiner bank account'; end if;
  if (select count(*) from public.member_invitations) <> 0 then raise exception 'FAIL [U_A] sees B invitations'; end if;
  if (select count(*) from public.members where company_id = current_setting('t.company_b')::uuid) <> 0 then raise exception 'FAIL [U_A] sees B members'; end if;
end $$;
reset role;

-- ---------- u_inv: B 개별 초대 수락 ----------
select set_config('request.jwt.claims', '{"sub":"b1000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
do $$
declare v_ok boolean; d jsonb; m jsonb;
begin
  d := public.get_invitation_detail(current_setting('t.token_b'));
  if d->>'company_name' <> '온보딩회사B' or d->>'phone' <> '01055556666' or jsonb_array_length(d->'departments') <> 1 then
    raise exception 'FAIL [U_INV] invitation detail %', d;
  end if;
  -- A 부서로 B 초대 수락 시도 → 거부
  begin
    perform public.accept_invitation(current_setting('t.token_b'), 'B초대직원', '01055556666', current_setting('t.dept_a')::uuid, null, null, null, null, null, null, true);
    v_ok := false;
  exception when others then v_ok := sqlerrm = 'INVALID_DEPARTMENT';
  end;
  if not v_ok then raise exception 'FAIL [U_INV] accepted with A department'; end if;

  perform public.accept_invitation(current_setting('t.token_b'), 'B초대직원', '01055556666', current_setting('t.dept_b')::uuid, null, null, null, null, null, null, true);
  m := public.my_membership();
  if m->>'status' <> 'approved' or m->>'role' <> 'employee' or m->>'company_id' <> current_setting('t.company_b') then
    raise exception 'FAIL [U_INV] membership %', m;
  end if;
  if (select count(*) from public.companies) <> 1 or exists (select 1 from public.companies where id = current_setting('t.company_a')::uuid) then
    raise exception 'FAIL [U_INV] sees company A';
  end if;
end $$;
reset role;

-- ---------- u_out: 이미 사용된 초대 토큰은 무효 ----------
select set_config('request.jwt.claims', '{"sub":"c1000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
do $$
declare v_ok boolean;
begin
  if public.get_invitation_public(current_setting('t.token_b')) is not null then raise exception 'FAIL [U_OUT] used token still public'; end if;
  begin
    perform public.accept_invitation(current_setting('t.token_b'), 'x', '01011113333', current_setting('t.dept_b')::uuid, null, null, null, null, null, null, true);
    v_ok := false;
  exception when others then v_ok := sqlerrm = 'INVALID_INVITATION';
  end;
  if not v_ok then raise exception 'FAIL [U_OUT] reused accepted invitation'; end if;
  if public.my_membership() is not null then raise exception 'FAIL [U_OUT] has membership'; end if;
  if (select count(*) from public.companies) <> 0 or (select count(*) from public.members) <> 0 then raise exception 'FAIL [U_OUT] sees data'; end if;
end $$;
reset role;

-- ---------- anon: 회사명 조회만 가능, 생성·가입 불가 ----------
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $$
declare v_ok boolean;
begin
  if public.get_invite_company(current_setting('t.code_a')) <> '온보딩회사A' then raise exception 'FAIL [ANON] invite company name'; end if;
  begin
    perform public.create_company('익명회사', null, array['팀'], '익명', '01011114444', '팀', null, true);
    v_ok := false;
  exception when insufficient_privilege then v_ok := true;
  end;
  if not v_ok then raise exception 'FAIL [ANON] created company'; end if;
  begin
    perform public.get_invite_departments(current_setting('t.code_a'));
    v_ok := false;
  exception when insufficient_privilege then v_ok := true;
  end;
  if not v_ok then raise exception 'FAIL [ANON] listed departments'; end if;
end $$;
reset role;

select 'ONBOARDING_ISOLATION_OK' as result;
rollback;
