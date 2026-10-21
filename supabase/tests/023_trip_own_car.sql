-- =============================================================================
-- 023_trip_own_car.sql — 출장 이동 수단·자차 경로·거리·금액 (D-085, migration 040 / D-089 기본 편도·왕복은 금액 × 2, migration 042)
-- 회사 A(자차 유류비 켬, km당 200원): 직원 e1, 자가운전보조금 받는 직원 e2 / 회사 B(자차 유류비 끔): 직원 b1
-- =============================================================================
begin;

create function public._t_raises(p_sql text, p_code text, p_label text)
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
grant execute on function public._t_raises(text, text, text) to authenticated;

insert into auth.users (id, instance_id, aud, role, email)
select u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u::text || '@test.local'
from unnest(array['a2300000-0000-0000-0000-000000000021', 'a2300000-0000-0000-0000-000000000022', 'b2300000-0000-0000-0000-000000000021']::uuid[]) u;
insert into public.companies (id, name, invite_code, business_number, fuel_rate_per_km, fuel_enabled) values
  ('c2300000-0000-0000-0000-00000000000a', '자차회사A', 'CARRAAAA', '1000000231', 200, true),
  ('c2300000-0000-0000-0000-00000000000b', '자차회사B', 'CARRBBBB', '1000000232', 200, false);
insert into public.members (id, auth_user_id, company_id, name, phone, role, status, privacy_agreed_at, receives_car_allowance) values
  ('a2310000-0000-0000-0000-000000000021', 'a2300000-0000-0000-0000-000000000021', 'c2300000-0000-0000-0000-00000000000a', 'A직원1', '01092301001', 'employee', 'approved', now(), false),
  ('a2310000-0000-0000-0000-000000000022', 'a2300000-0000-0000-0000-000000000022', 'c2300000-0000-0000-0000-00000000000a', 'A보조금', '01092301002', 'employee', 'approved', now(), true),
  ('b2310000-0000-0000-0000-000000000021', 'b2300000-0000-0000-0000-000000000021', 'c2300000-0000-0000-0000-00000000000b', 'B직원', '01092302001', 'employee', 'approved', now(), false);
insert into public.expense_claims (id, company_id, member_id, title, is_business_trip, trip_start_date, trip_end_date) values
  ('a2320000-0000-0000-0000-000000000021', 'c2300000-0000-0000-0000-00000000000a', 'a2310000-0000-0000-0000-000000000021', '부산 출장', true, '2026-10-14', '2026-10-15'),
  ('a2320000-0000-0000-0000-000000000022', 'c2300000-0000-0000-0000-00000000000a', 'a2310000-0000-0000-0000-000000000022', '보조금 직원 출장', true, '2026-10-14', '2026-10-15'),
  ('b2320000-0000-0000-0000-000000000021', 'c2300000-0000-0000-0000-00000000000b', 'b2310000-0000-0000-0000-000000000021', 'B 출장', true, '2026-10-14', '2026-10-15');

-- ── A 직원1 ───────────────────────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"a2300000-0000-0000-0000-000000000021","role":"authenticated"}', true);
set local role authenticated;
do $$
declare v_item uuid; r record;
begin
  update public.expense_claims set trip_transport = 'own_car' where id = 'a2320000-0000-0000-0000-000000000021';
  v_item := public.create_own_car_item('a2320000-0000-0000-0000-000000000021');
  perform set_config('t.item', v_item::text, true);
  select * into r from public.expense_items where id = v_item;
  if row(r.category, r.trip_type, r.payment_method, r.expense_date, r.is_round_trip)::text
     <> row('trip'::public.expense_category, 'own_car'::public.trip_type, 'personal_card'::public.payment_method, '2026-10-14'::date, false)::text then
    raise exception 'FAIL [A_E1] own car item defaults %', row(r.category, r.trip_type, r.payment_method, r.expense_date, r.is_round_trip);
  end if;

  -- 금액은 직접 못 넣는다: 넣어도 재계산하면 거리 × 단가(거리 없으면 비움)
  update public.expense_items set amount = 999999 where id = v_item;
  perform public.refresh_claim_totals('a2320000-0000-0000-0000-000000000021');
  if (select amount from public.expense_items where id = v_item) is not null then raise exception 'FAIL [A_E1] direct amount kept'; end if;

  -- 장소만 → 거리 없음
  perform public.set_own_car_route(v_item, '{"name":"판교역","address":"경기 성남시 분당구 판교역로 160","lat":37.394777,"lng":127.111197}', '{"name":"부산역","address":"부산 동구 중앙대로 206","lat":35.115225,"lng":129.042243}', false);
  if (select distance_km from public.expense_items where id = v_item) is not null then raise exception 'FAIL [A_E1] distance without calc'; end if;

  -- 직접 입력 128.44km(편도), 왕복 → 256.8km × 200 = 51,360
  perform public.set_own_car_route(v_item, '{"name":"판교역","address":"경기 성남시 분당구 판교역로 160","lat":37.394777,"lng":127.111197}', '{"name":"부산역","address":"부산 동구 중앙대로 206","lat":35.115225,"lng":129.042243}', true, 128.44);
  select * into r from public.expense_items where id = v_item;
  if row(r.route_one_way_km, r.distance_km, r.distance_source, r.amount, r.applied_fuel_rate_per_km)::text <> row(128.4, 256.8, 'manual'::public.distance_source, 51360, 200)::text then
    raise exception 'FAIL [A_E1] manual round trip %', row(r.route_one_way_km, r.distance_km, r.distance_source, r.amount);
  end if;
  -- 왕복만 끄면 같은 거리로 편도 계산
  perform public.set_own_car_route(v_item, '{"name":"판교역","address":"경기 성남시 분당구 판교역로 160","lat":37.394777,"lng":127.111197}', '{"name":"부산역","address":"부산 동구 중앙대로 206","lat":35.115225,"lng":129.042243}', false);
  if (select row(distance_km, amount)::text from public.expense_items where id = v_item) <> row(128.4, 25680)::text then raise exception 'FAIL [A_E1] one way'; end if;
