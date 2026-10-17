-- =============================================================================
-- 011_account_titles_cards.sql — 계정과목·매핑·법인카드·개인별 식대 한도 권한·격리 테스트 (T3-5, T3-10, T3-7)
-- 회사 A(대표 a_sup, 직원 a_emp), 회사 B(대표 b_sup). 회사 생성 기본값 대신 테스트 데이터를 직접 넣는다.
-- =============================================================================
begin;

create function public._t_expect_code(p_sql text, p_state text, p_label text)
returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlstate = p_state or sqlerrm = p_state then return; end if;
    raise exception 'FAIL [%] expected % but got % (%)', p_label, p_state, sqlstate, sqlerrm;
  end;
  raise exception 'FAIL [%] expected % but succeeded', p_label, p_state;
end;
$$;
grant execute on function public._t_expect_code(text, text, text) to authenticated;

insert into auth.users (id, instance_id, aud, role, email)
select u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u::text || '@test.local'
from unnest(array['a0100000-0000-0000-0000-000000000001', 'a0100000-0000-0000-0000-000000000002', 'b0100000-0000-0000-0000-000000000001']::uuid[]) u;
insert into public.companies (id, name, invite_code, business_number) values
  ('c0100000-0000-0000-0000-00000000000a', '계정회사A', 'ACCTAAAA', '1000000081'),
  ('c0100000-0000-0000-0000-00000000000b', '계정회사B', 'ACCTBBBB', '1000000082');
insert into public.members (id, auth_user_id, company_id, name, phone, role, status, privacy_agreed_at) values
  ('a0200000-0000-0000-0000-000000000001', 'a0100000-0000-0000-0000-000000000001', 'c0100000-0000-0000-0000-00000000000a', 'A대표', '01094001000', 'super_admin', 'approved', now()),
  ('a0200000-0000-0000-0000-000000000002', 'a0100000-0000-0000-0000-000000000002', 'c0100000-0000-0000-0000-00000000000a', 'A직원', '01094001001', 'employee', 'approved', now()),
  ('b0200000-0000-0000-0000-000000000001', 'b0100000-0000-0000-0000-000000000001', 'c0100000-0000-0000-0000-00000000000b', 'B대표', '01095001000', 'super_admin', 'approved', now());
insert into public.account_titles (id, company_id, name, sort_order) values
  ('a0300000-0000-0000-0000-000000000001', 'c0100000-0000-0000-0000-00000000000a', '복리후생비', 1),
  ('a0300000-0000-0000-0000-000000000002', 'c0100000-0000-0000-0000-00000000000a', '여비교통비', 2),
  ('b0300000-0000-0000-0000-000000000001', 'c0100000-0000-0000-0000-00000000000b', '복리후생비', 1);
insert into public.account_title_mappings (id, company_id, category, trip_type, account_title_id) values
  ('a0400000-0000-0000-0000-000000000001', 'c0100000-0000-0000-0000-00000000000a', 'meal', null, 'a0300000-0000-0000-0000-000000000001'),
  ('b0400000-0000-0000-0000-000000000001', 'c0100000-0000-0000-0000-00000000000b', 'meal', null, 'b0300000-0000-0000-0000-000000000001');
insert into public.corporate_cards (id, company_id, nickname, last4) values
  ('b0500000-0000-0000-0000-000000000001', 'c0100000-0000-0000-0000-00000000000b', 'B카드', '7890');

-- ── A 대표: 자기 회사만, 잘못된 값은 DB가 거부 ─────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"a0100000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
do $$
declare n integer;
begin
  if (select count(*) from public.account_titles) <> 2 then raise exception 'FAIL [A_SUP] sees other company titles'; end if;
  if (select count(*) from public.corporate_cards) <> 0 then raise exception 'FAIL [A_SUP] sees other company cards'; end if;
  insert into public.account_titles (company_id, name, code, sort_order) values ('c0100000-0000-0000-0000-00000000000a', '회의비', '813', 3);
  update public.account_titles set code = '811' where id = 'a0300000-0000-0000-0000-000000000001';
  insert into public.corporate_cards (company_id, nickname, last4, holder_member_id) values ('c0100000-0000-0000-0000-00000000000a', '대표 카드', '7890', 'a0200000-0000-0000-0000-000000000001');
  update public.account_title_mappings set account_title_id = 'a0300000-0000-0000-0000-000000000002' where id = 'a0400000-0000-0000-0000-000000000001';
  -- B 데이터는 바꿀 수 없다(0건)
  update public.account_titles set name = '변조' where id = 'b0300000-0000-0000-0000-000000000001';
  get diagnostics n = row_count; if n <> 0 then raise exception 'FAIL [A_SUP] updated B title'; end if;
  update public.corporate_cards set is_active = false where id = 'b0500000-0000-0000-0000-000000000001';
  get diagnostics n = row_count; if n <> 0 then raise exception 'FAIL [A_SUP] updated B card'; end if;
  delete from public.account_title_mappings where id = 'b0400000-0000-0000-0000-000000000001';
  get diagnostics n = row_count; if n <> 0 then raise exception 'FAIL [A_SUP] deleted B mapping'; end if;
