-- =============================================================================
-- 019_policy_toggles.sql — 식대 한도·자차 유류비 "사용 안 함" + 정산 정책 확인 시각 (D-068)
--   meal_limit_enabled = false → 1인 한도 계산 없이 영수증 금액 전액 지원(일반 식대·출장 식비 모두, D-040)
--   fuel_enabled       = false → 자차 유류비(own_car) 항목을 받지 않는다
--   policy_confirmed_at        → 관리자가 정산 정책을 한 번이라도 저장한 시각. null이면 홈에 "정산 정책 확인" 안내
-- 기존 값(한도·단가)은 사용 안 함일 때도 지우지 않는다(다시 켜면 그대로 쓰도록).
-- =============================================================================

alter table public.companies
  add column meal_limit_enabled boolean not null default true,
  add column fuel_enabled boolean not null default true,
  add column policy_confirmed_at timestamptz;

-- 기존 시그니처(7개 인자)를 지우고 끝에 기본값 있는 인자 2개를 더한다(기존 호출도 그대로 동작)
drop function public.update_company_settings(text, text, integer, public.meal_limit_mode, integer, public.claim_deadline_type, integer);

create function public.update_company_settings(
  p_name text,
  p_business_number text,
  p_meal_limit_per_person integer,
  p_meal_limit_mode public.meal_limit_mode,
  p_fuel_rate_per_km integer,
  p_claim_deadline_type public.claim_deadline_type,
  p_claim_deadline_days integer,
  p_meal_limit_enabled boolean default true,
  p_fuel_enabled boolean default true
)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_admin public.members := private.require_admin();
  v_company public.companies;
  v_name text := btrim(coalesce(p_name, ''));
  v_bizno text := regexp_replace(coalesce(p_business_number, ''), '[^0-9]', '', 'g');
  v_status text;
begin
  select * into v_company from public.companies where id = v_admin.company_id for update;

  if length(v_name) = 0 or length(v_name) > 100 then raise exception 'INVALID_COMPANY_NAME'; end if;
  if v_bizno !~ '^[0-9]{10}$' then raise exception 'INVALID_BUSINESS_NUMBER'; end if;
  if p_meal_limit_enabled is null or p_fuel_enabled is null then raise exception 'INVALID_POLICY'; end if;
  if p_meal_limit_per_person is null or p_meal_limit_per_person < 0 or p_meal_limit_per_person > 1000000 then
    raise exception 'INVALID_MEAL_LIMIT';
  end if;
  if p_meal_limit_mode is null then raise exception 'INVALID_MEAL_LIMIT_MODE'; end if;
  if p_fuel_rate_per_km is null or p_fuel_rate_per_km < 0 or p_fuel_rate_per_km > 10000 then
    raise exception 'INVALID_FUEL_RATE';
  end if;
  if p_claim_deadline_type is null
     or (p_claim_deadline_type = 'days_after' and (p_claim_deadline_days is null or p_claim_deadline_days not between 1 and 90))
     or (p_claim_deadline_type = 'next_month_day' and (p_claim_deadline_days is null or p_claim_deadline_days not between 1 and 28)) then
    raise exception 'INVALID_CLAIM_DEADLINE';
  end if;

  -- 사업자번호가 바뀐 경우에만 회사 등록과 같은 판정(모드·통과 번호·본인 조회 결과) — D-063
  if v_bizno <> v_company.business_number then
    v_status := private.check_business_number((select auth.uid()), v_bizno);
    update public.companies
       set business_number = v_bizno,
           business_status = v_status,
           business_verified_at = case when v_status in ('active', 'suspended') then now() end
     where id = v_company.id;
  end if;

  update public.companies
     set name = v_name,
         meal_limit_enabled = p_meal_limit_enabled,
         meal_limit_per_person = p_meal_limit_per_person,
         meal_limit_mode = p_meal_limit_mode,
         fuel_enabled = p_fuel_enabled,
         fuel_rate_per_km = p_fuel_rate_per_km,
         claim_deadline_type = p_claim_deadline_type,
         claim_deadline_days = case when p_claim_deadline_type in ('days_after', 'next_month_day') then p_claim_deadline_days end,
         policy_confirmed_at = now(),
         updated_at = now()
   where id = v_company.id;
end;
$$;

revoke all on function public.update_company_settings(text, text, integer, public.meal_limit_mode, integer, public.claim_deadline_type, integer, boolean, boolean)
  from public, anon;
grant execute on function public.update_company_settings(text, text, integer, public.meal_limit_mode, integer, public.claim_deadline_type, integer, boolean, boolean)
  to authenticated;
