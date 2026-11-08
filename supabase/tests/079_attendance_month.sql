-- =============================================================================
-- 079_attendance_month.sql — 월 근태 현황 조회 (D-237, migration 125)
-- 본인 기록만 / 다른 회사 못 봄 / 근태 꺼지면 막힘 / 형식 검사 / 셀 시작일 = 근태 켠 날·가입 승인일 중 늦은 날
-- =============================================================================
begin;

create function public._t_raises79(p_sql text, p_code text, p_label text)
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
grant execute on function public._t_raises79(text, text, text) to authenticated;
create function public._t_as79(p_uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
end;
$$;

insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at) values
  ('a7900000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'boss79@test.local', now()),
  ('a7900000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'emp79@test.local', now()),
  ('a7900000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'emp79b@test.local', now()),
  ('a7900000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bemp79@test.local', now());
insert into public.companies (id, name, invite_code, business_number) values
  ('c7900000-0000-0000-0000-00000000000a', '월근태A', 'MNTAAAAA', '1000000791'),
  ('c7900000-0000-0000-0000-00000000000b', '월근태B', 'MNTBBBBB', '1000000792');
insert into public.members (id, auth_user_id, company_id, name, phone, role, status, privacy_agreed_at, approved_at) values
  ('a7910000-0000-0000-0000-000000000001', 'a7900000-0000-0000-0000-000000000001', 'c7900000-0000-0000-0000-00000000000a', 'A대표', '01097901001', 'super_admin', 'approved', now(), now() - interval '400 days'),
  ('a7910000-0000-0000-0000-000000000002', 'a7900000-0000-0000-0000-000000000002', 'c7900000-0000-0000-0000-00000000000a', 'A직원', '01097901002', 'employee', 'approved', now(), '2030-01-10 09:00+09'),
  ('a7910000-0000-0000-0000-000000000003', 'a7900000-0000-0000-0000-000000000003', 'c7900000-0000-0000-0000-00000000000a', 'A직원2', '01097901003', 'employee', 'approved', now(), now() - interval '400 days'),
  ('a7910000-0000-0000-0000-000000000004', 'a7900000-0000-0000-0000-000000000004', 'c7900000-0000-0000-0000-00000000000b', 'B직원', '01097901004', 'employee', 'approved', now(), now() - interval '400 days');

-- 근태 켜기(이력 날짜를 2030-01-05로) + 기록
select public._t_as79('a7900000-0000-0000-0000-000000000001');
set local role authenticated;
select public.attendance_set_enabled(true);
reset role;
alter table public.attendance_history disable trigger attendance_history_guard;
update public.attendance_history set at = '2030-01-05 09:00+09' where company_id = 'c7900000-0000-0000-0000-00000000000a';
alter table public.attendance_history enable trigger attendance_history_guard;
insert into public.attendance_days (company_id, member_id, work_date, in_at, out_at, out_method, sched_end, alert_minutes) values
  ('c7900000-0000-0000-0000-00000000000a', 'a7910000-0000-0000-0000-000000000002', '2030-01-14', '2030-01-14 08:57+09', '2030-01-14 18:12+09', 'qr', '18:00', 60),
  ('c7900000-0000-0000-0000-00000000000a', 'a7910000-0000-0000-0000-000000000002', '2030-01-15', '2030-01-15 09:03+09', '2030-01-15 18:00+09', 'auto', '18:00', 60),
  ('c7900000-0000-0000-0000-00000000000a', 'a7910000-0000-0000-0000-000000000002', '2030-02-01', '2030-02-01 09:00+09', null, null, '18:00', 60),
  ('c7900000-0000-0000-0000-00000000000a', 'a7910000-0000-0000-0000-000000000003', '2030-01-14', '2030-01-14 09:10+09', null, null, '18:00', 60);

select public._t_as79('a7900000-0000-0000-0000-000000000002');
set local role authenticated;
do $$
declare v jsonb;
begin
  v := public.my_attendance_month('2030-01');
  if jsonb_array_length(v -> 'days') <> 2 then raise exception 'FAIL [own month only %]', v -> 'days'; end if;
  if v -> 'days' -> 0 ->> 'work_date' <> '2030-01-15' or v -> 'days' -> 0 ->> 'out_method' <> 'auto' then raise exception 'FAIL [order/auto]'; end if;
  if v ->> 'since' <> '2030-01-10' then raise exception 'FAIL [since = later of enabled·approved %]', v ->> 'since'; end if;
  if v -> 'work_days' <> '[1,2,3,4,5]'::jsonb then raise exception 'FAIL [work days]'; end if;
  perform public._t_raises79($q$select public.my_attendance_month('2030-13')$q$, 'INVALID', 'month format');
  perform public._t_raises79($q$select public.my_attendance_month('x')$q$, 'INVALID', 'garbage');
end;
$$;
reset role;

-- 다른 회사 직원: 근태 꺼짐 → 막힘(남의 회사 기록은 애초에 안 보임)
select public._t_as79('a7900000-0000-0000-0000-000000000004');
set local role authenticated;
do $$
begin
  perform public._t_raises79($q$select public.my_attendance_month('2030-01')$q$, 'FEATURE_DISABLED', 'B off');
end;
$$;
reset role;

-- 같은 회사 다른 직원은 자기 것만, 승인일이 더 이르면 근태 켠 날부터
select public._t_as79('a7900000-0000-0000-0000-000000000003');
set local role authenticated;
do $$
declare v jsonb;
begin
  v := public.my_attendance_month('2030-01');
  if jsonb_array_length(v -> 'days') <> 1 or v -> 'days' -> 0 ->> 'in_at' not like '2030-01-14T00:10%' then raise exception 'FAIL [emp2 own %]', v -> 'days'; end if;
  if v ->> 'since' <> '2030-01-05' then raise exception 'FAIL [since enabled %]', v ->> 'since'; end if;
end;
$$;
reset role;

select 'ok' as attendance_month_079;
rollback;
