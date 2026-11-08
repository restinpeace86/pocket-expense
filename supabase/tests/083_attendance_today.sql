-- =============================================================================
-- 083_attendance_today.sql — 근태 ⑧ 오늘 출근 현황 (D-242, migration 131)
-- 관리자만 · 회사 격리 · 그날 기록·승인 휴가(종류) · 날짜 범위 / 관리자용 직원 월 근태(다른 회사 멤버는 못 봄)
-- =============================================================================
begin;

create function public._t_raises83(p_sql text, p_code text, p_label text)
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
grant execute on function public._t_raises83(text, text, text) to authenticated;
create function public._t_as83(p_uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
end;
$$;

insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at) values
  ('a8400000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'boss83@test.local', now()),
  ('a8400000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'emp83@test.local', now()),
  ('a8400000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'emp83b@test.local', now()),
  ('a8400000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bboss83@test.local', now());
insert into public.companies (id, name, invite_code, business_number) values
  ('c8400000-0000-0000-0000-00000000000a', '현황A', 'TDAAAAAA', '1000000831'),
  ('c8400000-0000-0000-0000-00000000000b', '현황B', 'TDBBBBBB', '1000000832');
insert into public.members (id, auth_user_id, company_id, name, phone, role, status, privacy_agreed_at, approved_at) values
  ('a8410000-0000-0000-0000-000000000001', 'a8400000-0000-0000-0000-000000000001', 'c8400000-0000-0000-0000-00000000000a', 'A대표', '01098301001', 'super_admin', 'approved', now(), now() - interval '30 days'),
  ('a8410000-0000-0000-0000-000000000002', 'a8400000-0000-0000-0000-000000000002', 'c8400000-0000-0000-0000-00000000000a', 'A직원', '01098301002', 'employee', 'approved', now(), now() - interval '30 days'),
  ('a8410000-0000-0000-0000-000000000003', 'a8400000-0000-0000-0000-000000000003', 'c8400000-0000-0000-0000-00000000000a', 'A직원2', '01098301003', 'employee', 'approved', now(), now() - interval '30 days'),
  ('a8410000-0000-0000-0000-000000000004', 'a8400000-0000-0000-0000-000000000004', 'c8400000-0000-0000-0000-00000000000b', 'B대표', '01098301004', 'super_admin', 'approved', now(), now() - interval '30 days');
insert into public.company_features (company_id, feature, enabled) values ('c8400000-0000-0000-0000-00000000000a', 'attendance', true), ('c8400000-0000-0000-0000-00000000000b', 'attendance', true)
  on conflict (company_id, feature) do update set enabled = true;
insert into public.attendance_settings (company_id) values ('c8400000-0000-0000-0000-00000000000a'), ('c8400000-0000-0000-0000-00000000000b');
insert into public.attendance_days (company_id, member_id, work_date, in_at, holiday, sched_end, alert_minutes)
values ('c8400000-0000-0000-0000-00000000000a', 'a8410000-0000-0000-0000-000000000002', (now() at time zone 'Asia/Seoul')::date, now() - interval '1 hour', false, '18:00', 60);
select public._t_as83('a8400000-0000-0000-0000-000000000001');
set local role authenticated;
select public.attendance_leave_types_list();
reset role;
insert into public.attendance_leaves (company_id, member_id, member_name, member_role, type_id, type_name, deducts, proof, unit, start_date, end_date, workdays, status, decided_at)
select 'c8400000-0000-0000-0000-00000000000a', 'a8410000-0000-0000-0000-000000000003', 'A직원2', 'employee', t.id, '병가', false, 'required', 'day',
  (now() at time zone 'Asia/Seoul')::date, (now() at time zone 'Asia/Seoul')::date, 1, 'approved', now()
from public.attendance_leave_types t where t.company_id = 'c8400000-0000-0000-0000-00000000000a' and t.builtin_key = 'sick';

-- ① 관리자: 그날 현황
select public._t_as83('a8400000-0000-0000-0000-000000000001');
set local role authenticated;
do $$
declare v jsonb;
begin
  v := public.attendance_day_admin((now() at time zone 'Asia/Seoul')::date);
  if jsonb_array_length(v -> 'members') <> 3 or jsonb_array_length(v -> 'days') <> 1 or jsonb_array_length(v -> 'leaves') <> 1 then raise exception 'FAIL [day %]', v; end if;
  if v -> 'leaves' -> 0 ->> 'type_name' <> '병가' then raise exception 'FAIL [admin sees type]'; end if;
  perform public._t_raises83($q$select public.attendance_day_admin((now() at time zone 'Asia/Seoul')::date - 200)$q$, 'OUT_OF_RANGE', 'range');
  v := public.attendance_member_month('a8410000-0000-0000-0000-000000000002', to_char(now() at time zone 'Asia/Seoul', 'YYYY-MM'));
  if jsonb_array_length(v -> 'days') <> 1 or v -> 'member' ->> 'name' <> 'A직원' then raise exception 'FAIL [member month %]', v -> 'member'; end if;
  perform public._t_raises83($q$select public.attendance_member_month('a8410000-0000-0000-0000-000000000004', '2026-11')$q$, 'NOT_FOUND', 'cross member');
end;
$$;
reset role;

-- ② 직원은 못 씀 · 본인 월 근태는 그대로
select public._t_as83('a8400000-0000-0000-0000-000000000002');
set local role authenticated;
do $$
begin
  perform public._t_raises83($q$select public.attendance_day_admin((now() at time zone 'Asia/Seoul')::date)$q$, 'NOT_ALLOWED', 'employee day');
  perform public._t_raises83($q$select public.attendance_member_month('a8410000-0000-0000-0000-000000000003', '2026-11')$q$, 'NOT_ALLOWED', 'employee member month');
  if jsonb_array_length(public.my_attendance_month(to_char(now() at time zone 'Asia/Seoul', 'YYYY-MM')) -> 'days') <> 1 then raise exception 'FAIL [my month]'; end if;
end;
$$;
reset role;

-- ③ 다른 회사 관리자: 우리 회사 사람 안 보임
select public._t_as83('a8400000-0000-0000-0000-000000000004');
set local role authenticated;
do $$
declare v jsonb;
begin
  v := public.attendance_day_admin((now() at time zone 'Asia/Seoul')::date);
  if jsonb_array_length(v -> 'members') <> 1 or jsonb_array_length(v -> 'days') <> 0 or jsonb_array_length(v -> 'leaves') <> 0 then raise exception 'FAIL [cross %]', v; end if;
end;
$$;
reset role;

select 'ok' as attendance_today_083;
rollback;
