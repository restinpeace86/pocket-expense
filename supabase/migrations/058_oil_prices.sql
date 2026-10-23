-- =============================================================================
-- 058_oil_prices.sql — 오피넷 전국 평균 유가 + 자차 유류비 계산 방식 선택 (D-117)
-- - oil_price_history: 일자별 전국 주유소 평균 가격(보통휘발유 B027 / 자동차용경유 D047 / 자동차용부탄 LPG K015). 매일 새벽 서버가 넣는다(Upsert).
--   공개 정보라 로그인한 누구나 읽고, 쓰기는 서버(service role)만.
-- - companies.fuel_rate_mode: fixed(지금처럼 km당 단가) / opinet(출장 당일 전국 평균 유가 ÷ 회사 표준 연비 12km/L).
-- - members.fuel_type: 직원 차량 유종(휘발유·경유·LPG, 비어 있으면 휘발유로 계산).
-- - 자차 금액(opinet) = 올림( 당일 유가 ÷ 12 × 총 주행 거리 ). 당일 값이 없으면 7일 안의 가장 최근 값, 그것도 없으면 고정 단가로 계산하고 그렇게 했다고 남긴다.
-- =============================================================================

create table public.oil_price_history (
  log_date date primary key,
  gasoline numeric(8, 2) check (gasoline > 0),
  diesel numeric(8, 2) check (diesel > 0),
  lpg numeric(8, 2) check (lpg > 0),
  source text not null default 'opinet',
  fetched_at timestamptz not null default now()
);
alter table public.oil_price_history enable row level security;
alter table public.oil_price_history force row level security;
grant select on public.oil_price_history to authenticated;
create policy oil_price_history_select on public.oil_price_history for select to authenticated using (true);

-- 새벽 작업 기록(성공·실패) — 서버 전용
create table public.oil_price_fetch_logs (
  id uuid primary key default gen_random_uuid(),
  ran_at timestamptz not null default now(),
  ok boolean not null,
  log_date date,
  message text check (char_length(message) <= 500)
);
alter table public.oil_price_fetch_logs enable row level security;
alter table public.oil_price_fetch_logs force row level security;

alter table public.companies add column fuel_rate_mode text not null default 'fixed' check (fuel_rate_mode in ('fixed', 'opinet'));
alter table public.members add column fuel_type text check (fuel_type in ('gasoline', 'diesel', 'lpg'));
alter table public.expense_items
  add column applied_fuel_mode text check (applied_fuel_mode in ('fixed', 'opinet')),
  add column applied_fuel_price numeric(8, 2),
  add column applied_fuel_type text check (applied_fuel_type in ('gasoline', 'diesel', 'lpg'));

-- 유종별 그날(없으면 7일 안 가장 최근) 전국 평균 가격
create or replace function private.oil_price_on(p_date date, p_type text)
returns numeric
language sql stable security definer
set search_path = ''
as $$
  select case p_type when 'diesel' then h.diesel when 'lpg' then h.lpg else h.gasoline end
    from public.oil_price_history h
   where h.log_date <= p_date and h.log_date >= p_date - 7
     and (case p_type when 'diesel' then h.diesel when 'lpg' then h.lpg else h.gasoline end) is not null
   order by h.log_date desc
   limit 1;
$$;
revoke all on function private.oil_price_on(date, text) from public, anon, authenticated;

-- 금액 재계산 (042 정의 + 자차 유류비 계산 방식)
create or replace function private.recompute_claim(p_claim_id uuid)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_claim public.expense_claims;
  v_company public.companies;
  v_override integer;
  v_fuel text;
  r record;
  a record;
  v_result jsonb;
begin
  select * into v_claim from public.expense_claims where id = p_claim_id;
  select * into v_company from public.companies where id = v_claim.company_id;
  select meal_limit_override, coalesce(fuel_type, 'gasoline') into v_override, v_fuel from public.members where id = v_claim.member_id;
  -- 자차 유류비: 금액은 직원이 넣지 않는다. 상신 때도 이 계산을 거쳐 단가·유가가 스냅샷된다
  --   fixed : 편도 거리 × km당 단가(원 단위 반올림) × 왕복 2
  --   opinet: 올림( 출장 당일 전국 평균 유가 ÷ 12km/L × 총 주행 거리 ) — 유가가 없으면 fixed로 계산
  update public.expense_items i
     set (amount, applied_fuel_rate_per_km, applied_fuel_price, applied_fuel_type, applied_fuel_mode) = (
           select case when i.route_one_way_km is null then null
                       when p.price is not null then ceil(p.price * i.route_one_way_km * (case when i.is_round_trip then 2 else 1 end) / 12.0)::integer
                       else round(i.route_one_way_km * v_company.fuel_rate_per_km)::integer * case when i.is_round_trip then 2 else 1 end end,
                  case when p.price is not null then round(p.price / 12.0)::integer else v_company.fuel_rate_per_km end,
                  p.price,
                  case when p.price is not null then v_fuel end,
                  case when p.price is not null then 'opinet' else 'fixed' end
             from (select case when v_company.fuel_rate_mode = 'opinet'
                               then private.oil_price_on(coalesce(i.expense_date, (now() at time zone 'Asia/Seoul')::date), v_fuel) end as price) p),
         payment_method = 'personal_card',
         corporate_card_id = null
   where i.claim_id = v_claim.id and i.category = 'trip' and i.trip_type = 'own_car';
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

-- 관리자: 자차 유류비 계산 방식
create or replace function public.set_company_fuel_mode(p_mode text)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare v_admin public.members := private.require_admin();
begin
  if p_mode not in ('fixed', 'opinet') then raise exception 'INVALID_FUEL_MODE'; end if;
  update public.companies set fuel_rate_mode = p_mode where id = v_admin.company_id;
end;
$$;
-- 직원: 내 차량 유종
create or replace function public.set_my_fuel_type(p_fuel_type text)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare v_member public.members := private.require_member();
begin
  if p_fuel_type is not null and p_fuel_type not in ('gasoline', 'diesel', 'lpg') then raise exception 'INVALID_FUEL_TYPE'; end if;
  update public.members set fuel_type = p_fuel_type where id = v_member.id;
end;
$$;
revoke all on function public.set_company_fuel_mode(text), public.set_my_fuel_type(text) from public, anon;
grant execute on function public.set_company_fuel_mode(text), public.set_my_fuel_type(text) to authenticated;
