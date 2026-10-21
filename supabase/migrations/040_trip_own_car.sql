-- =============================================================================
-- 040_trip_own_car.sql — 출장 이동 수단 + 자차 유류비 경로·거리·금액 (D-085, trip-expense.md §2·§4, todo_improvement [개선사항 6])
-- - expense_claims.trip_transport: 출장 결의서의 이동 수단(자차 / 대중교통·KTX)
-- - 자차 항목의 경로·거리는 함수로만 쓴다(직원이 거리·금액을 직접 고칠 수 없게 칸 쓰기 권한 회수):
--     set_own_car_route  (직원)    : 출발지·도착지·왕복·직접 입력 거리(manual)
--     apply_route_distance(서버 전용): 서버가 Kakao 길찾기로 구한 편도 거리(api) — 저장된 좌표와 같을 때만
-- - 금액 = 거리 × 회사 km당 단가(recompute_claim). 회사가 자차 유류비를 끄거나 자가운전보조금 수령 직원이면 자차 항목을 만들 수 없다(D-068, D-070)
-- - 디지털 증빙: route_evidence(주소·길찾기 결과·계산 시각) + 경로 칸으로 화면이 '출장 경로 및 거리 산정 요약' 카드를 그린다
-- =============================================================================

create type public.trip_transport as enum ('own_car', 'public_transport');
alter table public.expense_claims add column trip_transport public.trip_transport;
grant insert (trip_transport), update (trip_transport) on public.expense_claims to authenticated;

alter table public.expense_items
  add column route_one_way_km numeric(8, 1) check (route_one_way_km >= 0 and route_one_way_km <= 5000),
  add column route_evidence jsonb check (route_evidence is null or jsonb_typeof(route_evidence) = 'object');

revoke insert (start_location, start_lat, start_lng, end_location, end_lat, end_lng, is_round_trip, distance_km, distance_source),
       update (start_location, start_lat, start_lng, end_location, end_lat, end_lng, is_round_trip, distance_km, distance_source)
  on public.expense_items from authenticated;

-- 자차 항목을 새로 만들거나 자차로 바꿀 때: 회사 설정·자가운전보조금 확인 (직접 API 호출도 막는다)
create or replace function private.guard_own_car()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if new.category = 'trip' and new.trip_type = 'own_car'
     and (tg_op = 'INSERT' or old.trip_type is distinct from 'own_car' or old.category is distinct from 'trip') then
    if not (select fuel_enabled from public.companies where id = new.company_id) then
      raise exception 'OWN_CAR_DISABLED';
    end if;
    if (select m.receives_car_allowance from public.expense_claims c join public.members m on m.id = c.member_id where c.id = new.claim_id) then
      raise exception 'CAR_ALLOWANCE_RECEIVER';
    end if;
  end if;
  return new;
end;
$$;
create trigger expense_items_guard_own_car before insert or update of category, trip_type on public.expense_items
  for each row execute function private.guard_own_car();

-- 금액 재계산(033 정의 + 자차 금액)
create or replace function private.recompute_claim(p_claim_id uuid)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_claim public.expense_claims;
  v_company public.companies;
  v_override integer;
  r record;
  a record;
  v_result jsonb;
begin
  select * into v_claim from public.expense_claims where id = p_claim_id;
  select * into v_company from public.companies where id = v_claim.company_id;
  select meal_limit_override into v_override from public.members where id = v_claim.member_id;
  -- 자차 유류비: 금액은 직원이 넣지 않고 거리 × 회사 km당 단가로만 정한다(trip-expense.md §4.2). 상신 때도 이 계산을 거쳐 단가가 스냅샷된다
  update public.expense_items
     set amount = case when distance_km is null then null else round(distance_km * v_company.fuel_rate_per_km)::integer end,
         applied_fuel_rate_per_km = v_company.fuel_rate_per_km,
         payment_method = 'personal_card',
         corporate_card_id = null
   where claim_id = v_claim.id and category = 'trip' and trip_type = 'own_car';
  for r in select id, category, trip_type, amount, headcount from public.expense_items where claim_id = v_claim.id loop
    select * into a from private.item_amounts(r.category, r.trip_type, r.amount, r.headcount, v_company, v_override);
    update public.expense_items
       set company_supported_amount = a.supported,
           personal_burden_amount = a.burden,
           applied_meal_limit_per_person = a.applied_limit,
           applied_meal_limit_mode = a.applied_mode,
           updated_at = now()
     where id = r.id;
  end loop;
  update public.expense_claims c
     set item_count = s.n,
         total_amount = s.total,
         total_company_supported = s.supported,
         total_personal_burden = s.burden,
         updated_at = now()
    from (
      select count(*)::integer n, coalesce(sum(amount), 0)::integer total,
             coalesce(sum(company_supported_amount), 0)::integer supported, coalesce(sum(personal_burden_amount), 0)::integer burden
      from public.expense_items where claim_id = v_claim.id
    ) s
   where c.id = v_claim.id
  returning jsonb_build_object('item_count', c.item_count, 'total_amount', c.total_amount,
                               'total_company_supported', c.total_company_supported, 'total_personal_burden', c.total_personal_burden)
    into v_result;
  return v_result;
