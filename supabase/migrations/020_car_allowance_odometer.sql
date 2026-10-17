-- =============================================================================
-- 020_car_allowance_odometer.sql — 자가운전보조금 수령 직원 표시 + 계기판 사진 받기 설정 (D-070)
--   members.receives_car_allowance = true → 그 직원은 자차 유류비(own_car) 항목을 만들 수 없다
--     (자가운전보조금 비과세와 유류비 실비 중복 방지. 통행료·주차비 영수증은 그대로 가능). 관리자가 급여 기준으로 체크한다.
--   companies.odometer_photo_required = true → 자차 유류비 항목에 출발·도착 계기판 사진을 받는다(기본 끔)
-- 직원 쪽 차단·사진 입력은 T7에서 이 값을 읽어 구현한다.
-- =============================================================================

alter table public.members add column receives_car_allowance boolean not null default false;
alter table public.companies add column odometer_photo_required boolean not null default false;

-- 멤버 편집: 자가운전보조금 인자 추가(기본값 null = 바꾸지 않음, 기존 호출 그대로 동작)
drop function public.update_member(uuid, text, text, uuid, text, text);

create function public.update_member(
  p_member_id uuid,
  p_name text,
  p_phone text,
  p_department_id uuid,
  p_position text,
  p_employee_number text,
  p_receives_car_allowance boolean default null
)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_admin public.members := private.require_admin();
  v_target public.members := private.lock_company_member(v_admin, p_member_id);
  v_name text := btrim(coalesce(p_name, ''));
  v_position text := nullif(btrim(coalesce(p_position, '')), '');
  v_no text := nullif(btrim(coalesce(p_employee_number, '')), '');
begin
  if v_target.id <> v_admin.id then
    perform private.require_can_manage(v_admin, v_target);
  end if;
  if length(v_name) = 0 or length(v_name) > 50 then raise exception 'INVALID_NAME'; end if;
  if length(v_position) > 50 or length(v_no) > 50 then raise exception 'INVALID_TEXT_LENGTH'; end if;
  if p_department_id is not null
     and not exists (select 1 from public.departments where id = p_department_id and company_id = v_admin.company_id) then
    raise exception 'INVALID_DEPARTMENT';
  end if;
  update public.members
     set name = v_name,
         phone = private.normalize_phone(p_phone),
         department_id = p_department_id,
         position = v_position,
         employee_number = v_no,
         receives_car_allowance = coalesce(p_receives_car_allowance, receives_car_allowance),
         updated_at = now()
   where id = v_target.id;
end;
$$;

revoke all on function public.update_member(uuid, text, text, uuid, text, text, boolean) from public, anon;
grant execute on function public.update_member(uuid, text, text, uuid, text, text, boolean) to authenticated;

-- 회사 설정: 계기판 사진 인자 추가(기본값 null = 바꾸지 않음)
drop function public.update_company_settings(text, text, integer, public.meal_limit_mode, integer, public.claim_deadline_type, integer, boolean, boolean);

create function public.update_company_settings(
  p_name text,
  p_business_number text,
  p_meal_limit_per_person integer,
  p_meal_limit_mode public.meal_limit_mode,
  p_fuel_rate_per_km integer,
  p_claim_deadline_type public.claim_deadline_type,
  p_claim_deadline_days integer,
  p_meal_limit_enabled boolean default true,
  p_fuel_enabled boolean default true,
  p_odometer_photo_required boolean default null
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
         odometer_photo_required = coalesce(p_odometer_photo_required, odometer_photo_required),
         claim_deadline_type = p_claim_deadline_type,
         claim_deadline_days = case when p_claim_deadline_type in ('days_after', 'next_month_day') then p_claim_deadline_days end,
         policy_confirmed_at = now(),
         updated_at = now()
   where id = v_company.id;
end;
$$;

revoke all on function public.update_company_settings(text, text, integer, public.meal_limit_mode, integer, public.claim_deadline_type, integer, boolean, boolean, boolean)
  from public, anon;
grant execute on function public.update_company_settings(text, text, integer, public.meal_limit_mode, integer, public.claim_deadline_type, integer, boolean, boolean, boolean)
  to authenticated;
