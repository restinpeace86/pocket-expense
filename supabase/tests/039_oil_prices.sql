-- =============================================================================
-- 039_oil_prices.sql — 오피넷 유가 기반 자차 유류비 (D-117, migration 058)
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
from unnest(array['a3900000-0000-0000-0000-000000000001', 'a3900000-0000-0000-0000-000000000002']::uuid[]) u;
insert into public.companies (id, name, invite_code, business_number, fuel_rate_per_km, fuel_enabled) values ('c3900000-0000-0000-0000-00000000000a', '유가회사', 'FUELPRCA', '1000000391', 200, true);
insert into public.members (id, auth_user_id, company_id, name, phone, role, status, privacy_agreed_at) values
  ('a3910000-0000-0000-0000-000000000001', 'a3900000-0000-0000-0000-000000000001', 'c3900000-0000-0000-0000-00000000000a', '관리자', '01093901001', 'super_admin', 'approved', now()),
  ('a3910000-0000-0000-0000-000000000002', 'a3900000-0000-0000-0000-000000000002', 'c3900000-0000-0000-0000-00000000000a', '직원', '01093901002', 'employee', 'approved', now());
insert into public.expense_claims (id, company_id, member_id, title, is_business_trip, category, trip_start_date, trip_end_date, trip_transport) values
  ('a3920000-0000-0000-0000-000000000001', 'c3900000-0000-0000-0000-00000000000a', 'a3910000-0000-0000-0000-000000000002', '출장', true, 'trip', '2026-10-14', '2026-10-15', 'own_car');
-- 서버가 넣은 유가(10/12만 있음 → 10/14 출장은 7일 안 가장 최근 10/12 값)
-- 실제로 쌓인 유가는 이 트랜잭션 안에서만 빼 둔다(끝에 rollback으로 그대로 돌아옴)
delete from public.oil_price_history;
insert into public.oil_price_history (log_date, gasoline, diesel, lpg) values ('2026-10-12', 1680.12, 1540.50, 1010.00);

-- 직원: 유가 쓰기 불가, 읽기 가능 / 유종 저장 / 계산 방식 변경 불가
select set_config('request.jwt.claims', '{"sub":"a3900000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select public._t_raises($q$insert into public.oil_price_history (log_date, gasoline) values ('2026-10-13', 1)$q$, '42501', 'E insert price');
select public._t_raises($q$select public.set_company_fuel_mode('opinet')$q$, '42501', 'E fuel mode');
select public._t_raises($q$select public.set_my_fuel_type('hydrogen')$q$, 'INVALID_FUEL_TYPE', 'E bad fuel');
select public.set_my_fuel_type('diesel');
do $$
declare v_item uuid; r record;
begin
  if (select count(*) from public.oil_price_history) <> 1 then raise exception 'FAIL [E read prices]'; end if;
  v_item := public.create_own_car_item('a3920000-0000-0000-0000-000000000001');
  perform set_config('t.item', v_item::text, true);
  -- 고정 단가: 편도 100km × 200 = 20,000 / 왕복 40,000
  perform public.set_own_car_route(v_item, '{"name":"판교역","lat":37.39,"lng":127.11}', '{"name":"부산역","lat":35.11,"lng":129.04}', true, 100);
  select * into r from public.expense_items where id = v_item;
  if row(r.amount, r.applied_fuel_mode, r.applied_fuel_rate_per_km)::text <> row(40000, 'fixed', 200)::text then raise exception 'FAIL [fixed] %', row(r.amount, r.applied_fuel_mode); end if;
end;
$$;
reset role;

-- 관리자: 전국 평균 유가 방식으로
select set_config('request.jwt.claims', '{"sub":"a3900000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select public._t_raises($q$select public.set_company_fuel_mode('market')$q$, 'INVALID_FUEL_MODE', 'A bad mode');
select public.set_company_fuel_mode('opinet');
reset role;

select set_config('request.jwt.claims', '{"sub":"a3900000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
do $$
declare v_item uuid := current_setting('t.item')::uuid; r record;
begin
  -- 경유 1540.50 ÷ 12 × 200km(왕복) = 25,675 → 올림 25,675
  perform public.refresh_claim_totals('a3920000-0000-0000-0000-000000000001');
  select * into r from public.expense_items where id = v_item;
  if row(r.amount, r.applied_fuel_mode, r.applied_fuel_type, r.applied_fuel_price, r.applied_fuel_rate_per_km)::text
     <> row(25675, 'opinet', 'diesel', 1540.50::numeric(8,2), 128)::text then
    raise exception 'FAIL [opinet diesel] %', row(r.amount, r.applied_fuel_mode, r.applied_fuel_type, r.applied_fuel_price, r.applied_fuel_rate_per_km);
  end if;
  -- 편도 123.4km 휘발유: 1680.12 × 123.4 ÷ 12 = 17,277.23 → 올림 17,278
  perform public.set_my_fuel_type('gasoline');
  perform public.set_own_car_route(v_item, '{"name":"판교역","lat":37.39,"lng":127.11}', '{"name":"부산역","lat":35.11,"lng":129.04}', false, 123.4);
  select * into r from public.expense_items where id = v_item;
  if row(r.amount, r.applied_fuel_type)::text <> row(17278, 'gasoline')::text then raise exception 'FAIL [opinet ceil] %', row(r.amount, r.applied_fuel_type); end if;
  -- 출장일이 유가보다 8일 넘게 뒤면(7일 안 값 없음) 고정 단가로
  update public.expense_items set expense_date = '2026-10-25' where id = v_item;
  perform public.refresh_claim_totals('a3920000-0000-0000-0000-000000000001');
  select * into r from public.expense_items where id = v_item;
  if row(r.amount, r.applied_fuel_mode, r.applied_fuel_price)::text <> row(24680, 'fixed', null::numeric)::text then raise exception 'FAIL [fallback] %', row(r.amount, r.applied_fuel_mode); end if;
end;
$$;
reset role;

select 'OIL_PRICES_OK' as result;
rollback;