end;
$$;

-- 자차 항목 만들기: 결제수단 개인(사비) 고정, 사용일 기본값 출장 시작일, 왕복 기본
create or replace function public.create_own_car_item(p_claim_id uuid)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_claim public.expense_claims := private.lock_my_editable_claim(p_claim_id);
  v_id uuid;
begin
  insert into public.expense_items (claim_id, company_id, sort_order, category, trip_type, payment_method, evidence_type, expense_date, headcount, is_round_trip, parse_status)
  values (v_claim.id, v_claim.company_id,
          coalesce((select max(sort_order) from public.expense_items where claim_id = v_claim.id), 0) + 1,
          'trip', 'own_car', 'personal_card', 'other',
          coalesce(v_claim.trip_start_date, (now() at time zone 'Asia/Seoul')::date), 1, true, 'none')
  returning id into v_id;
  perform private.recompute_claim(v_claim.id);
  return v_id;
end;
$$;

-- 경로 장소 확인: 이름 필수, 국내 좌표만
create or replace function private.route_place(p jsonb)
returns jsonb
language plpgsql immutable
set search_path = ''
as $$
declare v_name text; v_addr text;
begin
  if p is null or jsonb_typeof(p) <> 'object' then return null; end if;
  v_name := left(btrim(coalesce(p->>'name', '')), 100);
  v_addr := left(btrim(coalesce(p->>'address', '')), 200);
  if v_name = '' then return null; end if;
  if coalesce(p->>'lat', '') !~ '^-?\d{1,3}(\.\d+)?$' or coalesce(p->>'lng', '') !~ '^-?\d{1,3}(\.\d+)?$'
     or (p->>'lat')::numeric not between 33 and 39 or (p->>'lng')::numeric not between 124 and 132 then
    raise exception 'INVALID_ROUTE_PLACE';
  end if;
  return jsonb_build_object('name', v_name, 'address', nullif(v_addr, ''), 'lat', round((p->>'lat')::numeric, 6), 'lng', round((p->>'lng')::numeric, 6));
end;
$$;

-- 직원: 출발지·도착지·왕복·직접 입력 거리(편도 km). 장소가 바뀌면 거리를 비운다(서버가 다시 계산하거나 직원이 직접 입력)
create or replace function public.set_own_car_route(p_item_id uuid, p_start jsonb, p_end jsonb, p_round_trip boolean, p_manual_one_way_km numeric default null)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_item public.expense_items;
  v_claim public.expense_claims;
  s jsonb := private.route_place(p_start);
  e jsonb := private.route_place(p_end);
  v_round boolean := coalesce(p_round_trip, true);
  v_moved boolean;
  v_km numeric;
  v_source public.distance_source;
  v_evidence jsonb;
