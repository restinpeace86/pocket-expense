-- =============================================================================
-- 015_company_settings.sql — 회사·정책 설정 저장 (T3-2)
-- 기준: spec/screens/admin-settings.md §1·§2, spec/features/business-verification.md, D-031, D-040, D-041, D-056, D-057, D-063
-- 변경 이유: 기존에는 관리자가 companies.business_number를 직접 UPDATE할 수 있어,
--   회사 등록 때의 국세청 상태조회(create_company)를 거치지 않고 폐업·미등록 번호로 바꿀 수 있었다.
--   → 회사 정보·정책 컬럼의 직접 UPDATE 권한을 회수하고, 이 함수 하나로만 저장한다(사업자번호가 바뀌면 같은 판정을 다시 한다).
-- 격리: 대상 회사는 인자로 받지 않고 호출자 소속 회사로만 정한다.
-- =============================================================================

revoke update (name, business_number, meal_limit_per_person, meal_limit_mode, fuel_rate_per_km, claim_deadline_type, claim_deadline_days)
  on public.companies from authenticated;
-- event_bonus_acknowledged_at(이벤트 배너 확인)은 기존대로 관리자 직접 UPDATE 유지

create or replace function public.update_company_settings(
  p_name text,
  p_business_number text,
  p_meal_limit_per_person integer,
  p_meal_limit_mode public.meal_limit_mode,
  p_fuel_rate_per_km integer,
  p_claim_deadline_type public.claim_deadline_type,
  p_claim_deadline_days integer
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
  if p_meal_limit_per_person is null or p_meal_limit_per_person < 0 or p_meal_limit_per_person > 1000000 then
    raise exception 'INVALID_MEAL_LIMIT';
  end if;
  if p_meal_limit_mode is null then raise exception 'INVALID_MEAL_LIMIT_MODE'; end if;
  if p_fuel_rate_per_km is null or p_fuel_rate_per_km < 0 or p_fuel_rate_per_km > 10000 then
    raise exception 'INVALID_FUEL_RATE';
  end if;
  if p_claim_deadline_type is null
     or (p_claim_deadline_type = 'days_after' and (p_claim_deadline_days is null or p_claim_deadline_days not between 1 and 90)) then
    raise exception 'INVALID_CLAIM_DEADLINE';
  end if;

  -- 사업자번호가 바뀐 경우에만 회사 등록과 같은 판정(모드·통과 번호·본인 조회 결과)
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
         meal_limit_per_person = p_meal_limit_per_person,
         meal_limit_mode = p_meal_limit_mode,
         fuel_rate_per_km = p_fuel_rate_per_km,
         claim_deadline_type = p_claim_deadline_type,
         claim_deadline_days = case when p_claim_deadline_type = 'days_after' then p_claim_deadline_days end,
         updated_at = now()
   where id = v_company.id;
end;
$$;

revoke all on function public.update_company_settings(text, text, integer, public.meal_limit_mode, integer, public.claim_deadline_type, integer)
  from public, anon;
grant execute on function public.update_company_settings(text, text, integer, public.meal_limit_mode, integer, public.claim_deadline_type, integer)
  to authenticated;
