-- =============================================================================
-- 084_bus.sql — 회사 주변 버스 (D-243, migration 132)
-- 회사 위치: 관리자만 · 이력 / 주변 정류장: 200m 안 가까운 순 5곳(없으면 500m 3곳) / 버스 알림: 주변 정류장만 · 메신저 필요 ·
-- 직원당 1개(바꾸면 이전 번호 알려 줌) · 30분 / 알림 보내기: 차량마다 10분·5분 한 번씩 · 회사 격리 · 서버 전용 함수 막힘
-- 정류장은 실제 서울 정류장 표(bus_stops)를 쓴다 — 서울시청 앞 좌표
-- =============================================================================
begin;

create function public._t_raises84(p_sql text, p_code text, p_label text)
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
grant execute on function public._t_raises84(text, text, text) to authenticated;
create function public._t_as84(p_uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
end;
$$;

insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at) values
  ('a8500000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'boss84@test.local', now()),
  ('a8500000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'emp84@test.local', now()),
  ('a8500000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bboss84@test.local', now());
insert into public.companies (id, name, invite_code, business_number) values
  ('c8500000-0000-0000-0000-00000000000a', '버스A', 'BSAAAAAA', '1000000841'),
  ('c8500000-0000-0000-0000-00000000000b', '버스B', 'BSBBBBBB', '1000000842');
insert into public.members (id, auth_user_id, company_id, name, phone, role, status, privacy_agreed_at, approved_at) values
  ('a8510000-0000-0000-0000-000000000001', 'a8500000-0000-0000-0000-000000000001', 'c8500000-0000-0000-0000-00000000000a', 'A대표', '01098401001', 'super_admin', 'approved', now(), now()),
  ('a8510000-0000-0000-0000-000000000002', 'a8500000-0000-0000-0000-000000000002', 'c8500000-0000-0000-0000-00000000000a', 'A직원', '01098401002', 'employee', 'approved', now(), now()),
  ('a8510000-0000-0000-0000-000000000003', 'a8500000-0000-0000-0000-000000000003', 'c8500000-0000-0000-0000-00000000000b', 'B대표', '01098401003', 'super_admin', 'approved', now(), now());

-- ① 회사 위치: 직원은 못 함, 관리자는 저장 → 주변 정류장 · 이력
select public._t_as84('a8500000-0000-0000-0000-000000000002');
set local role authenticated;
do $$
begin
  perform public._t_raises84($q$select public.company_location_save('서울 중구 세종대로 110', '서울 중구 태평로1가 31', 37.5663, 126.9779, '서울')$q$, 'NOT_ALLOWED', 'employee save');
  if public.bus_company_nearby() is not null then raise exception 'FAIL [no location yet]'; end if;
end;
$$;
reset role;
select public._t_as84('a8500000-0000-0000-0000-000000000001');
set local role authenticated;
do $$
declare v jsonb; prev numeric := -1; e jsonb;
begin
  perform public._t_raises84($q$select public.company_location_save('x', null, 37.5, 126.9, '서울')$q$, 'INVALID', 'short address');
  v := public.company_location_save('서울 중구 세종대로 110', '서울 중구 태평로1가 31', 37.5663, 126.9779, '서울');
  if (v ->> 'fallback')::boolean or jsonb_array_length(v -> 'stops') not between 1 and 5 then raise exception 'FAIL [nearby %]', v; end if;
  for e in select * from jsonb_array_elements(v -> 'stops') loop
    if (e ->> 'meters')::numeric > 200 or (e ->> 'meters')::numeric < prev then raise exception 'FAIL [order/200m %]', v; end if;
    prev := (e ->> 'meters')::numeric;
  end loop;
  perform set_config('t.ars', v -> 'stops' -> 0 ->> 'ars_id', true);
  perform public.company_location_save('서울 중구 세종대로 110 (본관)', '서울 중구 태평로1가 31', 37.5663, 126.9779, '서울');
  -- D-251: 우편번호 검색 — 지번·우편번호 함께, 우편번호는 5자리만
  perform public._t_raises84($q$select public.company_location_save('서울 중구 세종대로 110', null, 37.5663, 126.9779, '서울', '서울 중구 태평로1가 31', '0451')$q$, 'INVALID', 'zonecode 5');
  perform public.company_location_save('서울 중구 세종대로 110 (본관)', '서울 중구 세종대로 110', 37.5663, 126.9779, '서울', '서울 중구 태평로1가 31', '04524');
  if (public.bus_company_nearby() ->> 'zonecode') <> '04524' or (public.bus_company_nearby() ->> 'jibun_address') <> '서울 중구 태평로1가 31' then raise exception 'FAIL [jibun/zonecode]'; end if;
end;
$$;
reset role;
do $$
begin
  if (select count(*) from public.company_location_history where company_id = 'c8500000-0000-0000-0000-00000000000a') <> 2 then raise exception 'FAIL [history]'; end if;
end;
$$;

-- ② 직원: 버스 알림 — 주변 정류장만 · 메신저 필요 · 직원당 1개 · 30분
insert into public.company_features (company_id, feature, enabled) values ('c8500000-0000-0000-0000-00000000000a', 'messenger', false) on conflict (company_id, feature) do update set enabled = false;
select public._t_as84('a8500000-0000-0000-0000-000000000002');
set local role authenticated;
do $$
declare v jsonb;
begin
  if (public.bus_company_nearby() ->> 'seoul')::boolean is not true then raise exception 'FAIL [seoul]'; end if;
  perform public._t_raises84(format($q$select public.bus_alert_set('%s', '100100118', '472', '정류장')$q$, current_setting('t.ars')), 'NO_MESSENGER', 'no messenger');
end;
$$;
reset role;
insert into public.company_features (company_id, feature, enabled) values ('c8500000-0000-0000-0000-00000000000a', 'messenger', true) on conflict (company_id, feature) do update set enabled = true;
select public._t_as84('a8500000-0000-0000-0000-000000000002');
set local role authenticated;
do $$
declare v jsonb;
begin
  perform public._t_raises84($q$select public.bus_alert_set('99999', '100100118', '472', '먼 정류장')$q$, 'STOP_NOT_NEARBY', 'far stop');
  v := public.bus_alert_set(current_setting('t.ars'), '100100118', '472', '정류장');
  if v ->> 'replaced' is not null or (v ->> 'expires_at')::timestamptz not between now() + interval '29 minutes' and now() + interval '31 minutes' then raise exception 'FAIL [set %]', v; end if;
  v := public.bus_alert_set(current_setting('t.ars'), '100100046', '402', '정류장');
  if v ->> 'replaced' <> '472' then raise exception 'FAIL [replaced %]', v; end if;
  if (select count(*) from public.bus_alerts) <> 1 or (select route_no from public.bus_alerts) <> '402' then raise exception 'FAIL [one per member]'; end if;
  perform public._t_raises84($q$select public.bus_api_take(1)$q$, '42501', 'service only');
  perform public._t_raises84($q$select public.bus_alert_notify('a8510000-0000-0000-0000-000000000002', '10', 'v1', 'x')$q$, '42501', 'notify service only');
end;
$$;
reset role;

-- ③ 서버: 차량마다 10분·5분 한 번씩, 차량 바뀌면 다시
set local role service_role;
do $$
begin
  if not public.bus_alert_notify('a8510000-0000-0000-0000-000000000002', '10', 'v1', '🚌 402번 약 10분 후 도착') then raise exception 'FAIL [10 sent]'; end if;
  if public.bus_alert_notify('a8510000-0000-0000-0000-000000000002', '10', 'v1', 'again') then raise exception 'FAIL [10 once]'; end if;
  if not public.bus_alert_notify('a8510000-0000-0000-0000-000000000002', '5', 'v1', '🚌 402번 약 5분 후 도착') then raise exception 'FAIL [5 sent]'; end if;
  if public.bus_alert_notify('a8510000-0000-0000-0000-000000000002', '5', 'v1', 'again') then raise exception 'FAIL [5 once]'; end if;
  if not public.bus_alert_notify('a8510000-0000-0000-0000-000000000002', '10', 'v2', '다음 402번 약 10분 후') then raise exception 'FAIL [next vehicle]'; end if;
  if not public.bus_api_take(1) then raise exception 'FAIL [take]'; end if;
end;
$$;
reset role;
do $$
begin
  if (select count(*) from public.chat_messages m join public.chat_rooms r on r.id = m.room_id where r.notice_member_id = 'a8510000-0000-0000-0000-000000000002' and m.body like '%402번%') <> 3 then
    raise exception 'FAIL [notices]';
  end if;
end;
$$;

-- ④ 끄기 · 다른 회사
select public._t_as84('a8500000-0000-0000-0000-000000000002');
set local role authenticated;
select public.bus_alert_off();
do $$ begin if (select count(*) from public.bus_alerts) <> 0 then raise exception 'FAIL [off]'; end if; end; $$;
reset role;
select public._t_as84('a8500000-0000-0000-0000-000000000003');
set local role authenticated;
do $$
begin
  if public.bus_company_nearby() is not null or (select count(*) from public.company_locations) <> 0 or (select count(*) from public.company_location_history) <> 0 then raise exception 'FAIL [cross]'; end if;
  perform public._t_raises84(format($q$select public.bus_alert_set('%s', '100100118', '472', '정류장')$q$, current_setting('t.ars')), 'STOP_NOT_NEARBY', 'cross stop');
end;
$$;
reset role;

select 'ok' as bus_084;
rollback;
