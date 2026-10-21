-- =============================================================================
-- 042_own_car_one_way_default.sql — 자차 유류비: 기본 편도, 왕복은 금액 × 2 (D-089, D-069 대체)
-- - 계산 순서: 편도 거리 × km당 단가 = 편도 금액(원 단위 반올림) → [왕복으로 계산]을 고르면 편도 금액 × 2
--   (예: 377km × 200원 = 75,400원 → 왕복 150,800원). 거리 칸 distance_km(총 주행 거리)는 표시용으로 그대로 편도 × 2.
-- - 새 자차 항목·왕복 값이 없을 때의 기본값을 편도로.
-- =============================================================================

-- 금액 재계산 (040 정의, 자차 금액 = 편도 금액 × 왕복 2)
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
     set amount = case when route_one_way_km is null then null
                       else round(route_one_way_km * v_company.fuel_rate_per_km)::integer * case when is_round_trip then 2 else 1 end end,
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

-- 자차 항목 만들기: 결제수단 개인(사비) 고정, 사용일 기본값 출장 시작일, 기본 편도
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
          coalesce(v_claim.trip_start_date, (now() at time zone 'Asia/Seoul')::date), 1, false, 'none')
  returning id into v_id;
  perform private.recompute_claim(v_claim.id);
  return v_id;
end;
$$;

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
  v_round boolean := coalesce(p_round_trip, false);
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
    distance_km = v_km * case when coalesce(is_round_trip, false) then 2 else 1 end,
    distance_source = 'api',
    route_evidence = jsonb_build_object('source', 'api', 'provider', 'kakao_mobility', 'one_way_m', p_one_way_m, 'duration_s', p_duration_s, 'computed_at', now(),
                                        'start_address', route_evidence->>'start_address', 'end_address', route_evidence->>'end_address'),
    updated_at = now()
  where id = p_item_id;
  perform private.recompute_claim(v_item.claim_id);
  return true;
end;
$$;