end $$;
select public._t_expect_code($q$insert into public.account_titles (company_id, name) values ('c0100000-0000-0000-0000-00000000000b', '침투')$q$, '42501', 'A_SUP insert B title');
select public._t_expect_code($q$update public.account_title_mappings set account_title_id = 'b0300000-0000-0000-0000-000000000001' where id = 'a0400000-0000-0000-0000-000000000001'$q$, '23503', 'A_SUP map to B title');
select public._t_expect_code($q$delete from public.account_titles where id = 'a0300000-0000-0000-0000-000000000002'$q$, '23503', 'A_SUP delete mapped title');
select public._t_expect_code($q$insert into public.account_titles (company_id, name) values ('c0100000-0000-0000-0000-00000000000a', '복리후생비')$q$, '23505', 'A_SUP duplicate title');
select public._t_expect_code($q$insert into public.account_titles (company_id, name) values ('c0100000-0000-0000-0000-00000000000a', '   ')$q$, '23514', 'A_SUP blank title');
select public._t_expect_code($q$insert into public.corporate_cards (company_id, nickname, last4) values ('c0100000-0000-0000-0000-00000000000a', '중복', '7890')$q$, '23505', 'A_SUP duplicate active last4');
select public._t_expect_code($q$insert into public.corporate_cards (company_id, nickname, last4) values ('c0100000-0000-0000-0000-00000000000a', '이상', '12a4')$q$, '23514', 'A_SUP bad last4');
select public._t_expect_code($q$insert into public.corporate_cards (company_id, nickname, last4, holder_member_id) values ('c0100000-0000-0000-0000-00000000000a', '남의 담당자', '1111', 'b0200000-0000-0000-0000-000000000001')$q$, '23503', 'A_SUP card holder from B');
-- 해지(사용 안 함)한 카드의 끝 4자리는 다시 쓸 수 있다
update public.corporate_cards set is_active = false where company_id = 'c0100000-0000-0000-0000-00000000000a' and last4 = '7890';
insert into public.corporate_cards (company_id, nickname, last4) values ('c0100000-0000-0000-0000-00000000000a', '새 대표 카드', '7890');
-- 개인별 식대 한도: 설정 → 유지(-1) → 회사 기본으로(null), 범위 밖 거부
select public.update_member('a0200000-0000-0000-0000-000000000002', 'A직원', '01094001001', null, null, null, null, 15000);
select public.update_member('a0200000-0000-0000-0000-000000000002', 'A직원', '01094001001', null, '대리', null);
select public._t_expect_code($q$select public.update_member('a0200000-0000-0000-0000-000000000002', 'A직원', '01094001001', null, null, null, null, 2000000)$q$, 'INVALID_MEAL_LIMIT', 'A_SUP meal override too big');
reset role;

do $$
begin
  if (select row(meal_limit_override, position)::text from public.members where id = 'a0200000-0000-0000-0000-000000000002') <> row(15000, '대리')::text then
    raise exception 'FAIL [MEAL] override not stored or reset by edit without it';
  end if;
end $$;
select set_config('request.jwt.claims', '{"sub":"a0100000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select public.update_member('a0200000-0000-0000-0000-000000000002', 'A직원', '01094001001', null, '대리', null, null, null);
reset role;
do $$
begin
  if (select meal_limit_override from public.members where id = 'a0200000-0000-0000-0000-000000000002') is not null then
    raise exception 'FAIL [MEAL] override not cleared';
  end if;
end $$;

-- ── A 직원: 계정과목은 못 보고(관리자 전용), 법인카드는 보지만(카드 선택용) 바꾸지 못함 ──────
select set_config('request.jwt.claims', '{"sub":"a0100000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
do $$
declare n integer;
begin
  if (select count(*) from public.account_titles) <> 0 then raise exception 'FAIL [A_EMP] employee sees account titles'; end if;
  if (select count(*) from public.account_title_mappings) <> 0 then raise exception 'FAIL [A_EMP] employee sees mappings'; end if;
  if (select count(*) from public.corporate_cards) <> 2 then raise exception 'FAIL [A_EMP] employee cannot see own company cards'; end if;
  update public.corporate_cards set nickname = '변조' where company_id = 'c0100000-0000-0000-0000-00000000000a';
  get diagnostics n = row_count; if n <> 0 then raise exception 'FAIL [A_EMP] employee updated card'; end if;
end $$;
select public._t_expect_code($q$insert into public.corporate_cards (company_id, nickname, last4) values ('c0100000-0000-0000-0000-00000000000a', '직원카드', '2222')$q$, '42501', 'A_EMP insert card');
select public._t_expect_code($q$select public.update_member('a0200000-0000-0000-0000-000000000002', 'A직원', '01094001001', null, null, null, null, 99999)$q$, 'NOT_ALLOWED', 'A_EMP set own meal limit');
reset role;

do $$
begin
  if (select row(name, code)::text from public.account_titles where id = 'b0300000-0000-0000-0000-000000000001') <> row('복리후생비', null::text)::text
     or (select is_active from public.corporate_cards where id = 'b0500000-0000-0000-0000-000000000001') is not true
     or not exists (select 1 from public.account_title_mappings where id = 'b0400000-0000-0000-0000-000000000001') then
    raise exception 'FAIL [FINAL] company B data changed';
  end if;
end $$;

select 'ACCOUNT_TITLES_CARDS_OK' as result;
rollback;
