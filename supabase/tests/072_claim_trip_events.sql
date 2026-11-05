-- =============================================================================
-- 072_claim_trip_events.sql — 결의서 쓰기에서 캘린더 출장 일정 불러오기 (D-216 → D-223 출장만, migration 115·121)
-- 내 출장·외근만(불참·회의·남의 일정·기간 밖 빠짐, 가까운 순) / 내 작성 중 결의서만 연결 / 채울 값(출장지·기간·목적) /
-- 끊기 / 다른 회사·참석자 아님·회의 일정 불가 / 상신한 결의서 불가 / 캘린더 꺼짐 불가
-- =============================================================================
begin;

create function public._t_raises72(p_sql text, p_code text, p_label text)
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
grant execute on function public._t_raises72(text, text, text) to authenticated;
create function public._t_as72(p_uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
end;
$$;

insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at) values
  ('a7200000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'boss72@test.local', now()),
  ('a7200000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'emp72a@test.local', now()),
  ('a7200000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'emp72b@test.local', now()),
  ('a7200000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bboss72@test.local', now());
insert into public.companies (id, name, invite_code, business_number) values
  ('c7200000-0000-0000-0000-00000000000a', '불러A', 'TRPAAAAA', '1000000721'),
  ('c7200000-0000-0000-0000-00000000000b', '불러B', 'TRPBBBBB', '1000000722');
insert into public.members (id, auth_user_id, company_id, name, phone, role, status, privacy_agreed_at) values
  ('a7210000-0000-0000-0000-000000000001', 'a7200000-0000-0000-0000-000000000001', 'c7200000-0000-0000-0000-00000000000a', 'A대표', '01097201001', 'super_admin', 'approved', now()),
  ('a7210000-0000-0000-0000-000000000002', 'a7200000-0000-0000-0000-000000000002', 'c7200000-0000-0000-0000-00000000000a', 'A직원', '01097201002', 'employee', 'approved', now()),
  ('a7210000-0000-0000-0000-000000000003', 'a7200000-0000-0000-0000-000000000003', 'c7200000-0000-0000-0000-00000000000a', 'A사원', '01097201003', 'employee', 'approved', now()),
  ('a7210000-0000-0000-0000-000000000004', 'a7200000-0000-0000-0000-000000000004', 'c7200000-0000-0000-0000-00000000000b', 'B대표', '01097201004', 'super_admin', 'approved', now());
insert into public.company_features (company_id, feature, enabled) values
  ('c7200000-0000-0000-0000-00000000000a', 'calendar', true), ('c7200000-0000-0000-0000-00000000000b', 'calendar', true)
on conflict (company_id, feature) do update set enabled = true;
insert into public.meeting_rooms (id, company_id, name) values ('d7200000-0000-0000-0000-000000000001', 'c7200000-0000-0000-0000-00000000000a', '본사 3층');

-- 대표가 만든 일정(오늘 기준): 출장 3일 뒤(부산, A직원), 외근 어제(회의실+장소, A직원), 회의 오늘(A직원), 출장 90일 전(기간 밖), 외근(A사원만)
select public._t_as72('a7200000-0000-0000-0000-000000000001');
set local role authenticated;
do $$
declare
  d date := (now() at time zone 'Asia/Seoul')::date;
begin
  perform set_config('t.trip', public.calendar_save_event(null, jsonb_build_object('title', '부산 거래처 방문', 'kind', 'trip', 'all_day', true, 'start_date', d + 3, 'end_date', d + 4, 'location', '부산', 'attendee_ids', jsonb_build_array('a7210000-0000-0000-0000-000000000002')))::text, true);
  perform set_config('t.out', public.calendar_save_event(null, jsonb_build_object('title', '은행 업무', 'kind', 'outside', 'starts_at', ((d - 1)::text || 'T10:00:00+09:00'), 'ends_at', ((d - 1)::text || 'T11:00:00+09:00'), 'room_id', 'd7200000-0000-0000-0000-000000000001', 'location', '역삼', 'attendee_ids', jsonb_build_array('a7210000-0000-0000-0000-000000000002')))::text, true);
  perform set_config('t.meet', public.calendar_save_event(null, jsonb_build_object('title', '주간회의', 'kind', 'meeting', 'starts_at', (d::text || 'T14:00:00+09:00'), 'ends_at', (d::text || 'T15:00:00+09:00'), 'attendee_ids', jsonb_build_array('a7210000-0000-0000-0000-000000000002')))::text, true);
  perform set_config('t.old', public.calendar_save_event(null, jsonb_build_object('title', '옛 출장', 'kind', 'trip', 'all_day', true, 'start_date', d - 90, 'end_date', d - 90, 'attendee_ids', jsonb_build_array('a7210000-0000-0000-0000-000000000002')))::text, true);
  perform set_config('t.other', public.calendar_save_event(null, jsonb_build_object('title', '사원 출장', 'kind', 'trip', 'all_day', true, 'start_date', d, 'end_date', d, 'attendee_ids', jsonb_build_array('a7210000-0000-0000-0000-000000000003')))::text, true);
end;
$$;
reset role;

-- A직원 결의서 2건(작성 중 1, 상신 1) + A사원 결의서
insert into public.expense_claims (id, company_id, member_id, title, status) values
  ('e7200000-0000-0000-0000-000000000001', 'c7200000-0000-0000-0000-00000000000a', 'a7210000-0000-0000-0000-000000000002', '', 'draft'),
  ('e7200000-0000-0000-0000-000000000002', 'c7200000-0000-0000-0000-00000000000a', 'a7210000-0000-0000-0000-000000000002', '상신함', 'submitted'),
  ('e7200000-0000-0000-0000-000000000003', 'c7200000-0000-0000-0000-00000000000a', 'a7210000-0000-0000-0000-000000000003', '', 'draft');

select public._t_as72('a7200000-0000-0000-0000-000000000002');
set local role authenticated;
do $$
declare
  l jsonb := public.calendar_my_trip_events();
  r jsonb;
begin
  -- ① 목록: 출장만(D-223 — 외근·회의·기간 밖·남의 일정 없음)
  if jsonb_array_length(l) <> 1 then raise exception 'FAIL [list size] %', l; end if;
  if l -> 0 ->> 'id' <> current_setting('t.trip') then raise exception 'FAIL [list trip only] %', l; end if;
  -- ② 연결: 채울 값 + 연결됨
  r := public.claim_link_calendar_event('e7200000-0000-0000-0000-000000000001', current_setting('t.trip')::uuid);
  if r ->> 'destination' <> '부산' or (r ->> 'start_date')::date <> (now() at time zone 'Asia/Seoul')::date + 3 or (r ->> 'end_date')::date <> (now() at time zone 'Asia/Seoul')::date + 4 or r ->> 'purpose' <> '부산 거래처 방문' then
    raise exception 'FAIL [fill values] %', r; end if;
  if (select calendar_event_id from public.expense_claims where id = 'e7200000-0000-0000-0000-000000000001') <> current_setting('t.trip')::uuid then raise exception 'FAIL [linked]'; end if;
  -- 외근은 연결 불가(D-223)
  perform public._t_raises72(format($q$select public.claim_link_calendar_event('e7200000-0000-0000-0000-000000000001', %L)$q$, current_setting('t.out')), 'EVENT_KIND_NO_CLAIM', 'outside kind');
  -- ③ 끊기
  perform public.claim_link_calendar_event('e7200000-0000-0000-0000-000000000001', null);
  if (select calendar_event_id from public.expense_claims where id = 'e7200000-0000-0000-0000-000000000001') is not null then raise exception 'FAIL [unlink]'; end if;
  -- ④ 막힘: 회의 일정 / 참석자 아님 / 상신한 결의서 / 남의 결의서
  perform public._t_raises72(format($q$select public.claim_link_calendar_event('e7200000-0000-0000-0000-000000000001', %L)$q$, current_setting('t.meet')), 'EVENT_KIND_NO_CLAIM', 'meeting kind');
  perform public._t_raises72(format($q$select public.claim_link_calendar_event('e7200000-0000-0000-0000-000000000001', %L)$q$, current_setting('t.other')), 'NOT_ATTENDEE', 'not attendee');
  perform public._t_raises72(format($q$select public.claim_link_calendar_event('e7200000-0000-0000-0000-000000000002', %L)$q$, current_setting('t.trip')), 'NOT_EDITABLE', 'submitted claim');
  perform public._t_raises72(format($q$select public.claim_link_calendar_event('e7200000-0000-0000-0000-000000000003', %L)$q$, current_setting('t.trip')), 'NOT_FOUND', 'other member claim');
end;
$$;
reset role;

-- ⑤ 다른 회사: 일정·결의서 모두 못 봄
select public._t_as72('a7200000-0000-0000-0000-000000000004');
set local role authenticated;
do $$
begin
  if jsonb_array_length(public.calendar_my_trip_events()) <> 0 then raise exception 'FAIL [other company list]'; end if;
  perform public._t_raises72($q$select public.claim_link_calendar_event('e7200000-0000-0000-0000-000000000001', null)$q$, 'NOT_FOUND', 'other company claim');
end;
$$;
reset role;

-- ⑥ 캘린더 꺼짐 = 막힘
update public.company_features set enabled = false where company_id = 'c7200000-0000-0000-0000-00000000000a' and feature = 'calendar';
select public._t_as72('a7200000-0000-0000-0000-000000000002');
set local role authenticated;
do $$
begin
  perform public._t_raises72($q$select public.calendar_my_trip_events()$q$, 'FEATURE_DISABLED', 'calendar off');
end;
$$;
reset role;

select 'ok' as claim_trip_events_072;
rollback;
