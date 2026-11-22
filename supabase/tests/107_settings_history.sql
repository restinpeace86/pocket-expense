-- 107_settings_history.sql — 설정 변경 이력(D-302, migration 172)
-- 관리자가 바꾼 것만 남음(이전→이후) · 다른 회사 이력 안 보임 · 직원은 못 봄 · 고치거나 지울 수 없음 · 시스템 작업은 안 남음
-- 결재라인 이전→이후 · 정렬만 바꾸면 안 남음 · 회사 삭제 땐 함께 지워짐
begin;
create function public._t_raises107(p_sql text, p_code text, p_label text)
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
grant execute on function public._t_raises107(text, text, text) to authenticated;
create function public._t_as107(p_uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
end;
$$;

insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at) values
  ('a1070000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bossa107@test.local', now()),
  ('a1070000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'empa107@test.local', now()),
  ('a1070000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bossb107@test.local', now()),
  ('a1070000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'revw107@test.local', now());
insert into public.companies (id, name, invite_code, business_number) values
  ('c1070000-0000-0000-0000-00000000000a', '이력A', 'HSTAAAAA', '1000001107'),
  ('c1070000-0000-0000-0000-00000000000b', '이력B', 'HSTBBBBB', '1000002107');
insert into public.members (id, auth_user_id, company_id, name, phone, role, status, privacy_agreed_at, approved_at) values
  ('a1071000-0000-0000-0000-000000000001', 'a1070000-0000-0000-0000-000000000001', 'c1070000-0000-0000-0000-00000000000a', 'A대표', '01010701001', 'super_admin', 'approved', now(), now()),
  ('a1071000-0000-0000-0000-000000000002', 'a1070000-0000-0000-0000-000000000002', 'c1070000-0000-0000-0000-00000000000a', 'A직원', '01010701002', 'employee', 'approved', now(), now()),
  ('a1071000-0000-0000-0000-000000000003', 'a1070000-0000-0000-0000-000000000003', 'c1070000-0000-0000-0000-00000000000b', 'B대표', '01010701003', 'super_admin', 'approved', now(), now()),
  ('a1071000-0000-0000-0000-000000000004', 'a1070000-0000-0000-0000-000000000004', 'c1070000-0000-0000-0000-00000000000a', 'A팀장', '01010701004', 'admin', 'approved', now(), now());

-- 시스템(로그인 없음) 작업은 안 남음
insert into public.departments (company_id, name, sort_order) values ('c1070000-0000-0000-0000-00000000000a', '시스템부서', 9);
update public.companies set meal_limit_per_person = 11000 where id = 'c1070000-0000-0000-0000-00000000000a';
do $$ begin if exists (select 1 from public.settings_history where company_id in ('c1070000-0000-0000-0000-00000000000a', 'c1070000-0000-0000-0000-00000000000b')) then raise exception 'FAIL [system logged]'; end if; end; $$;

-- A 대표가 바꿈(트리거는 로그인 사용자 기준이라 권한 우회 없이 jwt만 설정하고 표를 직접 바꿈 — 실제는 화면 동작이 같은 표를 바꾼다)
select public._t_as107('a1070000-0000-0000-0000-000000000001');
insert into public.departments (company_id, name, sort_order) values ('c1070000-0000-0000-0000-00000000000a', '영업팀', 1);
update public.departments set sort_order = 5 where company_id = 'c1070000-0000-0000-0000-00000000000a' and name = '영업팀'; -- 정렬만: 안 남음
update public.departments set name = '영업1팀' where company_id = 'c1070000-0000-0000-0000-00000000000a' and name = '영업팀';
update public.companies set meal_limit_per_person = 12000, fuel_rate_per_km = 250, updated_at = now() where id = 'c1070000-0000-0000-0000-00000000000a';
update public.companies set updated_at = now(), policy_confirmed_at = now() where id = 'c1070000-0000-0000-0000-00000000000a'; -- 남길 값 없음: 안 남음
insert into public.company_features (company_id, feature, enabled) values ('c1070000-0000-0000-0000-00000000000a', 'calendar', false)
  on conflict (company_id, feature) do update set enabled = excluded.enabled;
select public.save_approval_line(null, array['a1071000-0000-0000-0000-000000000004']::uuid[]);
select public.save_approval_line(null, array['a1071000-0000-0000-0000-000000000004']::uuid[]); -- 같은 값: 안 남음
select public.save_approval_line(null, '{}'::uuid[]);

do $$
declare n int; r public.settings_history;
begin
  select count(*) into n from public.settings_history where company_id = 'c1070000-0000-0000-0000-00000000000a';
  if n <> 7 then raise exception 'FAIL [A count %]', n; end if;
  select * into r from public.settings_history where company_id = 'c1070000-0000-0000-0000-00000000000a' and menu = '부서' and action = 'change';
  if r.changes <> '[{"label": "부서 이름", "from": "영업팀", "to": "영업1팀"}]'::jsonb or r.member_name <> 'A대표' or r.area <> 'company' then raise exception 'FAIL [dept rename] %', row_to_json(r); end if;
  select * into r from public.settings_history where company_id = 'c1070000-0000-0000-0000-00000000000a' and menu = '식대 한도';
  if r.changes <> '[{"label": "1식 1인당 한도", "from": "11,000원", "to": "12,000원"}]'::jsonb then raise exception 'FAIL [meal] %', r.changes; end if;
  select * into r from public.settings_history where company_id = 'c1070000-0000-0000-0000-00000000000a' and menu = '자차 유류비';
  if r.changes <> '[{"label": "km당 단가", "from": "200원", "to": "250원"}]'::jsonb then raise exception 'FAIL [fuel] %', r.changes; end if;
  select * into r from public.settings_history where company_id = 'c1070000-0000-0000-0000-00000000000a' and menu = '기능 사용';
  if r.changes -> 0 ->> 'from' <> '켬' then raise exception 'FAIL [feature default from] %', r.changes; end if; -- 173: 캘린더는 줄이 없으면 켜짐
  if r.target <> '사내 캘린더' or r.changes -> 0 ->> 'to' <> '끔' then raise exception 'FAIL [feature] %', row_to_json(r); end if;
  select count(*) into n from public.settings_history where company_id = 'c1070000-0000-0000-0000-00000000000a' and menu = '사전 검토 결재라인';
  if n <> 2 then raise exception 'FAIL [approval count %]', n; end if;
  if not exists (select 1 from public.settings_history where menu = '사전 검토 결재라인' and changes -> 0 ->> 'to' = 'A팀장' and changes -> 0 ->> 'from' = '없음(관리자에게 바로)') then raise exception 'FAIL [approval diff]'; end if;
end;
$$;

-- 보기: A 대표는 자기 회사만, 직원은 못 봄, 고치기·지우기 막힘
set local role authenticated;
do $$ begin if (select count(*) from public.settings_history) <> 7 then raise exception 'FAIL [A sees own]'; end if; end; $$;
select public._t_raises107($q$update public.settings_history set member_name = 'x'$q$, '42501', 'update locked');
select public._t_raises107($q$delete from public.settings_history$q$, '42501', 'delete locked');
select public._t_raises107($q$insert into public.settings_history (company_id, area, menu, action) values ('c1070000-0000-0000-0000-00000000000a', 'company', 'x', 'add')$q$, '42501', 'insert blocked');
reset role;
select public._t_as107('a1070000-0000-0000-0000-000000000002');
set local role authenticated;
do $$ begin if exists (select 1 from public.settings_history) then raise exception 'FAIL [employee reads]'; end if; end; $$;
reset role;
select public._t_as107('a1070000-0000-0000-0000-000000000003');
set local role authenticated;
do $$ begin if exists (select 1 from public.settings_history) then raise exception 'FAIL [B sees A]'; end if; end; $$;
reset role;
-- B 대표가 A 회사 줄을 바꾸는 시도(권한 없는 경로) — 기록 회사는 바꾼 줄의 회사, 바꾼 사람은 그 회사 멤버가 아니라 안 남음
update public.departments set name = '침입' where company_id = 'c1070000-0000-0000-0000-00000000000a' and name = '영업1팀';
do $$ begin if exists (select 1 from public.settings_history where target = '침입' or changes::text like '%침입%') then raise exception 'FAIL [cross-company logged]'; end if; end; $$;

-- 173: 예산 추가·삭제 = 금액이 보임, 부서 추가 = 이름(대상)과 겹치는 값은 안 남김
select public._t_as107('a1070000-0000-0000-0000-000000000001');
insert into public.company_budgets (company_id, account_title_id, monthly_amount) values ('c1070000-0000-0000-0000-00000000000a', null, 3000000);
delete from public.company_budgets where company_id = 'c1070000-0000-0000-0000-00000000000a' and account_title_id is null;
do $$ declare r public.settings_history; begin
  select * into r from public.settings_history where company_id = 'c1070000-0000-0000-0000-00000000000a' and menu = '예산' and action = 'add';
  if r.changes <> '[{"label": "월 예산", "from": null, "to": "3,000,000원"}]'::jsonb then raise exception 'FAIL [budget add] %', r.changes; end if;
  select * into r from public.settings_history where company_id = 'c1070000-0000-0000-0000-00000000000a' and menu = '예산' and action = 'remove';
  if r.changes <> '[{"label": "월 예산", "from": "3,000,000원", "to": null}]'::jsonb then raise exception 'FAIL [budget remove] %', r.changes; end if;
  select * into r from public.settings_history where company_id = 'c1070000-0000-0000-0000-00000000000a' and menu = '부서' and action = 'add';
  if r.changes <> '[]'::jsonb then raise exception 'FAIL [dept add] %', r.changes; end if;
end $$;

-- 회사 삭제 = 함께 지워짐
select public._t_as107('00000000-0000-0000-0000-000000000000');
delete from public.companies where id = 'c1070000-0000-0000-0000-00000000000a';
do $$ begin if exists (select 1 from public.settings_history where company_id = 'c1070000-0000-0000-0000-00000000000a') then raise exception 'FAIL [cascade]'; end if; end; $$;

select 'ok' as settings_history_107;
rollback;
