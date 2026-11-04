-- =============================================================================
-- 067_meeting_rooms.sql — 회의실 설정·예약 (D-207, migration 110)
-- 관리자만 등록·이름 변경·순서·삭제 / 다른 회사 방 안 보임·못 씀 / 같은 방·겹치는 시간 = ROOM_TAKEN /
-- 끝=다음 시작은 OK / 종일 일정엔 방 불가 / 예약 현황은 회사 전체 / 방 삭제해도 일정은 장소 글자로 남음 / 알림 본문에 방 이름
-- =============================================================================
begin;

create function public._t_raises67(p_sql text, p_code text, p_label text)
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
grant execute on function public._t_raises67(text, text, text) to authenticated;
create function public._t_as67(p_uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
end;
$$;

insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at) values
  ('a6700000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'boss67@test.local', now()),
  ('a6700000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'emp67@test.local', now()),
  ('a6700000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bboss67@test.local', now());
insert into public.companies (id, name, invite_code, business_number) values
  ('c6700000-0000-0000-0000-00000000000a', '회의실A', 'RMXAAAAA', '1000000671'),
  ('c6700000-0000-0000-0000-00000000000b', '회의실B', 'RMXBBBBB', '1000000672');
insert into public.members (id, auth_user_id, company_id, name, phone, role, status, privacy_agreed_at) values
  ('a6710000-0000-0000-0000-000000000001', 'a6700000-0000-0000-0000-000000000001', 'c6700000-0000-0000-0000-00000000000a', 'A대표', '01096701001', 'super_admin', 'approved', now()),
  ('a6710000-0000-0000-0000-000000000002', 'a6700000-0000-0000-0000-000000000002', 'c6700000-0000-0000-0000-00000000000a', 'A직원', '01096701002', 'employee', 'approved', now()),
  ('a6710000-0000-0000-0000-000000000003', 'a6700000-0000-0000-0000-000000000003', 'c6700000-0000-0000-0000-00000000000b', 'B대표', '01096701003', 'super_admin', 'approved', now());

-- ① 캘린더 꺼짐 = 회의실도 못 씀
select public._t_as67('a6700000-0000-0000-0000-000000000001');
set local role authenticated;
do $$
begin
  perform public._t_raises67($q$select public.calendar_rooms()$q$, 'FEATURE_DISABLED', 'off rooms');
  perform public._t_raises67($q$select public.calendar_room_save(null, '회의실')$q$, 'FEATURE_DISABLED', 'off save');
end;
$$;
reset role;
insert into public.company_features (company_id, feature, enabled) values
  ('c6700000-0000-0000-0000-00000000000a', 'calendar', true),
  ('c6700000-0000-0000-0000-00000000000b', 'calendar', true);

-- ② 관리자: 등록·이름 중복·순서 / 표 직접 접근 불가
select public._t_as67('a6700000-0000-0000-0000-000000000001');
set local role authenticated;
do $$
declare
  v1 uuid;
  v2 uuid;
  v_list jsonb;
begin
  if jsonb_array_length(public.calendar_rooms()) <> 0 then raise exception 'FAIL [empty at start]'; end if;
  v1 := public.calendar_room_save(null, ' 3층 회의실 ');
  v2 := public.calendar_room_save(null, '소회의실');
  perform public._t_raises67($q$select public.calendar_room_save(null, '3층 회의실')$q$, 'ROOM_NAME_TAKEN', 'dup name');
  perform public._t_raises67($q$select public.calendar_room_save(null, '  ')$q$, 'ROOM_NAME_REQUIRED', 'empty name');
  perform public._t_raises67(format($q$select public.calendar_room_save(null, %L)$q$, repeat('가', 51)), 'ROOM_NAME_TOO_LONG', 'long name');
  v_list := public.calendar_rooms();
  if v_list -> 0 ->> 'name' <> '3층 회의실' or v_list -> 1 ->> 'name' <> '소회의실' then raise exception 'FAIL [order/trim] %', v_list; end if;
  perform public.calendar_room_reorder(array[v2, v1]);
  if public.calendar_rooms() -> 0 ->> 'id' <> v2::text then raise exception 'FAIL [reorder]'; end if;
  perform public.calendar_room_save(v2, '2층 소회의실');
  if public.calendar_rooms() -> 0 ->> 'name' <> '2층 소회의실' then raise exception 'FAIL [rename]'; end if;
  perform public._t_raises67($q$select * from public.meeting_rooms$q$, '42501', 'no direct select');
  perform set_config('t.r1', v1::text, true);
  perform set_config('t.r2', v2::text, true);
end;
$$;
reset role;

-- ③ 직원: 목록 보기 O, 설정 X / 다른 회사: 목록 안 보임, 이름 변경·삭제·예약 불가
select public._t_as67('a6700000-0000-0000-0000-000000000002');
set local role authenticated;
do $$
begin
  if jsonb_array_length(public.calendar_rooms()) <> 2 then raise exception 'FAIL [employee sees rooms]'; end if;
  perform public._t_raises67($q$select public.calendar_room_save(null, '직원방')$q$, '42501', 'employee add');
  perform public._t_raises67(format($q$select public.calendar_room_delete(%L)$q$, current_setting('t.r1')), '42501', 'employee delete');
end;
$$;
reset role;
select public._t_as67('a6700000-0000-0000-0000-000000000003');
set local role authenticated;
do $$
begin
  if jsonb_array_length(public.calendar_rooms()) <> 0 then raise exception 'FAIL [other company rooms hidden]'; end if;
  perform public._t_raises67(format($q$select public.calendar_room_save(%L, 'x')$q$, current_setting('t.r1')), 'NOT_FOUND', 'other rename');
  perform public._t_raises67(format($q$select public.calendar_room_delete(%L)$q$, current_setting('t.r1')), 'NOT_FOUND', 'other delete');
  perform public._t_raises67(format($q$select public.calendar_save_event(null, jsonb_build_object('title','x','kind','meeting','starts_at','2030-01-07T10:00:00+09:00','ends_at','2030-01-07T11:00:00+09:00','room_id',%L))$q$, current_setting('t.r1')), 'ROOM_NOT_FOUND', 'other book');
end;
$$;
reset role;

-- ④ 예약: 겹치면 ROOM_TAKEN, 끝=다음 시작 OK, 다른 방은 OK, 종일 불가, 수정으로 겹치게 해도 불가
select public._t_as67('a6700000-0000-0000-0000-000000000001');
set local role authenticated;
do $$
declare
  v_a uuid;
  v_b uuid;
  v_r1 text := current_setting('t.r1');
  v_r2 text := current_setting('t.r2');
  v_j jsonb;
begin
  v_a := public.calendar_save_event(null, jsonb_build_object('title','주간회의','kind','meeting','starts_at','2030-01-07T10:00:00+09:00','ends_at','2030-01-07T11:00:00+09:00','room_id',v_r1,'location','빔 프로젝터'));
  v_j := public.calendar_event(v_a);
  if v_j ->> 'room_name' <> '3층 회의실' or v_j ->> 'room_id' <> v_r1 then raise exception 'FAIL [room in json] %', v_j; end if;
  perform set_config('t.ev', v_a::text, true);
end;
$$;
reset role;
select public._t_as67('a6700000-0000-0000-0000-000000000002');
set local role authenticated;
do $$
declare
  v_b uuid;
  v_r1 text := current_setting('t.r1');
  v_r2 text := current_setting('t.r2');
  v_list jsonb;
begin
  perform public._t_raises67(format($q$select public.calendar_save_event(null, jsonb_build_object('title','겹침','kind','meeting','starts_at','2030-01-07T10:30:00+09:00','ends_at','2030-01-07T11:30:00+09:00','room_id',%L))$q$, v_r1), 'ROOM_TAKEN', 'overlap');
  perform public._t_raises67(format($q$select public.calendar_save_event(null, jsonb_build_object('title','감쌈','kind','other','starts_at','2030-01-07T09:00:00+09:00','ends_at','2030-01-07T12:00:00+09:00','room_id',%L))$q$, v_r1), 'ROOM_TAKEN', 'covering');
  perform public._t_raises67(format($q$select public.calendar_save_event(null, jsonb_build_object('title','종일','kind','meeting','all_day',true,'start_date','2030-01-08','room_id',%L))$q$, v_r1), 'ROOM_ALL_DAY', 'all day room');
  v_b := public.calendar_save_event(null, jsonb_build_object('title','바로 다음','kind','meeting','starts_at','2030-01-07T11:00:00+09:00','ends_at','2030-01-07T12:00:00+09:00','room_id',v_r1));
  perform public.calendar_save_event(null, jsonb_build_object('title','다른 방','kind','meeting','starts_at','2030-01-07T10:00:00+09:00','ends_at','2030-01-07T11:00:00+09:00','room_id',v_r2));
  perform public._t_raises67(format($q$select public.calendar_save_event(%L, jsonb_build_object('title','바로 다음','kind','meeting','starts_at','2030-01-07T10:50:00+09:00','ends_at','2030-01-07T12:00:00+09:00','room_id',%L))$q$, v_b, v_r1), 'ROOM_TAKEN', 'edit into overlap');
  -- 같은 일정의 시간만 줄이는 수정은 OK(자기 자신과는 안 겹침)
  perform public.calendar_save_event(v_b, jsonb_build_object('title','바로 다음','kind','meeting','starts_at','2030-01-07T11:00:00+09:00','ends_at','2030-01-07T11:30:00+09:00','room_id',v_r1));
  -- 예약 현황: 직원이 참석하지 않은 대표 회의도 보임(회사 전체)
  v_list := public.calendar_room_bookings('2030-01-07T00:00:00+09:00', '2030-01-08T00:00:00+09:00');
  if jsonb_array_length(v_list) <> 3 then raise exception 'FAIL [bookings company-wide] %', v_list; end if;
  if (select count(*) from jsonb_array_elements(public.calendar_rooms()) r where (r ->> 'upcoming')::int > 0) <> 2 then raise exception 'FAIL [upcoming count]'; end if;
  perform public._t_raises67($q$select public.calendar_room_bookings(now(), now() + interval '40 days')$q$, 'INVALID_RANGE', 'range limit');
end;
$$;
reset role;
select public._t_as67('a6700000-0000-0000-0000-000000000003');
set local role authenticated;
do $$
begin
  if jsonb_array_length(public.calendar_room_bookings('2030-01-07T00:00:00+09:00', '2030-01-08T00:00:00+09:00')) <> 0 then raise exception 'FAIL [other company bookings hidden]'; end if;
end;
$$;
reset role;

-- ⑤ 10분 전 안내 본문에 회의실 이름 + 적은 장소
do $$
declare
  v_start timestamptz := to_timestamp(ceil(extract(epoch from now() + interval '5 minutes') / 600) * 600);
  v_body text;
begin
  update public.calendar_events set starts_at = v_start, ends_at = v_start + interval '1 hour', reminded_at = null where id = current_setting('t.ev')::uuid;
  perform private.calendar_reminder_tick();
  select body into v_body from public.chat_messages m join public.chat_rooms r on r.id = m.room_id
    where r.kind = 'notice' and r.notice_member_id = 'a6710000-0000-0000-0000-000000000001' order by m.created_at desc limit 1;
  if v_body is null or v_body not like '%장소: 3층 회의실 · 빔 프로젝터%' then raise exception 'FAIL [reminder room name] %', v_body; end if;
end;
$$;

-- ⑥ 방 삭제: 일정은 남고 장소 글자로 옮겨짐
select public._t_as67('a6700000-0000-0000-0000-000000000001');
set local role authenticated;
select public.calendar_room_delete(current_setting('t.r1')::uuid);
do $$
declare
  v_j jsonb := public.calendar_event(current_setting('t.ev')::uuid);
begin
  if v_j ->> 'room_id' is not null or v_j ->> 'location' <> '3층 회의실 · 빔 프로젝터' then raise exception 'FAIL [delete keeps event] %', v_j; end if;
  if jsonb_array_length(public.calendar_rooms()) <> 1 then raise exception 'FAIL [deleted]'; end if;
end;
$$;
reset role;

select 'ok' as meeting_rooms_067;
rollback;