end;
$$;
select public._t_raises(format($q$update public.expense_items set distance_km = 1 where id = %L$q$, current_setting('t.item')), '42501', 'A_E1 direct distance');
select public._t_raises(format($q$update public.expense_items set distance_source = 'api' where id = %L$q$, current_setting('t.item')), '42501', 'A_E1 direct source');
select public._t_raises(format($q$select public.apply_route_distance(%L, 37.394777, 127.111197, 35.115225, 129.042243, 1000, 60)$q$, current_setting('t.item')), '42501', 'A_E1 apply api distance');
select public._t_raises(format($q$select public.set_own_car_route(%L, '{"name":"해외","lat":10,"lng":10}', '{"name":"부산역","lat":35.1,"lng":129.0}', true, 1)$q$, current_setting('t.item')), 'INVALID_ROUTE_PLACE', 'A_E1 foreign place');
select public._t_raises(format($q$select public.set_own_car_route(%L, '{"name":"판교역","lat":37.39,"lng":127.11}', '{"name":"부산역","lat":35.1,"lng":129.0}', true, 0)$q$, current_setting('t.item')), 'INVALID_DISTANCE', 'A_E1 zero distance');
reset role;

-- ── 서버(길찾기 결과): 좌표가 같을 때만, 편도 377,020m → 377.0km ─────────────
do $$
declare v_item uuid := current_setting('t.item')::uuid; r record;
begin
  if public.apply_route_distance(v_item, 37.4, 127.1, 35.115225, 129.042243, 377020, 14000) then raise exception 'FAIL [server] applied with stale coords'; end if;
  if not public.apply_route_distance(v_item, 37.394777, 127.111197, 35.115225, 129.042243, 377020, 14000) then raise exception 'FAIL [server] not applied'; end if;
  select * into r from public.expense_items where id = v_item;
  if row(r.route_one_way_km, r.distance_km, r.distance_source, r.amount)::text <> row(377.0, 377.0, 'api'::public.distance_source, 75400)::text then
    raise exception 'FAIL [server] api distance %', row(r.route_one_way_km, r.distance_km, r.distance_source, r.amount);
  end if;
  if r.route_evidence->>'provider' <> 'kakao_mobility' or r.route_evidence->>'start_address' is null then raise exception 'FAIL [server] evidence %', r.route_evidence; end if;
  if has_function_privilege('authenticated', 'public.apply_route_distance(uuid, numeric, numeric, numeric, numeric, integer, integer)', 'execute') then
    raise exception 'FAIL apply_route_distance executable by authenticated';
  end if;
end;
$$;

