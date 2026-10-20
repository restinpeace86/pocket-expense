-- =============================================================================
-- 020_my_profile.sql — 직원 내 정보 저장 (T6-9, migration 036)
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
from unnest(array['a7100000-0000-0000-0000-000000000001', 'a7100000-0000-0000-0000-000000000002']::uuid[]) u;
insert into public.companies (id, name, invite_code, business_number) values ('c7100000-0000-0000-0000-00000000000a', '정보회사A', 'PRFAAAAA', '1000000711');
insert into public.departments (id, company_id, name) values ('d7100000-0000-0000-0000-000000000001', 'c7100000-0000-0000-0000-00000000000a', '개발팀');
insert into public.members (id, auth_user_id, company_id, name, phone, role, status, privacy_agreed_at, department_id) values
  ('a7200000-0000-0000-0000-000000000001', 'a7100000-0000-0000-0000-000000000001', 'c7100000-0000-0000-0000-00000000000a', '직원1', '01096701000', 'employee', 'approved', now(), 'd7100000-0000-0000-0000-000000000001'),
  ('a7200000-0000-0000-0000-000000000002', 'a7100000-0000-0000-0000-000000000002', 'c7100000-0000-0000-0000-00000000000a', '직원2', '01096701001', 'employee', 'approved', now(), null);

select set_config('request.jwt.claims', '{"sub":"a7100000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select public._t_expect($q$select public.update_my_profile('', '01011112222', null, null, null, null, null, null)$q$, 'INVALID_NAME', 'empty name');
select public._t_expect($q$select public.update_my_profile('김개발', '02-123-4567', null, null, null, null, null, null)$q$, 'INVALID_PHONE', 'landline');
select public._t_expect($q$select public.update_my_profile('김개발', '01011112222', null, null, null, '국민은행', '123', null)$q$, 'INCOMPLETE_BANK_ACCOUNT', 'partial bank');
-- 선택 동의 없이 계좌·차량번호는 저장 불가
select public._t_expect($q$select public.update_my_profile('김개발', '01011112222', null, null, '12가3456', null, null, null)$q$, 'OPTIONAL_CONSENT_REQUIRED', 'vehicle without consent');
-- 부서·역할은 바꿀 수 없다(열 권한 없음)
select public._t_expect($q$update public.members set role = 'admin' where id = 'a7200000-0000-0000-0000-000000000001'$q$, 'permission denied for table members', 'role');
select public._t_expect($q$update public.members set department_id = null where id = 'a7200000-0000-0000-0000-000000000001'$q$, 'permission denied for table members', 'department');
do $$
begin
  perform public.update_my_profile(' 김개발 ', '010-1111-2222', '대리', 'E-7', '12가3456', '국민은행', '123-45-678', '김개발', true);
  if (select row(name, phone, position, employee_number, vehicle_number, optional_consent_at is not null)::text from public.members where id = 'a7200000-0000-0000-0000-000000000001')
     <> row('김개발', '01011112222', '대리', 'E-7', '12가3456', true)::text then
    raise exception 'FAIL profile saved';
  end if;
  if (select row(bank_name, account_number, account_holder)::text from public.member_bank_accounts where member_id = 'a7200000-0000-0000-0000-000000000001') <> row('국민은행', '123-45-678', '김개발')::text then
    raise exception 'FAIL bank saved';
  end if;
  -- 이미 동의했으면 다시 체크하지 않아도 저장, 계좌를 비우면 지운다
  perform public.update_my_profile('김개발', '01011112222', '대리', 'E-7', '12가3456', '', '', '', false);
  if exists (select 1 from public.member_bank_accounts where member_id = 'a7200000-0000-0000-0000-000000000001') then raise exception 'FAIL bank removed'; end if;
  -- 다른 사람 정보는 바뀌지 않는다
  if (select name from public.members where id = 'a7200000-0000-0000-0000-000000000002') <> '직원2' then raise exception 'FAIL other member changed'; end if;
end $$;
reset role;

-- 비로그인은 호출 불가
set local role anon;
do $$
begin
  begin
    perform public.update_my_profile('x', '01011112222', null, null, null, null, null, null);
    raise exception 'FAIL anon';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

select 'MY_PROFILE_OK' as result;
rollback;
