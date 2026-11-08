-- =============================================================================
-- 080_attendance_requests.sql — 근태 ⑤ 정정 신청 · 휴일 근무 상신 (D-239, migration 127)
-- 이번 달만 / 시각 검사 / 하루 대기 1건 / 승인자(직원→관리자·대표, 관리자→대표만, 대표→본인 승인) /
-- 건마다 알림 / 승인 반영·원본 보존(수정·삭제 불가) / 휴일 인정 / QR 없는 휴일 불가 / 회사 격리
-- 오늘 날짜에 00:00~00:02 시각을 써서 언제 돌려도 "미래 시각"이 아니게 한다(00:02 KST 이후 실행)
-- =============================================================================
begin;

create function public._t_raises80(p_sql text, p_code text, p_label text)
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
grant execute on function public._t_raises80(text, text, text) to authenticated;
create function public._t_as80(p_uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
end;
$$;
create function public._t_notices80(p_member uuid) returns integer language sql as $$
  select count(*)::int from public.chat_messages m join public.chat_rooms r on r.id = m.room_id where r.notice_member_id = p_member
$$;

insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at) values
  ('a8000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'boss80@test.local', now()),
  ('a8000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'adm80@test.local', now()),
  ('a8000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'adm80b@test.local', now()),
  ('a8000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'emp80@test.local', now()),
  ('a8000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'emp80b@test.local', now()),
  ('a8000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'emp80c@test.local', now()),
  ('a8000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'badm80@test.local', now());
insert into public.companies (id, name, invite_code, business_number) values
  ('c8000000-0000-0000-0000-00000000000a', '정정A', 'RQAAAAAA', '1000000801'),
  ('c8000000-0000-0000-0000-00000000000b', '정정B', 'RQBBBBBB', '1000000802');
insert into public.members (id, auth_user_id, company_id, name, phone, role, status, privacy_agreed_at, approved_at) values
  ('a8100000-0000-0000-0000-000000000001', 'a8000000-0000-0000-0000-000000000001', 'c8000000-0000-0000-0000-00000000000a', 'A대표', '01098001001', 'super_admin', 'approved', now(), now() - interval '400 days'),
  ('a8100000-0000-0000-0000-000000000002', 'a8000000-0000-0000-0000-000000000002', 'c8000000-0000-0000-0000-00000000000a', 'A관리', '01098001002', 'admin', 'approved', now(), now() - interval '400 days'),
  ('a8100000-0000-0000-0000-000000000003', 'a8000000-0000-0000-0000-000000000003', 'c8000000-0000-0000-0000-00000000000a', 'A관리2', '01098001003', 'admin', 'approved', now(), now() - interval '400 days'),
  ('a8100000-0000-0000-0000-000000000004', 'a8000000-0000-0000-0000-000000000004', 'c8000000-0000-0000-0000-00000000000a', 'A직원', '01098001004', 'employee', 'approved', now(), now() - interval '400 days'),
  ('a8100000-0000-0000-0000-000000000005', 'a8000000-0000-0000-0000-000000000005', 'c8000000-0000-0000-0000-00000000000a', 'A직원2', '01098001005', 'employee', 'approved', now(), now() - interval '400 days'),
  ('a8100000-0000-0000-0000-000000000006', 'a8000000-0000-0000-0000-000000000006', 'c8000000-0000-0000-0000-00000000000a', 'A직원3', '01098001006', 'employee', 'approved', now(), now() - interval '400 days'),
  ('a8100000-0000-0000-0000-000000000007', 'a8000000-0000-0000-0000-000000000007', 'c8000000-0000-0000-0000-00000000000b', 'B관리', '01098001007', 'super_admin', 'approved', now(), now() - interval '400 days');

-- 근태 켜기(이력 날짜를 이번 달 1일로) + 메신저 켜기 + 오늘 기록
select public._t_as80('a8000000-0000-0000-0000-000000000001');
set local role authenticated;
select public.attendance_set_enabled(true);
reset role;
alter table public.attendance_history disable trigger attendance_history_guard;
update public.attendance_history set at = date_trunc('month', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul' where company_id = 'c8000000-0000-0000-0000-00000000000a';
alter table public.attendance_history enable trigger attendance_history_guard;
insert into public.company_features (company_id, feature, enabled) values ('c8000000-0000-0000-0000-00000000000a', 'messenger', true)
  on conflict (company_id, feature) do update set enabled = true;
-- 오늘 근무일로 맞춤(모든 요일)
update public.attendance_settings set work_days = '{1,2,3,4,5,6,7}' where company_id = 'c8000000-0000-0000-0000-00000000000a';
delete from public.kr_holidays where day = (now() at time zone 'Asia/Seoul')::date;

select set_config('t.today', ((now() at time zone 'Asia/Seoul')::date)::text, true);
insert into public.attendance_days (company_id, member_id, work_date, in_at, out_at, out_method, holiday, sched_end, alert_minutes) values
  ('c8000000-0000-0000-0000-00000000000a', 'a8100000-0000-0000-0000-000000000004', current_setting('t.today')::date,
   (current_setting('t.today')::date + time '00:00') at time zone 'Asia/Seoul', (current_setting('t.today')::date + time '00:02') at time zone 'Asia/Seoul', 'qr', false, '18:00', 60),
  ('c8000000-0000-0000-0000-00000000000a', 'a8100000-0000-0000-0000-000000000005', current_setting('t.today')::date,
   (current_setting('t.today')::date + time '00:00') at time zone 'Asia/Seoul', null, null, true, '18:00', 60),
  ('c8000000-0000-0000-0000-00000000000a', 'a8100000-0000-0000-0000-000000000002', current_setting('t.today')::date,
   (current_setting('t.today')::date + time '00:00') at time zone 'Asia/Seoul', (current_setting('t.today')::date + time '00:01') at time zone 'Asia/Seoul', 'qr', false, '18:00', 60);

-- ① 직원: 범위·시각·사유 검사 → 정상 신청 → 관리자·대표에게 건마다 알림
select public._t_as80('a8000000-0000-0000-0000-000000000004');
set local role authenticated;
do $$
declare v jsonb; t date := current_setting('t.today')::date;
begin
  perform public._t_raises80(format($q$select public.attendance_request_create(%L, 'correction', '00:00', '00:01', '사유')$q$, date_trunc('month', t)::date - 1), 'OUT_OF_RANGE', 'last month');
  perform public._t_raises80(format($q$select public.attendance_request_create(%L, 'correction', '00:00', '00:01', '사유')$q$, t + 1), 'OUT_OF_RANGE', 'future day');
  perform public._t_raises80(format($q$select public.attendance_request_create(%L, 'correction', '25:00', '26:00', '사유')$q$, t), 'INVALID_TIME', 'bad time');
  perform public._t_raises80(format($q$select public.attendance_request_create(%L, 'correction', '00:02', '00:01', '사유')$q$, t), 'INVALID_TIME', 'in after out');
  perform public._t_raises80(format($q$select public.attendance_request_create(%L, 'correction', '00:00', '23:59', '사유')$q$, t), 'FUTURE_TIME', 'future time');
  perform public._t_raises80(format($q$select public.attendance_request_create(%L, 'correction', '00:01', '00:02', '  ')$q$, t), 'REASON_REQUIRED', 'reason');
  perform public._t_raises80(format($q$select public.attendance_request_create(%L, 'correction', '00:00', '00:02', '사유')$q$, t), 'NO_CHANGE', 'no change');
  perform public._t_raises80(format($q$select public.attendance_request_create(%L, 'holiday', '00:00', '00:02', '한 일')$q$, t), 'NOT_HOLIDAY', 'not holiday');
  v := public.attendance_request_create(t, 'correction', '00:01', '00:02', '일찍 잘못 찍었어요');
  if v ->> 'status' <> 'pending' then raise exception 'FAIL [pending %]', v; end if;
  perform set_config('t.req1', v ->> 'id', true);
  perform public._t_raises80(format($q$select public.attendance_request_create(%L, 'correction', '00:01', '00:02', '또')$q$, t), 'PENDING_EXISTS', 'one pending');
  perform public._t_raises80(format($q$select public.attendance_request_decide(%L, true, null)$q$, v ->> 'id'), 'NOT_ALLOWED', 'employee decide');
  if (select count(*) from public.attendance_requests) <> 1 then raise exception 'FAIL [own requests]'; end if;
end;
$$;
reset role;
do $$
begin
  if public._t_notices80('a8100000-0000-0000-0000-000000000001') <> 1 or public._t_notices80('a8100000-0000-0000-0000-000000000002') <> 1
     or public._t_notices80('a8100000-0000-0000-0000-000000000003') <> 1 or public._t_notices80('a8100000-0000-0000-0000-000000000005') <> 0 then
    raise exception 'FAIL [notify approvers]';
  end if;
  if (select m.body from public.chat_messages m join public.chat_rooms r on r.id = m.room_id where r.notice_member_id = 'a8100000-0000-0000-0000-000000000002')
     not like '근태 정정 신청이 왔어요%이름: A직원%출근: 00:00 → 00:01%사유: 일찍 잘못 찍었어요' then
    raise exception 'FAIL [notice body]';
  end if;
  -- 처리 전 신청도 고치거나 지울 수 없다(함수로만)
  perform public._t_raises80($q$update public.attendance_requests set reason = 'x'$q$, 'HISTORY_LOCKED', 'edit pending');
  perform public._t_raises80($q$delete from public.attendance_requests$q$, 'HISTORY_LOCKED', 'delete pending');
end;
$$;

-- ② 관리자: 반려는 사유 필수 → 승인 → 기록 반영 + 직원 알림 + 처리 뒤 잠김
select public._t_as80('a8000000-0000-0000-0000-000000000002');
set local role authenticated;
do $$
declare d public.attendance_days;
begin
  if public.attendance_pending_count() <> 1 then raise exception 'FAIL [badge admin]'; end if;
  perform public._t_raises80(format($q$select public.attendance_request_decide(%L, false, ' ')$q$, current_setting('t.req1')), 'REASON_REQUIRED', 'reject reason');
  perform public.attendance_request_decide(current_setting('t.req1')::uuid, true, null);
  select * into d from public.attendance_days where member_id = 'a8100000-0000-0000-0000-000000000004';
  if to_char(d.in_at at time zone 'Asia/Seoul', 'HH24:MI') <> '00:01' or d.in_method <> 'correction' or d.out_method <> 'qr' then raise exception 'FAIL [applied %]', d; end if;
  perform public._t_raises80(format($q$select public.attendance_request_decide(%L, true, null)$q$, current_setting('t.req1')), 'ALREADY_DECIDED', 'twice');
  if jsonb_array_length(public.attendance_requests_admin() -> 'done') <> 1 then raise exception 'FAIL [done list]'; end if;
end;
$$;
reset role;
do $$
begin
  if public._t_notices80('a8100000-0000-0000-0000-000000000004') <> 1 then raise exception 'FAIL [result notice]'; end if;
  perform public._t_raises80($q$update public.attendance_requests set status = 'pending', decided_at = null$q$, 'HISTORY_LOCKED', 'reopen');
  perform public._t_raises80($q$delete from public.attendance_requests$q$, 'HISTORY_LOCKED', 'delete decided');
  if (select before ->> 'in_at' from public.attendance_requests where id = current_setting('t.req1')::uuid) is null then raise exception 'FAIL [original kept]'; end if;
end;
$$;

-- ③ 관리자 본인 신청 → 대표에게만 알림, 다른 관리자·본인은 처리 불가, 대표는 처리
select public._t_as80('a8000000-0000-0000-0000-000000000002');
set local role authenticated;
select set_config('t.req2', public.attendance_request_create(current_setting('t.today')::date, 'correction', '00:00', '00:02', '퇴근을 못 찍었어요') ->> 'id', true);
do $$
begin
  perform public._t_raises80(format($q$select public.attendance_request_decide(%L, true, null)$q$, current_setting('t.req2')), 'NOT_ALLOWED', 'self');
  if (public.attendance_requests_admin() -> 'pending' -> 0 ->> 'can_decide')::boolean then raise exception 'FAIL [can_decide self]'; end if;
end;
$$;
reset role;
do $$
begin
  if public._t_notices80('a8100000-0000-0000-0000-000000000001') <> 2 or public._t_notices80('a8100000-0000-0000-0000-000000000003') <> 1 then
    raise exception 'FAIL [admin request → boss only]';
  end if;
end;
$$;
select public._t_as80('a8000000-0000-0000-0000-000000000003');
set local role authenticated;
do $$
begin
  if public.attendance_pending_count() <> 0 then raise exception 'FAIL [badge other admin]'; end if;
  perform public._t_raises80(format($q$select public.attendance_request_decide(%L, true, null)$q$, current_setting('t.req2')), 'NOT_ALLOWED', 'other admin');
end;
$$;
reset role;
select public._t_as80('a8000000-0000-0000-0000-000000000001');
set local role authenticated;
do $$
begin
  if public.attendance_pending_count() <> 1 then raise exception 'FAIL [badge boss]'; end if;
  perform public.attendance_request_decide(current_setting('t.req2')::uuid, false, '그날은 18시까지 근무 기록이 맞아요');
end;
$$;
reset role;
do $$
begin
  if (select status || '/' || reject_reason from public.attendance_requests where id = current_setting('t.req2')::uuid) <> 'rejected/그날은 18시까지 근무 기록이 맞아요' then raise exception 'FAIL [rejected]'; end if;
  if private.attendance_hm((select out_at from public.attendance_days where member_id = 'a8100000-0000-0000-0000-000000000002')) <> '00:01' then raise exception 'FAIL [reject keeps record]'; end if;
end;
$$;

-- ④ 대표 본인 신청 → 바로 본인 승인(기록 없는 근무일 → 새 기록)
select public._t_as80('a8000000-0000-0000-0000-000000000001');
set local role authenticated;
do $$
declare v jsonb; d public.attendance_days;
begin
  v := public.attendance_request_create(current_setting('t.today')::date, 'correction', '00:00', '00:01', '외근·출장');
  if v ->> 'status' <> 'approved' or not (v ->> 'self_approved')::boolean then raise exception 'FAIL [boss self %]', v; end if;
  select * into d from public.attendance_days where member_id = 'a8100000-0000-0000-0000-000000000001';
  if d.in_method <> 'correction' or d.out_method <> 'correction' or d.in_terminal_id is not null then raise exception 'FAIL [new row %]', d; end if;
end;
$$;
reset role;

-- ⑤ 휴일 근무: 퇴근 전엔 불가 → 퇴근 뒤 상신 → 승인하면 인정
select public._t_as80('a8000000-0000-0000-0000-000000000005');
set local role authenticated;
do $$
begin
  perform public._t_raises80(format($q$select public.attendance_request_create(%L, 'holiday', '00:00', '00:01', '재고 실사')$q$, current_setting('t.today')), 'NOT_DONE', 'holiday open');
end;
$$;
reset role;
update public.attendance_days set out_at = in_at + interval '1 minute', out_method = 'qr' where member_id = 'a8100000-0000-0000-0000-000000000005';
select public._t_as80('a8000000-0000-0000-0000-000000000005');
set local role authenticated;
select set_config('t.req3', public.attendance_request_create(current_setting('t.today')::date, 'holiday', '00:00', '00:01', '재고 실사') ->> 'id', true);
reset role;
select public._t_as80('a8000000-0000-0000-0000-000000000003');
set local role authenticated;
select public.attendance_request_decide(current_setting('t.req3')::uuid, true, null);
reset role;
do $$
declare d public.attendance_days;
begin
  select * into d from public.attendance_days where member_id = 'a8100000-0000-0000-0000-000000000005';
  if d.holiday_approved_at is null or d.out_method <> 'qr' then raise exception 'FAIL [holiday approved %]', d; end if;
end;
$$;
select public._t_as80('a8000000-0000-0000-0000-000000000005');
set local role authenticated;
do $$
begin
  perform public._t_raises80(format($q$select public.attendance_request_create(%L, 'holiday', '00:00', '00:01', '또')$q$, current_setting('t.today')), 'ALREADY_APPROVED', 'holiday twice');
end;
$$;
reset role;

-- ⑥ QR 기록 없는 휴일은 정정으로도 불가 / 근무일이면 기록 없는 날 신청 가능 · 취소 · 기록 바뀌면 승인 불가
update public.attendance_settings set work_days = array(select x::smallint from generate_series(1, 7) x where x <> extract(isodow from current_setting('t.today')::date))
  where company_id = 'c8000000-0000-0000-0000-00000000000a';
select public._t_as80('a8000000-0000-0000-0000-000000000006');
set local role authenticated;
do $$
begin
  perform public._t_raises80(format($q$select public.attendance_request_create(%L, 'correction', '00:00', '00:01', '휴일에 일함')$q$, current_setting('t.today')), 'NO_RECORD_HOLIDAY', 'no-QR holiday');
end;
$$;
reset role;
update public.attendance_settings set work_days = '{1,2,3,4,5,6,7}' where company_id = 'c8000000-0000-0000-0000-00000000000a';
select public._t_as80('a8000000-0000-0000-0000-000000000006');
set local role authenticated;
do $$
declare v jsonb;
begin
  v := public.attendance_request_create(current_setting('t.today')::date, 'correction', '00:00', '00:01', '출근을 못 찍었어요');
  perform public.attendance_request_cancel((v ->> 'id')::uuid);
  perform public._t_raises80(format($q$select public.attendance_request_cancel(%L)$q$, v ->> 'id'), 'NOT_FOUND', 'cancel twice');
  v := public.attendance_request_create(current_setting('t.today')::date, 'correction', '00:00', '00:01', '출근을 못 찍었어요');
  perform set_config('t.req4', v ->> 'id', true);
  v := public.my_attendance_month(to_char(current_setting('t.today')::date, 'YYYY-MM'));
  if jsonb_array_length(v -> 'requests') <> 1 or v -> 'requests' -> 0 ->> 'status' <> 'pending' then raise exception 'FAIL [month requests %]', v -> 'requests'; end if;
  if v ->> 'request_from' <> to_char(date_trunc('month', current_setting('t.today')::date), 'YYYY-MM-DD') then raise exception 'FAIL [request_from %]', v ->> 'request_from'; end if;
end;
$$;
reset role;
-- 그 사이 QR로 기록이 생김 → 승인 불가
insert into public.attendance_days (company_id, member_id, work_date, in_at, holiday, sched_end, alert_minutes)
values ('c8000000-0000-0000-0000-00000000000a', 'a8100000-0000-0000-0000-000000000006', current_setting('t.today')::date, now(), false, '18:00', 60);
select public._t_as80('a8000000-0000-0000-0000-000000000002');
set local role authenticated;
do $$
begin
  perform public._t_raises80(format($q$select public.attendance_request_decide(%L, true, null)$q$, current_setting('t.req4')), 'RECORD_CHANGED', 'changed');
end;
$$;
reset role;

-- ⑦ 다른 회사: 안 보이고 처리 못 함
select public._t_as80('a8000000-0000-0000-0000-000000000007');
set local role authenticated;
do $$
begin
  if (select count(*) from public.attendance_requests) <> 0 then raise exception 'FAIL [cross read]'; end if;
  perform public._t_raises80(format($q$select public.attendance_request_decide(%L, true, null)$q$, current_setting('t.req4')), 'FEATURE_DISABLED', 'cross decide (B off)');
end;
$$;
reset role;
insert into public.company_features (company_id, feature, enabled) values ('c8000000-0000-0000-0000-00000000000b', 'attendance', true);
select public._t_as80('a8000000-0000-0000-0000-000000000007');
set local role authenticated;
do $$
begin
  perform public._t_raises80(format($q$select public.attendance_request_decide(%L, true, null)$q$, current_setting('t.req4')), 'NOT_FOUND', 'cross decide');
  if public.attendance_pending_count() <> 0 then raise exception 'FAIL [cross badge]'; end if;
end;
$$;
reset role;

select 'ok' as attendance_requests_080;
rollback;
