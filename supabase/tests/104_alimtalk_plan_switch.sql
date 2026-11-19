-- 104_alimtalk_plan_switch.sql — 카카오 알림톡 = 프로 이상 포함 + 관리자 스위치(D-297, migration 169)
-- 기본 꺼짐 · 관리자만 켬 · 직원은 못 켬 · 다른 회사에 영향 없음 · 스타터(포함 안 됨)면 켜기 거절 + 켜 있어도 안 보냄 · 로그인 사용자는 alimtalk_active 못 부름
begin;
create function public._t_raises104(p_sql text, p_code text, p_label text)
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
grant execute on function public._t_raises104(text, text, text) to authenticated;
create function public._t_as104(p_uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
end;
$$;

insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at) values
  ('a1040000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'boss104@test.local', now()),
  ('a1040000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'emp104@test.local', now()),
  ('a1040000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bossb104@test.local', now());
insert into public.companies (id, name, invite_code, business_number) values
  ('c1040000-0000-0000-0000-00000000000a', '알림A', 'ALMKAAAA', '1000001104'),
  ('c1040000-0000-0000-0000-00000000000b', '알림B', 'ALMKBBBB', '1000002104');
insert into public.members (id, auth_user_id, company_id, name, phone, role, status, privacy_agreed_at, approved_at) values
  ('a1041000-0000-0000-0000-000000000001', 'a1040000-0000-0000-0000-000000000001', 'c1040000-0000-0000-0000-00000000000a', 'A대표', '01010401001', 'super_admin', 'approved', now(), now()),
  ('a1041000-0000-0000-0000-000000000002', 'a1040000-0000-0000-0000-000000000002', 'c1040000-0000-0000-0000-00000000000a', 'A직원', '01010401002', 'employee', 'approved', now(), now()),
  ('a1041000-0000-0000-0000-000000000003', 'a1040000-0000-0000-0000-000000000003', 'c1040000-0000-0000-0000-00000000000b', 'B대표', '01010401003', 'super_admin', 'approved', now(), now());

do $$
begin
  if (select alimtalk_included from public.billing_plans where code = 'starter') then raise exception 'FAIL [starter included]'; end if;
  if not (select alimtalk_included from public.billing_plans where code = 'standard') or not (select alimtalk_included from public.billing_plans where code = 'pro') then raise exception 'FAIL [pro/business included]'; end if;
  if public.alimtalk_active('c1040000-0000-0000-0000-00000000000a') then raise exception 'FAIL [default off]'; end if;
  if has_function_privilege('authenticated', 'public.alimtalk_active(uuid)', 'EXECUTE') then raise exception 'FAIL [authenticated can call active]'; end if;
  if has_function_privilege('anon', 'public.alimtalk_set_enabled(boolean)', 'EXECUTE') then raise exception 'FAIL [anon can set]'; end if;
end;
$$;

-- 직원은 못 켠다
select public._t_as104('a1040000-0000-0000-0000-000000000002');
set local role authenticated;
select public._t_raises104($q$select public.alimtalk_set_enabled(true)$q$, 'NOT_ALLOWED', 'employee set');
select public._t_raises104($q$select public.alimtalk_status()$q$, 'NOT_ALLOWED', 'employee status');
reset role;

-- 관리자가 켠다 → A만 켜짐(B는 그대로 꺼짐)
select public._t_as104('a1040000-0000-0000-0000-000000000001');
set local role authenticated;
select public.alimtalk_set_enabled(true);
do $$
begin
  if public.alimtalk_status() <> '{"included": true, "enabled": true}'::jsonb then raise exception 'FAIL [status on] %', public.alimtalk_status(); end if;
end;
$$;
reset role;
do $$
begin
  if not public.alimtalk_active('c1040000-0000-0000-0000-00000000000a') then raise exception 'FAIL [A active]'; end if;
  if public.alimtalk_active('c1040000-0000-0000-0000-00000000000b') then raise exception 'FAIL [B untouched]'; end if;
end;
$$;
select public._t_as104('a1040000-0000-0000-0000-000000000003');
set local role authenticated;
do $$
begin
  if public.alimtalk_status() <> '{"included": true, "enabled": false}'::jsonb then raise exception 'FAIL [B status] %', public.alimtalk_status(); end if;
end;
$$;
reset role;

-- 요금제에 알림톡이 없으면(스타터 흉내): 켜 있어도 안 보내고, 새로 켜기는 거절, 끄기는 됨
update public.billing_plans set alimtalk_included = false where code = 'standard';
do $$
begin
  if public.alimtalk_active('c1040000-0000-0000-0000-00000000000a') then raise exception 'FAIL [starter still active]'; end if;
end;
$$;
select public._t_as104('a1040000-0000-0000-0000-000000000003');
set local role authenticated;
select public._t_raises104($q$select public.alimtalk_set_enabled(true)$q$, 'ALIMTALK_PLAN', 'starter set');
reset role;
select public._t_as104('a1040000-0000-0000-0000-000000000001');
set local role authenticated;
select public.alimtalk_set_enabled(false);
reset role;

select 'ok' as alimtalk_104;
rollback;