-- ── A 직원1: 왕복을 켜면 api 거리 유지 × 2, 장소를 바꾸면 거리 비움 ─────────────
select set_config('request.jwt.claims', '{"sub":"a2300000-0000-0000-0000-000000000021","role":"authenticated"}', true);
set local role authenticated;
do $$
declare v_item uuid := current_setting('t.item')::uuid;
begin
  perform public.set_own_car_route(v_item, '{"name":"판교역","address":"경기 성남시 분당구 판교역로 160","lat":37.394777,"lng":127.111197}', '{"name":"부산역","address":"부산 동구 중앙대로 206","lat":35.115225,"lng":129.042243}', true);
  if (select row(distance_km, distance_source, amount)::text from public.expense_items where id = v_item) <> row(754.0, 'api'::public.distance_source, 150800)::text then
    raise exception 'FAIL [A_E1] api round trip';
  end if;
  perform public.set_own_car_route(v_item, '{"name":"서울역","lat":37.554648,"lng":126.970607}', '{"name":"부산역","lat":35.115225,"lng":129.042243}', true);
  if (select row(distance_km, distance_source)::text from public.expense_items where id = v_item) is distinct from row(null::numeric, null::public.distance_source)::text then
    raise exception 'FAIL [A_E1] moved place kept distance';
  end if;
end;
$$;
reset role;

-- ── 계산 순서: 편도 거리 × 단가(반올림) → 왕복이면 금액 × 2 (단가 205원, 편도 100.3km) ─────────────
update public.companies set fuel_rate_per_km = 205 where id = 'c2300000-0000-0000-0000-00000000000a';
select set_config('request.jwt.claims', '{"sub":"a2300000-0000-0000-0000-000000000021","role":"authenticated"}', true);
set local role authenticated;
do $$
declare v_item uuid := current_setting('t.item')::uuid;
begin
  perform public.set_own_car_route(v_item, '{"name":"서울역","lat":37.554648,"lng":126.970607}', '{"name":"부산역","lat":35.115225,"lng":129.042243}', false, 100.3);
  if (select amount from public.expense_items where id = v_item) <> 20562 then raise exception 'FAIL [order] one way %', (select amount from public.expense_items where id = v_item); end if;
  perform public.set_own_car_route(v_item, '{"name":"서울역","lat":37.554648,"lng":126.970607}', '{"name":"부산역","lat":35.115225,"lng":129.042243}', true, 100.3);
  -- 편도 금액 20,562원 × 2 = 41,124원 (총 거리 200.6km × 205원 = 41,123원이 아님)
  if (select row(distance_km, amount)::text from public.expense_items where id = v_item) <> row(200.6, 41124)::text then
    raise exception 'FAIL [order] round trip %', (select row(distance_km, amount)::text from public.expense_items where id = v_item);
  end if;
end;
$$;
reset role;
update public.companies set fuel_rate_per_km = 200 where id = 'c2300000-0000-0000-0000-00000000000a';

-- ── 자가운전보조금 직원·자차 끈 회사는 자차 항목을 못 만든다, 다른 회사 항목은 안 보인다 ──
select set_config('request.jwt.claims', '{"sub":"a2300000-0000-0000-0000-000000000022","role":"authenticated"}', true);
set local role authenticated;
select public._t_raises($q$select public.create_own_car_item('a2320000-0000-0000-0000-000000000022')$q$, 'CAR_ALLOWANCE_RECEIVER', 'A_E2 allowance');
reset role;
select set_config('request.jwt.claims', '{"sub":"b2300000-0000-0000-0000-000000000021","role":"authenticated"}', true);
set local role authenticated;
select public._t_raises($q$select public.create_own_car_item('b2320000-0000-0000-0000-000000000021')$q$, 'OWN_CAR_DISABLED', 'B_E1 fuel disabled');
select public._t_raises(format($q$select public.set_own_car_route(%L, '{"name":"판교역","lat":37.39,"lng":127.11}', '{"name":"부산역","lat":35.1,"lng":129.0}', true, 10)$q$, current_setting('t.item')), 'NOT_FOUND', 'B_E1 other company item');
reset role;

-- ── 상신 뒤에는 바꿀 수 없다 ──────────────────────────────────────────────
update public.expense_claims set status = 'submitted' where id = 'a2320000-0000-0000-0000-000000000021';
do $$
begin
  if public.apply_route_distance(current_setting('t.item')::uuid, 37.554648, 126.970607, 35.115225, 129.042243, 400000, 1) then raise exception 'FAIL [server] applied to submitted'; end if;
end;
$$;
select set_config('request.jwt.claims', '{"sub":"a2300000-0000-0000-0000-000000000021","role":"authenticated"}', true);
set local role authenticated;
select public._t_raises(format($q$select public.set_own_car_route(%L, '{"name":"판교역","lat":37.39,"lng":127.11}', '{"name":"부산역","lat":35.1,"lng":129.0}', true, 10)$q$, current_setting('t.item')), 'NOT_EDITABLE', 'A_E1 submitted');
reset role;

select 'TRIP_OWN_CAR_OK' as result;
rollback;
