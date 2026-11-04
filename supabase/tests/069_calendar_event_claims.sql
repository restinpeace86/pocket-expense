-- =============================================================================
-- 069_calendar_event_claims.sql — 일정 ↔ 경비 연결 (D-210, migration 112)
-- 출장 일정 → 출장 결의서(출장지·기간·목적) / 회의 → 목적·참석자(불참 제외) / 참석자만·출장·회의만 /
-- 다른 회사 불가 / 묶인 경비: 직원은 내 것만, 관리자는 올린 것(남의 작성 중 제외) / 직접 연결 쓰기 불가 / 일정 지우면 연결만 끊김
-- =============================================================================
begin;

create function public._t_raises69(p_sql text, p_code text, p_label text)
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
grant execute on function public._t_raises69(text, text, text) to authenticated;
create function public._t_as69(p_uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
end;
$$;

insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at) values
  ('a6900000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'boss69@test.local', now()),
  ('a6900000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'emp69a@test.local', now()),
  ('a6900000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'emp69b@test.local', now()),
  ('a6900000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bboss69@test.local', now());
insert into public.companies (id, name, invite_code, business_number) values
  ('c6900000-0000-0000-0000-00000000000a', '연결A', 'LNKAAAAA', '1000000691'),
  ('c6900000-0000-0000-0000-00000000000b', '연결B', 'LNKBBBBB', '1000000692');
insert into public.members (id, auth_user_id, company_id, name, phone, role, status, privacy_agreed_at) values
  ('a6910000-0000-0000-0000-000000000001', 'a6900000-0000-0000-0000-000000000001', 'c6900000-0000-0000-0000-00000000000a', 'A대표', '01096901001', 'super_admin', 'approved', now()),
  ('a6910000-0000-0000-0000-000000000002', 'a6900000-0000-0000-0000-000000000002', 'c6900000-0000-0000-0000-00000000000a', 'A직원', '01096901002', 'employee', 'approved', now()),
  ('a6910000-0000-0000-0000-000000000003', 'a6900000-0000-0000-0000-000000000003', 'c6900000-0000-0000-0000-00000000000a', 'A사원', '01096901003', 'employee', 'approved', now()),
  ('a6910000-0000-0000-0000-000000000004', 'a6900000-0000-0000-0000-000000000004', 'c6900000-0000-0000-0000-00000000000b', 'B대표', '01096901004', 'super_admin', 'approved', now());
insert into public.company_features (company_id, feature, enabled) values
  ('c6900000-0000-0000-0000-00000000000a', 'calendar', true), ('c6900000-0000-0000-0000-00000000000b', 'calendar', true);

-- 대표: 출장(종일 11/15~11/16, 부산, 참석 A직원) · 회의(14:00~15:00, A직원·A사원) · 외근
select public._t_as69('a6900000-0000-0000-0000-000000000001');
set local role authenticated;
do $$
begin
  perform set_config('t.trip', public.calendar_save_event(null, '{"title":"부산 거래처 방문","kind":"trip","all_day":true,"start_date":"2030-11-15","end_date":"2030-11-16","location":"부산","attendee_ids":["a6910000-0000-0000-0000-000000000002"]}')::text, true);
  perform set_config('t.meet', public.calendar_save_event(null, '{"title":"신제품 회의","kind":"meeting","starts_at":"2030-11-20T14:00:00+09:00","ends_at":"2030-11-20T15:00:00+09:00","attendee_ids":["a6910000-0000-0000-0000-000000000002","a6910000-0000-0000-0000-000000000003"]}')::text, true);
  perform set_config('t.out', public.calendar_save_event(null, '{"title":"은행","kind":"outside","starts_at":"2030-11-21T10:00:00+09:00","ends_at":"2030-11-21T11:00:00+09:00"}')::text, true);
end;
$$;
reset role;

-- ① A직원: 출장 → 출장 결의서 / 회의 → 목적·참석자(불참한 A사원 빠짐) / 외근·참석자 아님 = 불가
update public.calendar_attendees set response = 'declined' where event_id = current_setting('t.meet')::uuid and member_id = 'a6910000-0000-0000-0000-000000000003';
select public._t_as69('a6900000-0000-0000-0000-000000000002');
set local role authenticated;
do $$
declare
  v_t uuid;
  v_m uuid;
  c record;
begin
  v_t := public.calendar_create_claim(current_setting('t.trip')::uuid);
  select status, member_id, is_business_trip, category::text as category, trip_destination, trip_start_date, trip_end_date, trip_purpose, calendar_event_id
    into c from public.expense_claims where id = v_t;
  if c.status <> 'draft' or c.member_id <> 'a6910000-0000-0000-0000-000000000002' or not c.is_business_trip or c.category <> 'trip'
     or c.trip_destination <> '부산' or c.trip_start_date <> '2030-11-15' or c.trip_end_date <> '2030-11-16' or c.trip_purpose <> '부산 거래처 방문'
     or c.calendar_event_id <> current_setting('t.trip')::uuid then raise exception 'FAIL [trip prefill] %', row_to_json(c); end if;
  v_m := public.calendar_create_claim(current_setting('t.meet')::uuid);
  select title, meeting_purpose, attendees, category::text as category, is_business_trip into c from public.expense_claims where id = v_m;
  if c.title <> '11/20 신제품 회의' or c.meeting_purpose <> '신제품 회의' or c.attendees <> 'A대표, A직원' or c.category is not null or c.is_business_trip then
    raise exception 'FAIL [meeting prefill] %', row_to_json(c); end if;
  perform public._t_raises69(format($q$select public.calendar_create_claim(%L)$q$, current_setting('t.out')), 'EVENT_KIND_NO_CLAIM', 'outside');
  perform set_config('t.c_trip', v_t::text, true);
  -- 직접 연결 바꾸기 불가
  perform public._t_raises69(format($q$update public.expense_claims set calendar_event_id = %L where id = %L$q$, current_setting('t.meet'), v_t), '42501', 'no direct link write');
  -- 묶인 경비: 내 것 1건
  if jsonb_array_length(public.calendar_event_claims(current_setting('t.trip')::uuid)) <> 1 then raise exception 'FAIL [mine listed]'; end if;
end;
$$;
reset role;
select public._t_as69('a6900000-0000-0000-0000-000000000003');
set local role authenticated;
do $$
begin
  perform public._t_raises69(format($q$select public.calendar_create_claim(%L)$q$, current_setting('t.meet')), 'NOT_ATTENDEE', 'declined');
  perform public._t_raises69(format($q$select public.calendar_create_claim(%L)$q$, current_setting('t.trip')), 'NOT_ATTENDEE', 'not attendee');
  if jsonb_array_length(public.calendar_event_claims(current_setting('t.trip')::uuid)) <> 0 then raise exception 'FAIL [others hidden]'; end if;
end;
$$;
reset role;

-- ② 관리자: 직원 작성 중은 안 보임 → 상신하면 보임 / 다른 회사: 만들기·보기 불가
select public._t_as69('a6900000-0000-0000-0000-000000000001');
set local role authenticated;
do $$
begin
  if jsonb_array_length(public.calendar_event_claims(current_setting('t.trip')::uuid)) <> 0 then raise exception 'FAIL [admin no drafts]'; end if;
end;
$$;
reset role;
update public.expense_claims set status = 'submitted', submitted_at = now() where id = current_setting('t.c_trip')::uuid;
select public._t_as69('a6900000-0000-0000-0000-000000000001');
set local role authenticated;
do $$
declare
  v jsonb := public.calendar_event_claims(current_setting('t.trip')::uuid);
begin
  if jsonb_array_length(v) <> 1 or v -> 0 ->> 'member_name' <> 'A직원' or (v -> 0 ->> 'mine')::boolean then raise exception 'FAIL [admin sees submitted] %', v; end if;
end;
$$;
reset role;
select public._t_as69('a6900000-0000-0000-0000-000000000004');
set local role authenticated;
do $$
begin
  perform public._t_raises69(format($q$select public.calendar_create_claim(%L)$q$, current_setting('t.trip')), 'NOT_FOUND', 'other company create');
  perform public._t_raises69(format($q$select public.calendar_event_claims(%L)$q$, current_setting('t.trip')), 'NOT_FOUND', 'other company list');
end;
$$;
reset role;

-- ③ 일정 지우기 → 결의서는 남고 연결만 끊김
select public._t_as69('a6900000-0000-0000-0000-000000000001');
set local role authenticated;
select public.calendar_delete_event(current_setting('t.trip')::uuid);
reset role;
do $$
declare c record;
begin
  select id, calendar_event_id, trip_destination into c from public.expense_claims where id = current_setting('t.c_trip')::uuid;
  if c.id is null or c.calendar_event_id is not null or c.trip_destination <> '부산' then raise exception 'FAIL [unlink on delete] %', row_to_json(c); end if;
end;
$$;

select 'ok' as event_claims_069;
rollback;
