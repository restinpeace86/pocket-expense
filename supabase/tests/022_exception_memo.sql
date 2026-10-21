-- =============================================================================
-- 022_exception_memo.sql — 예외 소명 사유: 본인 작성 중 결의서만 쓰기, 길이 제한, 회사 격리 (migration 039)
-- =============================================================================
begin;

insert into auth.users (id, instance_id, aud, role, email)
select u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u::text || '@test.local'
from unnest(array['a2200000-0000-0000-0000-000000000011', 'a2200000-0000-0000-0000-000000000012', 'b2200000-0000-0000-0000-000000000011']::uuid[]) u;
insert into public.companies (id, name, invite_code, business_number) values
  ('c2200000-0000-0000-0000-00000000000a', '메모회사A', 'MEMQAAAA', '1000000221'),
  ('c2200000-0000-0000-0000-00000000000b', '메모회사B', 'MEMQBBBB', '1000000222');
insert into public.members (id, auth_user_id, company_id, name, phone, role, status, privacy_agreed_at) values
  ('a2300000-0000-0000-0000-000000000011', 'a2200000-0000-0000-0000-000000000011', 'c2200000-0000-0000-0000-00000000000a', 'A직원1', '01092201001', 'employee', 'approved', now()),
  ('a2300000-0000-0000-0000-000000000012', 'a2200000-0000-0000-0000-000000000012', 'c2200000-0000-0000-0000-00000000000a', 'A직원2', '01092201002', 'employee', 'approved', now()),
  ('b2300000-0000-0000-0000-000000000011', 'b2200000-0000-0000-0000-000000000011', 'c2200000-0000-0000-0000-00000000000b', 'B대표', '01092202000', 'super_admin', 'approved', now());
insert into public.expense_claims (id, company_id, member_id, title, status) values
  ('a2400000-0000-0000-0000-000000000011', 'c2200000-0000-0000-0000-00000000000a', 'a2300000-0000-0000-0000-000000000011', '작성 중', 'draft'),
  ('a2400000-0000-0000-0000-000000000012', 'c2200000-0000-0000-0000-00000000000a', 'a2300000-0000-0000-0000-000000000011', '상신됨', 'submitted');

-- A 직원1: 작성 중 결의서에 쓰기 가능, 상신된 결의서는 안 바뀜, 500자 초과 거부
select set_config('request.jwt.claims', '{"sub":"a2200000-0000-0000-0000-000000000011","role":"authenticated"}', true);
set local role authenticated;
do $$
declare n int;
begin
  update public.expense_claims set exception_memo = '토요일 고객사 긴급 대응' where id = 'a2400000-0000-0000-0000-000000000011';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL [A_E1] cannot write own draft memo'; end if;
  update public.expense_claims set exception_memo = '바꿈' where id = 'a2400000-0000-0000-0000-000000000012';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL [A_E1] wrote submitted claim memo'; end if;
  begin
    update public.expense_claims set exception_memo = repeat('가', 501) where id = 'a2400000-0000-0000-0000-000000000011';
    raise exception 'FAIL [A_E1] 501 chars accepted';
  exception when check_violation then null;
  end;
end;
$$;
reset role;

-- A 직원2, B 대표: 남의 결의서 메모를 못 바꾼다(B는 보이지도 않음)
do $$
declare n int; u text;
begin
  foreach u in array array['a2200000-0000-0000-0000-000000000012', 'b2200000-0000-0000-0000-000000000011'] loop
    perform set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', u), true);
    set local role authenticated;
    update public.expense_claims set exception_memo = '남이 씀' where id = 'a2400000-0000-0000-0000-000000000011';
    get diagnostics n = row_count;
    reset role;
    if n <> 0 then raise exception 'FAIL [%] wrote other member memo', u; end if;
  end loop;
  if (select exception_memo from public.expense_claims where id = 'a2400000-0000-0000-0000-000000000011') <> '토요일 고객사 긴급 대응' then
    raise exception 'FAIL memo changed';
  end if;
end;
$$;

select 'EXCEPTION_MEMO_OK' as result;
rollback;