begin
  select * into v_item from public.expense_items where id = p_item_id;
  if not found then raise exception 'NOT_FOUND' using errcode = '42501'; end if;
  v_claim := private.lock_my_editable_claim(v_item.claim_id);
  select * into v_item from public.expense_items where id = p_item_id for update;
  if v_item.category <> 'trip' or v_item.trip_type is distinct from 'own_car' then raise exception 'NOT_OWN_CAR'; end if;
  if p_manual_one_way_km is not null and (p_manual_one_way_km <= 0 or p_manual_one_way_km > 5000) then raise exception 'INVALID_DISTANCE'; end if;

  v_moved := (s->>'lat')::numeric is distinct from v_item.start_lat or (s->>'lng')::numeric is distinct from v_item.start_lng
          or (e->>'lat')::numeric is distinct from v_item.end_lat or (e->>'lng')::numeric is distinct from v_item.end_lng;
  if p_manual_one_way_km is not null then
    v_km := round(p_manual_one_way_km, 1); v_source := 'manual';
    v_evidence := jsonb_build_object('source', 'manual', 'entered_at', now());
  elsif v_moved then
    v_km := null; v_source := null; v_evidence := jsonb_build_object();
  else
    v_km := v_item.route_one_way_km; v_source := v_item.distance_source; v_evidence := coalesce(v_item.route_evidence, jsonb_build_object());
  end if;
  v_evidence := v_evidence || jsonb_build_object('start_address', s->>'address', 'end_address', e->>'address');

  update public.expense_items set
    start_location = s->>'name', start_lat = (s->>'lat')::numeric, start_lng = (s->>'lng')::numeric,
    end_location = e->>'name', end_lat = (e->>'lat')::numeric, end_lng = (e->>'lng')::numeric,
    is_round_trip = v_round,
    route_one_way_km = v_km,
    distance_km = case when v_km is null then null else v_km * case when v_round then 2 else 1 end end,
    distance_source = v_source,
    route_evidence = v_evidence,
    updated_at = now()
  where id = p_item_id;
  perform private.recompute_claim(v_claim.id);
end;
$$;

-- 서버 전용: Kakao 길찾기 결과(편도 m). 지금 저장된 좌표와 같을 때만 반영한다(그 사이 장소를 바꿨으면 버림)
create or replace function public.apply_route_distance(p_item_id uuid, p_start_lat numeric, p_start_lng numeric, p_end_lat numeric, p_end_lng numeric, p_one_way_m integer, p_duration_s integer)
returns boolean
language plpgsql security definer
set search_path = ''
as $$
declare
  v_item public.expense_items;
  v_status public.claim_status;
  v_km numeric;
begin
  select * into v_item from public.expense_items where id = p_item_id for update;
  if not found or v_item.category <> 'trip' or v_item.trip_type is distinct from 'own_car' then return false; end if;
  select status into v_status from public.expense_claims where id = v_item.claim_id;
  if v_status not in ('draft', 'rejected') then return false; end if;
  if v_item.start_lat is distinct from round(p_start_lat, 6) or v_item.start_lng is distinct from round(p_start_lng, 6)
     or v_item.end_lat is distinct from round(p_end_lat, 6) or v_item.end_lng is distinct from round(p_end_lng, 6) then
    return false;
  end if;
  if p_one_way_m is null or p_one_way_m <= 0 or p_one_way_m > 5000000 then return false; end if;
  v_km := round(p_one_way_m / 1000.0, 1);
  update public.expense_items set
    route_one_way_km = v_km,
    distance_km = v_km * case when coalesce(is_round_trip, true) then 2 else 1 end,
    distance_source = 'api',
    route_evidence = jsonb_build_object('source', 'api', 'provider', 'kakao_mobility', 'one_way_m', p_one_way_m, 'duration_s', p_duration_s, 'computed_at', now(),
                                        'start_address', route_evidence->>'start_address', 'end_address', route_evidence->>'end_address'),
    updated_at = now()
  where id = p_item_id;
  perform private.recompute_claim(v_item.claim_id);
  return true;
end;
$$;

revoke all on function public.create_own_car_item(uuid), public.set_own_car_route(uuid, jsonb, jsonb, boolean, numeric) from public, anon;
grant execute on function public.create_own_car_item(uuid), public.set_own_car_route(uuid, jsonb, jsonb, boolean, numeric) to authenticated;
revoke all on function public.apply_route_distance(uuid, numeric, numeric, numeric, numeric, integer, integer) from public, anon, authenticated;
grant execute on function public.apply_route_distance(uuid, numeric, numeric, numeric, numeric, integer, integer) to service_role;
revoke all on function private.route_place(jsonb), private.guard_own_car() from public, anon, authenticated;
