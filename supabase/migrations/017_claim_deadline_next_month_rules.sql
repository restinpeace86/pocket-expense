-- =============================================================================
-- 017_claim_deadline_next_month_rules.sql — "결제한 다음 달 N일까지" 규칙·기본값 (D-064)
-- 국내 경비관리 서비스의 일반적인 방식(월 마감 + 다음 달 초 며칠 여유)을 따른다.
--   next_month_day: claim_deadline_days = 다음 달 며칠(1~28). 예) 5 → 10월 결제분은 11월 5일까지
--   days_after:     claim_deadline_days = 결제일로부터 N일(1~90)
-- 새 회사 기본값: 다음 달 5일까지. 기존 회사의 설정은 바꾸지 않는다.
-- =============================================================================

alter table public.companies drop constraint companies_deadline_days_required;
alter table public.companies add constraint companies_deadline_days_required check (
  (claim_deadline_type not in ('days_after', 'next_month_day') or claim_deadline_days is not null)
  and (claim_deadline_type <> 'next_month_day' or claim_deadline_days between 1 and 28)
);
alter table public.companies alter column claim_deadline_type set default 'next_month_day';
alter table public.companies alter column claim_deadline_days set default 5;

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
         meal_limit_per_person = p_meal_limit_per_person,
         meal_limit_mode = p_meal_limit_mode,
         fuel_rate_per_km = p_fuel_rate_per_km,
         claim_deadline_type = p_claim_deadline_type,
         claim_deadline_days = case when p_claim_deadline_type in ('days_after', 'next_month_day') then p_claim_deadline_days end,
         updated_at = now()
   where id = v_company.id;
end;
$$;
