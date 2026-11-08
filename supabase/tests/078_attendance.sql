-- =============================================================================
-- 078_attendance.sql — 근태 1단계 (D-236, migration 124)
-- 관리자만 설정 · 변경 이력(고치기·지우기 불가) · 단말 연결 코드 · 하루 출근1/퇴근1 · 회사 격리 · 자동 퇴근
-- =============================================================================
begin;

create function public._t_raises78(p_sql text, p_code text, p_label text)
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
grant execute on function public._t_raises78(text, text, text) to authenticated, service_role;
create function public._t_as78(p_uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
end;
$$;

insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at) values
  ('a7800000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'boss78@test.local', now()),
  ('a7800000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'emp78@test.local', now()),
  ('a7800000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'emp78b@test.local', now()),
  ('a7800000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bboss78@test.local', now());
insert into public.companies (id, name, invite_code, business_number) values
  ('c7800000-0000-0000-0000-00000000000a', '근태A', 'ATTAAAAA', '1000000781'),
  ('c7800000-0000-0000-0000-00000000000b', '근태B', 'ATTBBBBB', '1000000782');
insert into public.members (id, auth_user_id, company_id, name, phone, role, status, privacy_agreed_at) values
  ('a7810000-0000-0000-0000-000000000001', 'a7800000-0000-0000-0000-000000000001', 'c7800000-0000-0000-0000-00000000000a', 'A대표', '01097801001', 'super_admin', 'approved', now()),
  ('a7810000-0000-0000-0000-000000000002', 'a7800000-0000-0000-0000-000000000002', 'c7800000-0000-0000-0000-00000000000a', 'A직원', '01097801002', 'employee', 'approved', now()),
  ('a7810000-0000-0000-0000-000000000003', 'a7800000-0000-0000-0000-000000000003', 'c7800000-0000-0000-0000-00000000000a', 'A직원2', '01097801003', 'employee', 'approved', now()),
  ('a7810000-0000-0000-0000-000000000004', 'a7800000-0000-0000-0000-000000000004', 'c7800000-0000-0000-0000-00000000000b', 'B대표', '01097801004', 'super_admin', 'approved', now());

-- ① 직원은 근태를 켜거나 설정·단말·이력을 볼 수 없다. 서버 전용 함수도 못 부른다
select public._t_as78('a7800000-0000-0000-0000-000000000002');
set local role authenticated;
do $$
begin
  perform public._t_raises78($q$select public.attendance_set_enabled(true)$q$, '42501', 'emp enable');
  perform public._t_raises78($q$select public.attendance_settings_save('{}')$q$, '42501', 'emp save');
  perform public._t_raises78($q$select public.attendance_admin_view()$q$, '42501', 'emp view');
  perform public._t_raises78($q$select public.attendance_punch('c7800000-0000-0000-0000-00000000000a', gen_random_uuid(), 'a7810000-0000-0000-0000-000000000002', false)$q$, '42501', 'emp punch rpc');
  perform public._t_raises78($q$select public.attendance_terminal_pair(repeat('a', 64), repeat('b', 64), null)$q$, '42501', 'emp pair rpc');
  perform public._t_raises78($q$insert into public.attendance_days (company_id, member_id, work_date, in_at, sched_end, alert_minutes) values ('c7800000-0000-0000-0000-00000000000a', 'a7810000-0000-0000-0000-000000000002', current_date, now(), '18:00', 60)$q$, '42501', 'emp direct write');
  if public.my_attendance_today() is not null then raise exception 'FAIL [off → null]'; end if;
end;
$$;
reset role;

-- ② 관리자: 켜기 → 이력 / 설정 저장 → 바뀐 항목만 이력 / 그대로 저장하면 이력 없음 / 출근 ≥ 퇴근 거절
select public._t_as78('a7800000-0000-0000-0000-000000000001');
set local role authenticated;
do $$
declare
  v jsonb;
  n integer;
begin
  perform public.attendance_set_enabled(true);
  perform public.attendance_set_enabled(true); -- 같은 값이면 이력 안 남김
  v := public.attendance_admin_view();
  if not (v ->> 'enabled')::boolean then raise exception 'FAIL [enabled]'; end if;
  if v -> 'settings' ->> 'work_end' <> '18:00' or v -> 'settings' -> 'work_days' <> '[1,2,3,4,5]'::jsonb then raise exception 'FAIL [defaults %]', v -> 'settings'; end if;
  if jsonb_array_length(v -> 'history') <> 1 or v -> 'history' -> 0 -> 'changes' -> 0 ->> 'to' <> '켜짐' then raise exception 'FAIL [enable history %]', v -> 'history'; end if;

  perform public.attendance_settings_save('{"work_start":"09:00","work_end":"18:30","daily_hours":8,"work_days":[1,2,3,4,5,6],"missing_alert_minutes":120,"leave_year_basis":"calendar","under_five":false}');
  v := public.attendance_admin_view();
  if v -> 'history' -> 0 ->> 'action' <> 'settings' or jsonb_array_length(v -> 'history' -> 0 -> 'changes') <> 3 then raise exception 'FAIL [diff %]', v -> 'history' -> 0; end if;
  if v -> 'history' -> 0 ->> 'member_name' <> 'A대표' then raise exception 'FAIL [who]'; end if;
  if not exists (select 1 from jsonb_array_elements(v -> 'history' -> 0 -> 'changes') c where c ->> 'label' = '근무 요일' and c ->> 'from' = '월·화·수·목·금' and c ->> 'to' = '월·화·수·목·금·토') then raise exception 'FAIL [days label]'; end if;
  n := jsonb_array_length(v -> 'history');
  perform public.attendance_settings_save('{"work_start":"09:00","work_end":"18:30","daily_hours":8,"work_days":[6,1,2,3,4,5],"missing_alert_minutes":120,"leave_year_basis":"calendar","under_five":false}');
  if jsonb_array_length(public.attendance_admin_view() -> 'history') <> n then raise exception 'FAIL [no-op saved history]'; end if;
  perform public._t_raises78($q$select public.attendance_settings_save('{"work_start":"18:00","work_end":"09:00","daily_hours":8,"work_days":[1],"missing_alert_minutes":60,"leave_year_basis":"calendar","under_five":false}')$q$, 'WORK_TIME_ORDER', 'order');
  perform public._t_raises78($q$select public.attendance_settings_save('{"work_start":"09:05","work_end":"18:00","daily_hours":8,"work_days":[1],"missing_alert_minutes":60,"leave_year_basis":"calendar","under_five":false}')$q$, '23514', '10 min unit');
  perform public._t_raises78($q$select public.attendance_settings_save('{"work_start":"09:00","work_end":"18:00","daily_hours":8,"work_days":[],"missing_alert_minutes":60,"leave_year_basis":"calendar","under_five":false}')$q$, 'INVALID', 'no days');
  perform public._t_raises78($q$select public.attendance_settings_save('{"work_start":"09:00","work_end":"18:00","daily_hours":8,"work_days":[1],"missing_alert_minutes":45,"leave_year_basis":"calendar","under_five":false}')$q$, '23514', 'alert options');

  -- 연결 코드
  perform public.attendance_pair_code_create('1층 입구', repeat('c', 64));
  perform public._t_raises78($q$select public.attendance_pair_code_create('', repeat('d', 64))$q$, 'NAME_LENGTH', 'name');
  -- 이력은 관리자도 고치거나 지울 수 없다(권한 자체가 없음)
  perform public._t_raises78($q$delete from public.attendance_history$q$, '42501', 'admin delete history');
end;
$$;
reset role;

-- 이력은 서버(소유자)로도 못 고친다
do $$
begin
  perform public._t_raises78($q$update public.attendance_history set member_name = 'x' where company_id = 'c7800000-0000-0000-0000-00000000000a'$q$, 'HISTORY_LOCKED', 'owner update');
  perform public._t_raises78($q$delete from public.attendance_history where company_id = 'c7800000-0000-0000-0000-00000000000a'$q$, 'HISTORY_LOCKED', 'owner delete');
end;
$$;

-- ③ 서버(service role): 연결 코드로 단말 등록(한 번만) → 이력
set local role service_role;
do $$
declare v jsonb;
begin
  v := public.attendance_terminal_pair(repeat('c', 64), repeat('k', 64), '1.2.3.4');
  if v ->> 'name' <> '1층 입구' or (v ->> 'company_id')::uuid <> 'c7800000-0000-0000-0000-00000000000a' then raise exception 'FAIL [pair %]', v; end if;
  perform set_config('t.term', v ->> 'terminal_id', true);
  perform public._t_raises78($q$select public.attendance_terminal_pair(repeat('c', 64), repeat('j', 64), '1.2.3.4')$q$, 'CODE_INVALID', 'code once');
  if public.attendance_terminal_auth(repeat('k', 64)) ->> 'status' <> 'ok' then raise exception 'FAIL [auth]'; end if;
  if public.attendance_terminal_auth(repeat('z', 64)) ->> 'status' <> 'revoked' then raise exception 'FAIL [unknown key]'; end if;
end;
$$;
reset role;

-- ④ 출퇴근(06:00 이후에만): 출근 → 1분 안 재스캔은 출근 그대로 → 확인 요청 → 퇴근 → 이미 퇴근 / 다른 회사 직원 거절
do $$
declare
  v jsonb;
  v_term uuid := current_setting('t.term')::uuid;
begin
  if extract(hour from now() at time zone 'Asia/Seoul') < 6 then
    perform public._t_raises78(format($q$select public.attendance_punch('c7800000-0000-0000-0000-00000000000a', %L, 'a7810000-0000-0000-0000-000000000002', false)$q$, v_term), 'CLOSED_HOURS', 'closed');
    return;
  end if;
  v := public.attendance_punch('c7800000-0000-0000-0000-00000000000a', v_term, 'a7810000-0000-0000-0000-000000000002', false);
  if v ->> 'result' <> 'in' then raise exception 'FAIL [in %]', v; end if;
  v := public.attendance_punch('c7800000-0000-0000-0000-00000000000a', v_term, 'a7810000-0000-0000-0000-000000000002', true);
  if v ->> 'result' <> 'in' then raise exception 'FAIL [dup in within 1 min %]', v; end if;
  update public.attendance_days set in_at = in_at - interval '3 hours' where member_id = 'a7810000-0000-0000-0000-000000000002';
  v := public.attendance_punch('c7800000-0000-0000-0000-00000000000a', v_term, 'a7810000-0000-0000-0000-000000000002', false);
  if v ->> 'result' <> 'confirm_out' then raise exception 'FAIL [confirm %]', v; end if;
  v := public.attendance_punch('c7800000-0000-0000-0000-00000000000a', v_term, 'a7810000-0000-0000-0000-000000000002', true);
  if v ->> 'result' <> 'out' then raise exception 'FAIL [out %]', v; end if;
  v := public.attendance_punch('c7800000-0000-0000-0000-00000000000a', v_term, 'a7810000-0000-0000-0000-000000000002', true);
  if v ->> 'result' <> 'already' then raise exception 'FAIL [already %]', v; end if;
  if (select sched_end from public.attendance_days where member_id = 'a7810000-0000-0000-0000-000000000002') <> '18:30' then raise exception 'FAIL [sched snapshot]'; end if;
  perform public._t_raises78(format($q$select public.attendance_punch('c7800000-0000-0000-0000-00000000000a', %L, 'a7810000-0000-0000-0000-000000000004', false)$q$, v_term), 'NOT_MEMBER', 'other company');
  perform public._t_raises78(format($q$select public.attendance_punch('c7800000-0000-0000-0000-00000000000b', %L, 'a7810000-0000-0000-0000-000000000004', false)$q$, v_term), 'FEATURE_DISABLED', 'B off');
end;
$$;

-- ⑤ 보이는 범위: 직원2는 남의 기록 못 봄 / 다른 회사 관리자는 못 봄 / 직원은 단말·이력 못 봄
insert into public.attendance_days (company_id, member_id, work_date, in_at, sched_end, alert_minutes)
values ('c7800000-0000-0000-0000-00000000000a', 'a7810000-0000-0000-0000-000000000003', (now() at time zone 'Asia/Seoul')::date - 1, (((now() at time zone 'Asia/Seoul')::date - 1) + time '08:00') at time zone 'Asia/Seoul', '18:00', 60);
select public._t_as78('a7800000-0000-0000-0000-000000000003');
set local role authenticated;
do $$
begin
  if (select count(*) from public.attendance_days) <> 1 then raise exception 'FAIL [own only]'; end if;
  if (select count(*) from public.attendance_terminals) <> 0 or (select count(*) from public.attendance_history) <> 0 then raise exception 'FAIL [emp sees admin rows]'; end if;
  if (select count(*) from public.attendance_settings) <> 1 then raise exception 'FAIL [settings readable]'; end if;
end;
$$;
reset role;
select public._t_as78('a7800000-0000-0000-0000-000000000004');
set local role authenticated;
do $$
begin
  if (select count(*) from public.attendance_days) + (select count(*) from public.attendance_terminals) + (select count(*) from public.attendance_history) <> 0 then raise exception 'FAIL [cross company]'; end if;
  perform public._t_raises78($q$select public.attendance_terminal_revoke(current_setting('t.term')::uuid)$q$, 'NOT_FOUND', 'cross revoke');
end;
$$;
reset role;

-- ⑥ 자정 지난 날 퇴근 없음 → 정규 퇴근으로 자동 기록
do $$
declare d public.attendance_days;
begin
  perform private.attendance_tick();
  select * into d from public.attendance_days where member_id = 'a7810000-0000-0000-0000-000000000003';
  if d.out_method <> 'auto' or (d.out_at at time zone 'Asia/Seoul')::time <> '18:00' or (d.out_at at time zone 'Asia/Seoul')::date <> d.work_date then raise exception 'FAIL [auto out %]', d; end if;
end;
$$;

-- ⑥-2 퇴근 누락 알림 문구에 자동 기록 안내가 들어 있음(D-238)
do $$
begin
  if (select prosrc from pg_proc where oid = 'private.attendance_tick()'::regprocedure) not like '%자정까지 안 찍으면 정규 퇴근 시각(%)으로 자동 기록돼요.%' then
    raise exception 'FAIL [alert text]';
  end if;
end;
$$;

-- ⑦ 해제한 단말은 바로 무효 + 이력
select public._t_as78('a7800000-0000-0000-0000-000000000001');
set local role authenticated;
do $$
begin
  perform public.attendance_terminal_rename(current_setting('t.term')::uuid, '정문');
  perform public.attendance_terminal_revoke(current_setting('t.term')::uuid);
  if (select count(*) from public.attendance_history where action in ('terminal_add', 'terminal_rename', 'terminal_revoke')) <> 3 then raise exception 'FAIL [terminal history]'; end if;
end;
$$;
reset role;
set local role service_role;
do $$
begin
  if public.attendance_terminal_auth(repeat('k', 64)) ->> 'status' <> 'revoked' then raise exception 'FAIL [revoked]'; end if;
end;
$$;
reset role;

select 'ok' as attendance_078;
rollback;
