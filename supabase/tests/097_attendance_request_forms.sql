-- 097_attendance_request_forms.sql — 근태 정정·휴일근무 신청서를 회사 양식으로 (9-33c, migration 160)
-- 양식이 없으면 그대로 / 있으면 쓴 양식 버전 + 직원 입력 칸만 저장(필수·다른 회사 직원 막힘) / 신청 뒤 못 바꿈 / 종류마다 하나 / 다른 회사 양식은 안 씀
begin;
create function public._t_raises97(p_sql text, p_code text, p_label text)
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
grant execute on function public._t_raises97(text, text, text) to authenticated;
create function public._t_as97(p_uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
end;
$$;

insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at) values
  ('a9700000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'boss97@test.local', now()),
  ('a9700000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'emp97@test.local', now()),
  ('a9700000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'emp97b@test.local', now()),
  ('a9700000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bboss97@test.local', now());
insert into public.companies (id, name, invite_code, business_number) values
  ('c9700000-0000-0000-0000-00000000000a', '근태양식A', 'AFAAAAAA', '1000000971'),
  ('c9700000-0000-0000-0000-00000000000b', '근태양식B', 'AFBBBBBB', '1000000972');
insert into public.members (id, auth_user_id, company_id, name, phone, role, status, privacy_agreed_at, approved_at) values
  ('a9710000-0000-0000-0000-000000000001', 'a9700000-0000-0000-0000-000000000001', 'c9700000-0000-0000-0000-00000000000a', 'A대표', '01099701001', 'super_admin', 'approved', now(), now() - interval '400 days'),
  ('a9710000-0000-0000-0000-000000000002', 'a9700000-0000-0000-0000-000000000002', 'c9700000-0000-0000-0000-00000000000a', 'A직원', '01099701002', 'employee', 'approved', now(), now() - interval '400 days'),
  ('a9710000-0000-0000-0000-000000000003', 'a9700000-0000-0000-0000-000000000003', 'c9700000-0000-0000-0000-00000000000a', 'A직원2', '01099701003', 'employee', 'approved', now(), now() - interval '400 days'),
  ('a9710000-0000-0000-0000-000000000004', 'a9700000-0000-0000-0000-000000000004', 'c9700000-0000-0000-0000-00000000000b', 'B대표', '01099701004', 'super_admin', 'approved', now(), now() - interval '400 days');

-- 근태 켜기(이력 날짜를 이번 달 1일로), 모든 요일 근무, 오늘 기록
select public._t_as97('a9700000-0000-0000-0000-000000000001');
set local role authenticated;
select public.attendance_set_enabled(true);
reset role;
alter table public.attendance_history disable trigger attendance_history_guard;
update public.attendance_history set at = date_trunc('month', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul' where company_id = 'c9700000-0000-0000-0000-00000000000a';
alter table public.attendance_history enable trigger attendance_history_guard;
update public.attendance_settings set work_days = '{1,2,3,4,5,6,7}' where company_id = 'c9700000-0000-0000-0000-00000000000a';
delete from public.kr_holidays where day = (now() at time zone 'Asia/Seoul')::date;
select set_config('t.today', ((now() at time zone 'Asia/Seoul')::date)::text, true);
insert into public.attendance_days (company_id, member_id, work_date, in_at, out_at, out_method, holiday, sched_end, alert_minutes) values
  ('c9700000-0000-0000-0000-00000000000a', 'a9710000-0000-0000-0000-000000000002', current_setting('t.today')::date,
   (current_setting('t.today')::date + time '00:00') at time zone 'Asia/Seoul', (current_setting('t.today')::date + time '00:02') at time zone 'Asia/Seoul', 'qr', false, '18:00', 60),
  ('c9700000-0000-0000-0000-00000000000a', 'a9710000-0000-0000-0000-000000000003', current_setting('t.today')::date,
   (current_setting('t.today')::date + time '00:00') at time zone 'Asia/Seoul', (current_setting('t.today')::date + time '00:02') at time zone 'Asia/Seoul', 'qr', true, '18:00', 60);

-- ① 양식이 없으면 지금처럼(form_id 없음, 추가 항목 무시) — 5개 인자 호출도 그대로 된다
select public._t_as97('a9700000-0000-0000-0000-000000000002');
set local role authenticated;
do $$
begin
  perform set_config('t.r1', (public.attendance_request_create(current_setting('t.today')::date, 'correction', '00:00', '00:01', '사유', '{"x":"y"}'::jsonb) ->> 'id'), true);
  perform public.attendance_request_cancel(current_setting('t.r1')::uuid);
end;
$$;
reset role;
do $$
begin
  if (select form_id is not null or custom_payload <> '{}'::jsonb from public.attendance_requests where id = current_setting('t.r1')::uuid) then raise exception 'FAIL [no form]'; end if;
end;
$$;

-- ② 종류 확인: correction·holiday 허용, 그 밖은 막힘. 근태 양식은 회사에 종류마다 하나(active)
insert into public.company_forms (id, company_id, group_id, version, kind, name, status, sheets, fields, reads, published_at, source_path, mime)
values ('f9700000-0000-0000-0000-000000000001', 'c9700000-0000-0000-0000-00000000000a', 'f9700000-0000-0000-0000-000000000001', 1, 'correction', '근태정정신청서', 'active',
  '{"v":1,"sheets":[{"name":"1쪽","cols":[50,50],"heights":[1,1,1],"cells":[[{"t":"성명"},{"t":""}],[{"t":"연락처"},{"t":""}],[{"t":"확인자"},{"t":""}]],"merges":[]}]}'::jsonb,
  '[{"key":"f1","label":"성명","s":0,"r":0,"c":1,"b":{"k":"data","src":"member.name"}},
    {"key":"f2","label":"연락처","s":0,"r":1,"c":1,"b":{"k":"input","type":"text","required":true}},
    {"key":"f3","label":"확인자","s":0,"r":2,"c":1,"b":{"k":"input","type":"member","required":false}}]'::jsonb, 1, now(), 'c9700000-0000-0000-0000-00000000000a/f97-1.png', 'image/png'),
  ('f9700000-0000-0000-0000-000000000002', 'c9700000-0000-0000-0000-00000000000a', 'f9700000-0000-0000-0000-000000000002', 1, 'holiday', '휴일근무신청서', 'active',
  '{"v":1,"sheets":[{"name":"1쪽","cols":[50,50],"heights":[1],"cells":[[{"t":"근무일"},{"t":""}]],"merges":[]}]}'::jsonb,
  '[{"key":"h1","label":"근무일","s":0,"r":0,"c":1,"b":{"k":"data","src":"holiday.date"}}]'::jsonb, 1, now(), 'c9700000-0000-0000-0000-00000000000a/f97-2.png', 'image/png'),
  -- B회사 정정 양식: A회사 신청에 쓰이면 안 된다
  ('f9700000-0000-0000-0000-000000000009', 'c9700000-0000-0000-0000-00000000000b', 'f9700000-0000-0000-0000-000000000009', 1, 'correction', 'B정정', 'active',
  '{"v":1,"sheets":[{"name":"1쪽","cols":[50],"heights":[1],"cells":[[{"t":""}]],"merges":[]}]}'::jsonb, '[]'::jsonb, 1, now(), 'c9700000-0000-0000-0000-00000000000b/f97-9.png', 'image/png');
do $$
begin
  perform public._t_raises97($q$insert into public.company_forms (id, company_id, group_id, kind, name, status, source_path, mime) values (gen_random_uuid(), 'c9700000-0000-0000-0000-00000000000a', gen_random_uuid(), 'overtime', 'x', 'draft', 'x.png', 'image/png')$q$, '23514', 'bad kind');
  perform public._t_raises97($q$insert into public.company_forms (id, company_id, group_id, version, kind, name, status, source_path, mime, sheets) values (gen_random_uuid(), 'c9700000-0000-0000-0000-00000000000a', gen_random_uuid(), 1, 'correction', '두번째', 'active', 'y.png', 'image/png', '{"v":1,"sheets":[]}')$q$, '23505', 'one correction');
end;
$$;

-- ③ 정정 + 양식: 필수 빈칸·다른 회사 직원은 막힘, 정상이면 쓴 양식 버전 + 직원 입력 칸만(이름으로)
select public._t_as97('a9700000-0000-0000-0000-000000000002');
set local role authenticated;
do $$
begin
  perform public._t_raises97(format($q$select public.attendance_request_create(%L, 'correction', '00:00', '00:01', '사유', '{}')$q$, current_setting('t.today')), 'CUSTOM_REQUIRED', 'required');
  perform public._t_raises97(format($q$select public.attendance_request_create(%L, 'correction', '00:00', '00:01', '사유', '{"f2":"010","f3":"a9710000-0000-0000-0000-000000000004"}')$q$, current_setting('t.today')), 'CUSTOM_INVALID', 'other company member');
  perform set_config('t.r2', (public.attendance_request_create(current_setting('t.today')::date, 'correction', '00:00', '00:01', '퇴근 뒤 더 일했어요',
    '{"f2":" 010-1111-2222 ","f3":"a9710000-0000-0000-0000-000000000001","f1":"끼워넣기","zz":"x"}'::jsonb) ->> 'id'), true);
end;
$$;
reset role;
do $$
declare r public.attendance_requests;
begin
  select * into r from public.attendance_requests where id = current_setting('t.r2')::uuid;
  if r.form_id <> 'f9700000-0000-0000-0000-000000000001' then raise exception 'FAIL [form id %]', r.form_id; end if;
  if r.custom_payload <> '{"f2":"010-1111-2222","f3":"A대표"}'::jsonb then raise exception 'FAIL [payload %]', r.custom_payload; end if;
end;
$$;

-- ④ 휴일 근무 + 양식(직원 입력 칸 없음) → 양식 버전만
select public._t_as97('a9700000-0000-0000-0000-000000000003');
set local role authenticated;
do $$
begin
  perform set_config('t.r3', (public.attendance_request_create(current_setting('t.today')::date, 'holiday', '00:00', '00:02', '주말 고객 대응') ->> 'id'), true);
end;
$$;
reset role;
do $$
begin
  if (select form_id from public.attendance_requests where id = current_setting('t.r3')::uuid) <> 'f9700000-0000-0000-0000-000000000002' then raise exception 'FAIL [holiday form]'; end if;
end;
$$;

-- ⑤ 화면 JSON에 form_id(받기 버튼), 신청 뒤 양식·추가 항목은 못 바꿈, 승인은 됨
do $$
begin
  if (select r -> 'form_id' from jsonb_array_elements(private.attendance_month_json('c9700000-0000-0000-0000-00000000000a', 'a9710000-0000-0000-0000-000000000002', to_char(current_setting('t.today')::date, 'YYYY-MM')) -> 'requests') r
      where r ->> 'id' = current_setting('t.r2')) is distinct from '"f9700000-0000-0000-0000-000000000001"'::jsonb then
    raise exception 'FAIL [month json form_id]';
  end if;
  perform public._t_raises97(format($q$update public.attendance_requests set custom_payload = '{}' where id = '%s'$q$, current_setting('t.r2')), 'HISTORY_LOCKED', 'locked payload');
  perform public._t_raises97(format($q$update public.attendance_requests set form_id = null where id = '%s'$q$, current_setting('t.r2')), 'HISTORY_LOCKED', 'locked form');
end;
$$;
select public._t_as97('a9700000-0000-0000-0000-000000000001');
set local role authenticated;
do $$
begin
  if (select r -> 'form_id' from jsonb_array_elements(public.attendance_requests_admin() -> 'pending') r where r ->> 'id' = current_setting('t.r2')) is null then
    raise exception 'FAIL [admin json form_id]';
  end if;
  perform public.attendance_request_decide(current_setting('t.r2')::uuid, true, null);
end;
$$;
reset role;
do $$
begin
  if (select status from public.attendance_requests where id = current_setting('t.r2')::uuid) <> 'approved' then raise exception 'FAIL [approve]'; end if;
end;
$$;

-- ⑥ 다른 회사 사람은 A회사 신청 줄을 못 본다(RLS)
select public._t_as97('a9700000-0000-0000-0000-000000000004');
set local role authenticated;
do $$
begin
  if exists (select 1 from public.attendance_requests where company_id = 'c9700000-0000-0000-0000-00000000000a') then raise exception 'FAIL [isolation]'; end if;
end;
$$;
reset role;

select 'ok' as attendance_request_forms_097;
rollback;
