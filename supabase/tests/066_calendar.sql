-- =============================================================================
-- 066_calendar.sql — 사내 캘린더 + 메신저 기본 켜기 + 회의 10분 전 알림방 (D-206, migration 109)
-- 스위치 꺼짐 = 아무것도 못 함 / 메신저는 줄 없으면 켜짐 / 다른 회사 일정·사람 안 보임 / 표 직접 쓰기 불가 /
-- 10분 단위 / 만든 사람만 고치기·지우기 / 참석자만 응답 / 시간 바꾸면 응답 대기 / 고른 사람 기억은 같은 회사만 /
-- 10분 전 알림: 불참·다른 회사 제외, 한 번만, 알림방은 보내기·초대·나가기 불가, 푸시 대상 = 서버 전용
-- =============================================================================
begin;

create function public._t_raises66(p_sql text, p_code text, p_label text)
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
grant execute on function public._t_raises66(text, text, text) to authenticated;
create function public._t_as66(p_uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
end;
$$;

insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at) values
  ('a6600000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'boss66@test.local', now()),
  ('a6600000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'emp66a@test.local', now()),
  ('a6600000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'emp66b@test.local', now()),
  ('a6600000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bboss66@test.local', now());
insert into public.companies (id, name, invite_code, business_number) values
  ('c6600000-0000-0000-0000-00000000000a', '캘린더A', 'CALAAAAA', '1000000661'),
  ('c6600000-0000-0000-0000-00000000000b', '캘린더B', 'CALBBBBB', '1000000662');
insert into public.members (id, auth_user_id, company_id, name, phone, role, status, privacy_agreed_at) values
  ('a6610000-0000-0000-0000-000000000001', 'a6600000-0000-0000-0000-000000000001', 'c6600000-0000-0000-0000-00000000000a', 'A대표', '01096601001', 'super_admin', 'approved', now()),
  ('a6610000-0000-0000-0000-000000000002', 'a6600000-0000-0000-0000-000000000002', 'c6600000-0000-0000-0000-00000000000a', 'A직원', '01096601002', 'employee', 'approved', now()),
  ('a6610000-0000-0000-0000-000000000003', 'a6600000-0000-0000-0000-000000000003', 'c6600000-0000-0000-0000-00000000000a', 'A사원', '01096601003', 'employee', 'approved', now()),
  ('a6610000-0000-0000-0000-000000000004', 'a6600000-0000-0000-0000-000000000004', 'c6600000-0000-0000-0000-00000000000b', 'B대표', '01096601004', 'super_admin', 'approved', now());

-- ① 캘린더 스위치 꺼짐(기본) / 메신저는 줄이 없어도 켜짐(D-206)
select public._t_as66('a6600000-0000-0000-0000-000000000001');
set local role authenticated;
do $$
begin
  if not public.my_feature_enabled('messenger') then raise exception 'FAIL [messenger default on]'; end if;
  if public.my_feature_enabled('calendar') then raise exception 'FAIL [calendar default off]'; end if;
  if public.chat_unread_total() is null then raise exception 'FAIL [messenger badge default on]'; end if;
  perform public._t_raises66($q$select public.calendar_directory()$q$, 'FEATURE_DISABLED', 'off directory');
  perform public._t_raises66($q$select public.calendar_events_range(current_date, current_date, array[gen_random_uuid()])$q$, 'FEATURE_DISABLED', 'off range');
  perform public._t_raises66($q$select public.calendar_save_event(null, '{"title":"x","kind":"meeting","all_day":true,"start_date":"2026-11-04"}')$q$, 'FEATURE_DISABLED', 'off save');
end;
$$;
reset role;

insert into public.company_features (company_id, feature, enabled) values
  ('c6600000-0000-0000-0000-00000000000a', 'calendar', true),
  ('c6600000-0000-0000-0000-00000000000b', 'calendar', true);

-- ② 만들기: 다른 회사 사람은 참석자에서 빠짐, 10분 단위, 표 직접 쓰기·읽기 불가
select public._t_as66('a6600000-0000-0000-0000-000000000001');
set local role authenticated;
do $$
declare
  v_id uuid;
  v_dir jsonb;
begin
  v_dir := public.calendar_directory();
  if jsonb_array_length(v_dir -> 'members') <> 3 then raise exception 'FAIL [directory same company only] %', v_dir; end if;
  v_id := public.calendar_save_event(null, jsonb_build_object('title', '주간회의', 'kind', 'meeting', 'all_day', false,
    'starts_at', '2030-01-07T05:00:00Z', 'ends_at', '2030-01-07T06:00:00Z', 'location', '3층 회의실',
    'attendee_ids', jsonb_build_array('a6610000-0000-0000-0000-000000000002', 'a6610000-0000-0000-0000-000000000004')));
  perform set_config('t.ev', v_id::text, true);
  if (public.calendar_event(v_id) -> 'attendees') @> '[{"member_id":"a6610000-0000-0000-0000-000000000004"}]' then raise exception 'FAIL [other company attendee]'; end if;
  if jsonb_array_length(public.calendar_event(v_id) -> 'attendees') <> 2 then raise exception 'FAIL [attendees 2]'; end if;
  if (public.calendar_event(v_id) -> 'attendees' -> 0 ->> 'response') <> 'accepted' then raise exception 'FAIL [creator accepted]'; end if;
  perform public._t_raises66($q$select public.calendar_save_event(null, '{"title":"x","kind":"meeting","starts_at":"2030-01-07T05:19:00Z","ends_at":"2030-01-07T06:00:00Z"}')$q$, 'TIME_UNIT_10MIN', '10min');
  perform public._t_raises66($q$select public.calendar_save_event(null, '{"title":"x","kind":"meeting","starts_at":"2030-01-07T06:00:00Z","ends_at":"2030-01-07T05:00:00Z"}')$q$, 'INVALID_TIME', 'end before start');
  perform public._t_raises66($q$select public.calendar_save_event(null, '{"title":"  ","kind":"meeting","all_day":true,"start_date":"2030-01-07"}')$q$, 'TITLE_REQUIRED', 'title');
  perform public._t_raises66($q$insert into public.calendar_events (company_id, created_by_member_id, title, kind, all_day, start_date, end_date) values ('c6600000-0000-0000-0000-00000000000a', 'a6610000-0000-0000-0000-000000000001', 'x', 'other', true, '2030-01-01', '2030-01-01')$q$, '42501', 'direct insert');
  perform public._t_raises66($q$select count(*) from public.calendar_events$q$, '42501', 'direct select');
  perform public._t_raises66($q$select public.calendar_reminder_tick()$q$, '42883', 'tick not callable'); -- private 스키마 함수는 직원 권한으로 못 부름
end;
$$;
reset role;

-- ③ 보이는 범위: 고른 사람(만든 사람·참석자) 기준, 같은 회사만
select public._t_as66('a6600000-0000-0000-0000-000000000003'); -- A사원(참석자 아님)
set local role authenticated;
do $$
begin
  if jsonb_array_length(public.calendar_events_range('2030-01-01', '2030-01-31', array['a6610000-0000-0000-0000-000000000003'::uuid])) <> 0 then raise exception 'FAIL [not mine]'; end if;
  if jsonb_array_length(public.calendar_events_range('2030-01-01', '2030-01-31', array['a6610000-0000-0000-0000-000000000002'::uuid])) <> 1 then raise exception 'FAIL [colleague visible]'; end if;
  perform public._t_raises66($q$select public.calendar_events_range('2030-01-01', '2030-04-30', array[]::uuid[])$q$, 'INVALID_RANGE', 'range too long');
  perform public._t_raises66(format($q$select public.calendar_respond(%L, 'accepted')$q$, current_setting('t.ev')), 'NOT_ATTENDEE', 'non attendee respond');
end;
$$;
reset role;

select public._t_as66('a6600000-0000-0000-0000-000000000004'); -- B대표
set local role authenticated;
do $$
begin
  if jsonb_array_length(public.calendar_events_range('2030-01-01', '2030-01-31', array['a6610000-0000-0000-0000-000000000001'::uuid, 'a6610000-0000-0000-0000-000000000002'::uuid])) <> 0 then raise exception 'FAIL [other company events]'; end if;
  perform public._t_raises66(format($q$select public.calendar_event(%L)$q$, current_setting('t.ev')), 'NOT_FOUND', 'other company detail');
  perform public._t_raises66(format($q$select public.calendar_delete_event(%L)$q$, current_setting('t.ev')), 'NOT_FOUND', 'other company delete');
  if jsonb_array_length(public.calendar_directory() -> 'members') <> 1 then raise exception 'FAIL [B directory]'; end if;
  if cardinality(public.calendar_busy('2030-01-07T04:00:00Z', '2030-01-07T07:00:00Z')) <> 0 then raise exception 'FAIL [other company busy]'; end if;
end;
$$;
reset role;

-- ④ 참석자: 응답만, 고치기·지우기 불가 / 고른 사람 기억은 같은 회사 승인 멤버만
select public._t_as66('a6600000-0000-0000-0000-000000000002'); -- A직원
set local role authenticated;
do $$
begin
  perform public._t_raises66(format($q$select public.calendar_save_event(%L, '{"title":"바꿈","kind":"meeting","starts_at":"2030-01-07T05:00:00Z","ends_at":"2030-01-07T06:00:00Z"}')$q$, current_setting('t.ev')), 'NOT_OWNER', 'attendee edit');
  perform public._t_raises66(format($q$select public.calendar_delete_event(%L)$q$, current_setting('t.ev')), 'NOT_OWNER', 'attendee delete');
  perform public.calendar_respond(current_setting('t.ev')::uuid, 'accepted');
  if not ((public.calendar_event(current_setting('t.ev')::uuid) -> 'attendees') @> '[{"member_id":"a6610000-0000-0000-0000-000000000002","response":"accepted"}]') then raise exception 'FAIL [accepted]'; end if;
  if not ('a6610000-0000-0000-0000-000000000002'::uuid = any (public.calendar_busy('2030-01-07T05:30:00Z', '2030-01-07T05:40:00Z'))) then raise exception 'FAIL [busy]'; end if;
  perform public.calendar_save_prefs(array['a6610000-0000-0000-0000-000000000001'::uuid, 'a6610000-0000-0000-0000-000000000004'::uuid], false);
  if (public.calendar_directory() -> 'prefs') <> '{"member_ids":["a6610000-0000-0000-0000-000000000001"],"show_deadlines":false}'::jsonb then raise exception 'FAIL [prefs] %', public.calendar_directory() -> 'prefs'; end if;
end;
$$;
reset role;

-- ⑤ 만든 사람: 제목만 바꾸면 응답 그대로, 시간을 바꾸면 응답 대기 / 만든 사람은 응답 못 함
select public._t_as66('a6600000-0000-0000-0000-000000000001');
set local role authenticated;
do $$
declare
  v_id uuid := current_setting('t.ev')::uuid;
begin
  perform public._t_raises66(format($q$select public.calendar_respond(%L, 'declined')$q$, v_id), 'CREATOR', 'creator respond');
  perform public.calendar_save_event(v_id, jsonb_build_object('title', '주간회의(제목만)', 'kind', 'meeting', 'starts_at', '2030-01-07T05:00:00Z', 'ends_at', '2030-01-07T06:00:00Z',
    'attendee_ids', jsonb_build_array('a6610000-0000-0000-0000-000000000002')));
  if not ((public.calendar_event(v_id) -> 'attendees') @> '[{"member_id":"a6610000-0000-0000-0000-000000000002","response":"accepted"}]') then raise exception 'FAIL [title only keeps response]'; end if;
  perform public.calendar_save_event(v_id, jsonb_build_object('title', '주간회의', 'kind', 'meeting', 'starts_at', '2030-01-07T06:00:00Z', 'ends_at', '2030-01-07T07:00:00Z',
    'attendee_ids', jsonb_build_array('a6610000-0000-0000-0000-000000000002', 'a6610000-0000-0000-0000-000000000003')));
  if not ((public.calendar_event(v_id) -> 'attendees') @> '[{"member_id":"a6610000-0000-0000-0000-000000000002","response":"pending"}]') then raise exception 'FAIL [time change resets]'; end if;
  if not ((public.calendar_event(v_id) -> 'attendees') @> '[{"member_id":"a6610000-0000-0000-0000-000000000001","response":"accepted"}]') then raise exception 'FAIL [creator stays accepted]'; end if;
  if jsonb_array_length(public.calendar_event(v_id) -> 'attendees') <> 3 then raise exception 'FAIL [attendee added]'; end if;
end;
$$;
reset role;

-- A직원 불참
select public._t_as66('a6600000-0000-0000-0000-000000000002');
set local role authenticated;
select public.calendar_respond(current_setting('t.ev')::uuid, 'declined');
reset role;

-- ⑥ 회의 10분 전 알림: 곧 시작하게 옮기고(운영자 권한) 작업 실행 → 불참 제외 2명(A대표·A사원), 두 번 돌려도 한 번
update public.calendar_events set
  starts_at = date_bin('10 minutes', now() + interval '14 minutes', timestamptz '2000-01-01'),
  ends_at = date_bin('10 minutes', now() + interval '14 minutes', timestamptz '2000-01-01') + interval '1 hour'
where id = current_setting('t.ev')::uuid;
-- 외근은 알림 없음
insert into public.calendar_events (company_id, created_by_member_id, title, kind, starts_at, ends_at)
values ('c6600000-0000-0000-0000-00000000000a', 'a6610000-0000-0000-0000-000000000001', '외근', 'outside',
  date_bin('10 minutes', now() + interval '14 minutes', timestamptz '2000-01-01'), date_bin('10 minutes', now() + interval '14 minutes', timestamptz '2000-01-01') + interval '1 hour');
do $$
declare
  v_n integer;
begin
  v_n := private.calendar_reminder_tick();
  if v_n <> 2 then raise exception 'FAIL [reminder count] %', v_n; end if;
  if private.calendar_reminder_tick() <> 0 then raise exception 'FAIL [reminder once]'; end if;
  if exists (select 1 from public.chat_rooms where kind = 'notice' and notice_member_id = 'a6610000-0000-0000-0000-000000000002') then raise exception 'FAIL [declined no notice]'; end if;
  if (select count(*) from public.chat_rooms where kind = 'notice' and company_id = 'c6600000-0000-0000-0000-00000000000a') <> 2 then raise exception 'FAIL [notice rooms]'; end if;
end;
$$;

-- ⑦ 알림방: 목록에 보이고 안 읽은 1, 링크는 캘린더, 보내기·초대·나가기 불가, 다른 사람은 못 봄
select public._t_as66('a6600000-0000-0000-0000-000000000003'); -- A사원
set local role authenticated;
do $$
declare
  v_room uuid;
  v_list jsonb := public.chat_room_list();
  v_msg jsonb;
begin
  select (x ->> 'id')::uuid into v_room from jsonb_array_elements(v_list) x where x ->> 'kind' = 'notice';
  if v_room is null then raise exception 'FAIL [notice in list] %', v_list; end if;
  if (select (x ->> 'unread')::int from jsonb_array_elements(v_list) x where x ->> 'kind' = 'notice') <> 1 then raise exception 'FAIL [notice unread]'; end if;
  if public.chat_unread_total() <> 1 then raise exception 'FAIL [badge counts notice]'; end if;
  v_msg := public.chat_messages_page(v_room) -> 0;
  if v_msg ->> 'kind' <> 'notice' or v_msg ->> 'body' not like '회의 시작 10분 전입니다.%' or v_msg ->> 'link' not like '/workspace/c6600000-0000-0000-0000-00000000000a/calendar?date=%' then raise exception 'FAIL [notice message] %', v_msg; end if;
  perform set_config('t.notice', v_room::text, true);
  perform public._t_raises66(format($q$select public.chat_send(%L, gen_random_uuid(), 'text', '답장')$q$, v_room), 'NOTICE_ROOM', 'send in notice');
  perform public._t_raises66(format($q$select public.chat_invite(%L, array['a6610000-0000-0000-0000-000000000002'::uuid])$q$, v_room), 'NOTICE_ROOM', 'invite notice');
  perform public._t_raises66(format($q$select public.chat_leave(%L)$q$, v_room), 'NOTICE_ROOM', 'leave notice');
  perform public._t_raises66($q$select public.chat_notice_push_due()$q$, '42501', 'push due user');
  perform public.chat_mark_read(v_room);
  if public.chat_unread_total() <> 0 then raise exception 'FAIL [read notice]'; end if;
end;
$$;
reset role;

select public._t_as66('a6600000-0000-0000-0000-000000000002'); -- A직원: 남의 알림방 못 봄
set local role authenticated;
do $$
begin
  perform public._t_raises66(format($q$select public.chat_messages_page(%L)$q$, current_setting('t.notice')), 'NOT_FOUND', 'other notice room');
end;
$$;
reset role;

-- ⑧ 푸시 대상(서버 전용): 2건, 두 번째는 0건 / 다른 방에는 알림 글을 못 넣음
do $$
declare
  v jsonb := public.chat_notice_push_due();
begin
  if jsonb_array_length(v) <> 2 then raise exception 'FAIL [push due] %', v; end if;
  if jsonb_array_length(public.chat_notice_push_due()) <> 0 then raise exception 'FAIL [push once]'; end if;
  perform public._t_raises66($q$insert into public.chat_rooms (company_id, kind, notice_member_id) values ('c6600000-0000-0000-0000-00000000000a', 'notice', 'a6610000-0000-0000-0000-000000000004')$q$, '23503', 'notice member other company');
end;
$$;

-- ⑨ 지우기(만든 사람) → 참석 줄도 사라짐
select public._t_as66('a6600000-0000-0000-0000-000000000001');
set local role authenticated;
select public.calendar_delete_event(current_setting('t.ev')::uuid);
do $$
begin
  perform public._t_raises66(format($q$select public.calendar_event(%L)$q$, current_setting('t.ev')), 'NOT_FOUND', 'deleted');
end;
$$;
reset role;
do $$
begin
  if exists (select 1 from public.calendar_attendees where event_id = current_setting('t.ev')::uuid) then raise exception 'FAIL [attendees cascade]'; end if;
end;
$$;

select 'ok' as calendar_066;
rollback;
