-- =============================================================================
-- 049_tax_office_governance.sql — 고객사 해제·계정과목 사무소 전담·변경 이력·관리자 넘기기·나가기·사무소 닫기 (D-152, migration 079)
-- =============================================================================
begin;

-- 이 테스트는 가짜 번호로 회사·사무소를 만든다: 트랜잭션 안에서만 국세청 확인을 끈다(검증 자체는 003 테스트, D-155)
update private.app_settings set value = 'off' where key = 'business_verify_mode';

create function public._t_raises49(p_sql text, p_code text, p_label text)
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
grant execute on function public._t_raises49(text, text, text) to authenticated;
create function public._t_as49(p_uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
end;
$$;

insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at) values
  ('a4900000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sup49@test.local', now()),
  ('a4900000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'office49@test.local', now()),
  ('a4900000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'staff49@test.local', now());
insert into public.companies (id, name, invite_code, business_number) values ('c4900000-0000-0000-0000-00000000000a', '운영A', 'GVRNAAAA', '1000000491');
insert into public.members (id, auth_user_id, company_id, name, phone, role, status, privacy_agreed_at) values
  ('a4910000-0000-0000-0000-000000000001', 'a4900000-0000-0000-0000-000000000001', 'c4900000-0000-0000-0000-00000000000a', '가대표', '01094901001', 'super_admin', 'approved', now());
insert into public.account_titles (id, company_id, name, code) values
  ('a4920000-0000-0000-0000-00000000000a', 'c4900000-0000-0000-0000-00000000000a', '복리후생비', '811'),
  ('a4920000-0000-0000-0000-00000000000b', 'c4900000-0000-0000-0000-00000000000a', '여비교통비', '812');
insert into public.account_title_mappings (company_id, category, trip_type, account_title_id) values
  ('c4900000-0000-0000-0000-00000000000a', 'trip', 'taxi', 'a4920000-0000-0000-0000-00000000000b');

-- 사무소 연결 전: 회사는 계정과목을 바꿀 수 있음(이력 없음)
select public._t_as49('a4900000-0000-0000-0000-000000000001');
set local role authenticated;
do $$
begin
  update public.account_titles set code = '8110' where id = 'a4920000-0000-0000-0000-00000000000a';
  if not found then raise exception 'FAIL [company edit before office]'; end if;
end;
$$;
select public.set_company_tax_office('X세무', 'office49@test.local', null, 'staff49@test.local', null);
-- 사무소 미등록(가입 대기) 동안은 여전히 회사가 관리
do $$ begin update public.account_titles set code = '811' where id = 'a4920000-0000-0000-0000-00000000000a'; if not found then raise exception 'FAIL [pending still company]'; end if; end; $$;
reset role;

-- 사무소 등록 + 세무사 합류(자동 배정)
select public._t_as49('a4900000-0000-0000-0000-000000000004');
set local role authenticated;
select public.register_tax_office('X세무사무소', '2000000491', 'X대표', null, true, true);
reset role;
do $$ begin perform set_config('t.code', (select invite_code from public.tax_offices where contact_email = 'office49@test.local'), true); end; $$;
select public._t_as49('a4900000-0000-0000-0000-000000000005');
set local role authenticated;
do $$ begin perform public.join_tax_office(current_setting('t.code'), '김세무', null, true, true); end; $$;
reset role;

-- 연결 뒤: 회사 관리자는 계정과목·연결을 못 바꿈(조회는 됨)
select public._t_as49('a4900000-0000-0000-0000-000000000001');
set local role authenticated;
do $$
begin
  if (select count(*) from public.account_titles) <> 2 then raise exception 'FAIL [company can read]'; end if;
  update public.account_titles set code = '9999' where id = 'a4920000-0000-0000-0000-00000000000a';
  if found then raise exception 'FAIL [company update blocked]'; end if;
  delete from public.account_titles where id = 'a4920000-0000-0000-0000-00000000000a';
  if found then raise exception 'FAIL [company delete blocked]'; end if;
  update public.account_title_mappings set account_title_id = 'a4920000-0000-0000-0000-00000000000a' where company_id = 'c4900000-0000-0000-0000-00000000000a';
  if found then raise exception 'FAIL [company mapping blocked]'; end if;
  if (select (public.my_company_tax_office()->>'registered')::boolean) is not true then raise exception 'FAIL [registered]'; end if;
end;
$$;
select public._t_raises49($q$insert into public.account_titles (company_id, name) values ('c4900000-0000-0000-0000-00000000000a', '회의비')$q$, '42501', 'company insert blocked');
reset role;

-- 세무사가 바꾸면 이력이 남고 회사 관리자가 봄
select public._t_as49('a4900000-0000-0000-0000-000000000005');
set local role authenticated;
do $$
begin
  update public.account_titles set code = '8111' where id = 'a4920000-0000-0000-0000-00000000000a';
  update public.account_titles set code = '8111' where id = 'a4920000-0000-0000-0000-00000000000a'; -- 같은 값: 이력 없음
  insert into public.account_titles (company_id, name, code) values ('c4900000-0000-0000-0000-00000000000a', '회의비', '819');
  update public.account_title_mappings set account_title_id = 'a4920000-0000-0000-0000-00000000000a' where company_id = 'c4900000-0000-0000-0000-00000000000a';
  if (select count(*) from public.account_title_changes) <> 3 then raise exception 'FAIL [office sees 3 changes] %', (select count(*) from public.account_title_changes); end if;
end;
$$;
select public._t_raises49($q$insert into public.account_title_changes (company_id, entity, action) values ('c4900000-0000-0000-0000-00000000000a', 'title', 'insert')$q$, '42501', 'no direct log insert');
-- 세무사는 나가기 가능하지만 아직은 남음. 관리자 넘기기는 관리자만
select public._t_raises49($q$select public.transfer_tax_office_admin('a4900000-0000-0000-0000-000000000004')$q$, '42501', 'staff transfer');
reset role;
select public._t_as49('a4900000-0000-0000-0000-000000000001');
set local role authenticated;
do $$
declare r public.account_title_changes;
begin
  if (select count(*) from public.account_title_changes) <> 3 then raise exception 'FAIL [company sees changes]'; end if;
  select * into r from public.account_title_changes where entity = 'title' and action = 'update';
  if r.detail->>'old_code' <> '811' or r.detail->>'new_code' <> '8111' or r.actor_name <> '김세무' or r.office_name <> 'X세무사무소' then raise exception 'FAIL [title detail] %', row_to_json(r); end if;
  select * into r from public.account_title_changes where entity = 'mapping';
  if r.detail->>'old_title' <> '여비교통비' or r.detail->>'new_title' <> '복리후생비' or r.detail->>'trip_type' <> 'taxi' then raise exception 'FAIL [mapping detail] %', row_to_json(r); end if;
end;
$$;
reset role;

-- 관리자 넘기기: X대표 → 김세무, 이전 관리자는 세무사로
select public._t_as49('a4900000-0000-0000-0000-000000000004');
set local role authenticated;
select public._t_raises49($q$select public.leave_tax_office()$q$, 'ADMIN_MUST_TRANSFER', 'admin leave');
do $$
declare v_s uuid;
begin
  select id into v_s from public.tax_office_member_list() where name = '김세무';
  perform public.transfer_tax_office_admin(v_s);
  if (public.my_tax_office()->>'role') <> 'staff' then raise exception 'FAIL [old admin now staff]'; end if;
end;
$$;
select public._t_raises49($q$select * from public.tax_office_member_list()$q$, '42501', 'old admin lost admin');
-- 이전 관리자(이제 세무사) 나가기
select public.leave_tax_office();
do $$ begin if public.my_tax_office()->>'member_id' is not null then raise exception 'FAIL [left]'; end if; end; $$;
reset role;

-- 새 관리자(김세무): 고객사 해제 → 회사 화면에 해제 표시, 계정과목은 다시 회사가 관리, 자동으로 다시 붙지 않음
select public._t_as49('a4900000-0000-0000-0000-000000000005');
set local role authenticated;
select public._t_raises49($q$select public.release_tax_office_client('00000000-0000-0000-0000-000000000000')$q$, 'NOT_FOUND', 'release other');
select public.release_tax_office_client('c4900000-0000-0000-0000-00000000000a');
do $$ begin if (select count(*) from public.tax_office_clients()) <> 0 then raise exception 'FAIL [released gone]'; end if; end; $$;
reset role;
select public._t_as49('a4900000-0000-0000-0000-000000000001');
set local role authenticated;
do $$
declare j jsonb := public.my_company_tax_office();
begin
  if (j->>'registered')::boolean or j->>'released_office_name' <> 'X세무사무소' or j->>'released_at' is null then raise exception 'FAIL [company sees release] %', j; end if;
  update public.account_titles set code = '811' where id = 'a4920000-0000-0000-0000-00000000000a';
  if not found then raise exception 'FAIL [company manages again]'; end if;
end;
$$;
reset role;
-- 해제된 연결은 사무소에 사람이 새로 합류해도 다시 붙지 않음
do $$ begin perform private.attach_tax_office_clients((select id from public.tax_offices where contact_email = 'office49@test.local')); end; $$;
do $$ begin if (select office_id from public.company_tax_offices where company_id = 'c4900000-0000-0000-0000-00000000000a') is not null then raise exception 'FAIL [no reattach]'; end if; end; $$;
-- 회사가 다시 저장하면 다시 연결
select public._t_as49('a4900000-0000-0000-0000-000000000001');
set local role authenticated;
select public.set_company_tax_office('X세무', 'office49@test.local', null, null, null);
do $$ begin if not (public.my_company_tax_office()->>'registered')::boolean or public.my_company_tax_office()->>'released_at' is not null then raise exception 'FAIL [reconnect]'; end if; end; $$;
reset role;

-- 사무소 닫기: 이름 확인 → 고객사는 가입 대기, 사무소·구성원 사라짐
select public._t_as49('a4900000-0000-0000-0000-000000000005');
set local role authenticated;
select public._t_raises49($q$select public.close_tax_office('틀린이름')$q$, 'CONFIRM_NAME_MISMATCH', 'close confirm');
select public.close_tax_office(' X세무사무소 ');
do $$ begin if public.my_tax_office()->>'member_id' is not null then raise exception 'FAIL [closed member gone]'; end if; end; $$;
reset role;
do $$
begin
  if exists (select 1 from public.tax_offices where contact_email = 'office49@test.local') then raise exception 'FAIL [office deleted]'; end if;
  if (select office_id from public.company_tax_offices where company_id = 'c4900000-0000-0000-0000-00000000000a') is not null then raise exception 'FAIL [company pending]'; end if;
  -- 이력은 회사에 남음
  if (select count(*) from public.account_title_changes where company_id = 'c4900000-0000-0000-0000-00000000000a') <> 3 then raise exception 'FAIL [history kept]'; end if;
end;
$$;

select 'tax_office_governance ok';
rollback;
