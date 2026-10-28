-- =============================================================================
-- 046_company_referrals.sql — 추천인·추천 회사: 최고 관리자만·회사당 1회·검색 범위·회사 격리 (D-147, migration 074)
-- =============================================================================
begin;

create function public._t_raises(p_sql text, p_code text, p_label text)
returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlerrm = p_code or sqlstate = p_code then return; end if;
    raise exception 'FAIL [%] expected % but got % (%)', p_label, p_code, sqlerrm, sqlstate;
  end;
  raise exception 'FAIL [%] expected % but succeeded', p_label, p_code;
end;
$$;
grant execute on function public._t_raises(text, text, text) to authenticated, anon;

insert into auth.users (id, instance_id, aud, role, email)
select u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u::text || '@test.local'
from unnest(array['a4600000-0000-0000-0000-000000000001', 'a4600000-0000-0000-0000-000000000002', 'a4600000-0000-0000-0000-000000000003', 'a4600000-0000-0000-0000-000000000004']::uuid[]) u;
insert into public.companies (id, name, invite_code, business_number) values
  ('c4600000-0000-0000-0000-00000000000a', '추천테스트새회사', 'REFRCPNA', '1000000461'),
  ('c4600000-0000-0000-0000-00000000000b', '추천테스트_소개회사', 'REFRCPNB', '1000000462'),
  ('c4600000-0000-0000-0000-00000000000c', '추천테스트세번째', 'REFRCPNC', '1000000463');
insert into public.members (id, auth_user_id, company_id, name, phone, role, status, privacy_agreed_at) values
  ('a4610000-0000-0000-0000-000000000001', 'a4600000-0000-0000-0000-000000000001', 'c4600000-0000-0000-0000-00000000000a', '대표', '01094601001', 'super_admin', 'approved', now()),
  ('a4610000-0000-0000-0000-000000000002', 'a4600000-0000-0000-0000-000000000002', 'c4600000-0000-0000-0000-00000000000a', '경리', '01094601002', 'admin', 'approved', now()),
  ('a4610000-0000-0000-0000-000000000003', 'a4600000-0000-0000-0000-000000000003', 'c4600000-0000-0000-0000-00000000000a', '직원', '01094601003', 'employee', 'approved', now()),
  ('a4610000-0000-0000-0000-000000000004', 'a4600000-0000-0000-0000-000000000004', 'c4600000-0000-0000-0000-00000000000b', '남의대표', '01094601004', 'super_admin', 'approved', now());

-- 일반 관리자·직원: 검색·저장 불가
select set_config('request.jwt.claims', '{"sub":"a4600000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select public._t_raises($q$select * from public.search_referral_companies('추천테스트')$q$, '42501', 'admin search');
select public._t_raises($q$select public.save_company_referral('person', null, '홍길동', '010-1234-5678')$q$, '42501', 'admin save');
reset role;
select set_config('request.jwt.claims', '{"sub":"a4600000-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select public._t_raises($q$select public.save_company_referral('person', null, '홍길동', '010-1234-5678')$q$, '42501', 'employee save');
reset role;

-- 최고 관리자: 검색(2자 미만은 빈 결과, 자기 회사 제외, %·_는 글자 그대로)
select set_config('request.jwt.claims', '{"sub":"a4600000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  if (select count(*) from public.search_referral_companies('추')) <> 0 then raise exception 'FAIL [short query]'; end if;
  if exists (select 1 from public.search_referral_companies('추천테스트') where id = 'c4600000-0000-0000-0000-00000000000a') then raise exception 'FAIL [own company listed]'; end if;
  if (select count(*) from public.search_referral_companies('추천테스트')) < 2 then raise exception 'FAIL [search finds others]'; end if;
  if (select count(*) from public.search_referral_companies('트_소')) <> 1 then raise exception 'FAIL [underscore literal]'; end if;
  if (select count(*) from public.search_referral_companies('%%')) <> 0 then raise exception 'FAIL [percent literal]'; end if;
  -- 아직 안 적음
  if (select count(*) from public.company_referrals) <> 0 then raise exception 'FAIL [empty before]'; end if;
end;
$$;
-- 잘못된 값
select public._t_raises($q$select public.save_company_referral('company', 'c4600000-0000-0000-0000-00000000000a', null, null)$q$, 'INVALID_REFERRAL', 'self referral');
select public._t_raises($q$select public.save_company_referral('company', '00000000-0000-0000-0000-000000000000', null, null)$q$, 'INVALID_REFERRAL', 'missing company');
select public._t_raises($q$select public.save_company_referral('person', null, '  ', '010-1234-5678')$q$, 'INVALID_REFERRAL', 'blank name');
select public._t_raises($q$select public.save_company_referral('person', null, '홍길동', '02-123-4567')$q$, 'INVALID_PHONE', 'bad phone');
select public._t_raises($q$select public.save_company_referral('friend', null, '홍길동', '010-1234-5678')$q$, 'INVALID_REFERRAL', 'bad kind');
-- 정상 저장(회사 이름 스냅샷) → 두 번째는 거절
do $$
begin
  perform public.save_company_referral('company', 'c4600000-0000-0000-0000-00000000000b', null, null);
  if (select referrer_company_name from public.company_referrals) <> '추천테스트_소개회사' then raise exception 'FAIL [snapshot name]'; end if;
end;
$$;
select public._t_raises($q$select public.save_company_referral('person', null, '홍길동', '010-1234-5678')$q$, 'REFERRAL_ALREADY_SAVED', 'twice');
-- 직접 쓰기 불가
select public._t_raises($q$insert into public.company_referrals (company_id, kind, referrer_name, referrer_phone) values ('c4600000-0000-0000-0000-00000000000c', 'person', '가', '01012345678')$q$, '42501', 'direct insert');
select public._t_raises($q$update public.company_referrals set referrer_company_name = 'x'$q$, '42501', 'direct update');
reset role;

-- 다른 회사 최고 관리자: 남의 추천 기록을 못 봄, 추천인(사람) 저장 + 번호 정규화
select set_config('request.jwt.claims', '{"sub":"a4600000-0000-0000-0000-000000000004","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  if (select count(*) from public.company_referrals) <> 0 then raise exception 'FAIL [isolation]'; end if;
  perform public.save_company_referral('person', null, ' 홍길동 ', '010-1234-5678');
  if (select count(*) from public.company_referrals) <> 1 then raise exception 'FAIL [own only]'; end if;
  if (select referrer_phone from public.company_referrals) <> '01012345678' then raise exception 'FAIL [phone normalized]'; end if;
  if (select referrer_name from public.company_referrals) <> '홍길동' then raise exception 'FAIL [name trimmed]'; end if;
end;
$$;
reset role;

-- 같은 회사 일반 관리자는 기록을 못 봄
select set_config('request.jwt.claims', '{"sub":"a4600000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
do $$ begin if (select count(*) from public.company_referrals) <> 0 then raise exception 'FAIL [admin cannot read]'; end if; end; $$;
reset role;

-- 추천한 회사가 지워져도 이름은 남음
delete from public.companies where id = 'c4600000-0000-0000-0000-00000000000b';
do $$
begin
  if (select referrer_company_id from public.company_referrals where company_id = 'c4600000-0000-0000-0000-00000000000a') is not null then raise exception 'FAIL [set null]'; end if;
  if (select referrer_company_name from public.company_referrals where company_id = 'c4600000-0000-0000-0000-00000000000a') <> '추천테스트_소개회사' then raise exception 'FAIL [name kept]'; end if;
end;
$$;

select 'company_referrals ok';
rollback;
