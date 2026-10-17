-- =============================================================================
-- 023_account_titles_cards_meal_override.sql — 계정과목·법인카드 입력 검증 + 개인별 식대 예외 한도 (T3-5, T3-10, T3-7)
-- 기준: spec/features/account-titles.md, spec/features/corporate-cards.md, admin-team-members.md §4.C, D-036, D-044, D-055
-- 계정과목·법인카드 쓰기는 기존 RLS(자기 회사 + 관리자 이상)로 한다. 여기서는 DB 수준 입력 검증만 더한다.
-- =============================================================================

alter table public.account_titles
  add constraint account_titles_name_len check (length(btrim(name)) between 1 and 30),
  add constraint account_titles_code_len check (code is null or length(code) between 1 and 20);

alter table public.corporate_cards
  add constraint corporate_cards_nickname_len check (length(btrim(nickname)) between 1 and 30);

alter table public.members
  add constraint members_meal_limit_override_max check (meal_limit_override is null or meal_limit_override <= 1000000);

-- 멤버 편집: 개인별 식대 예외 한도 인자 추가
--   p_meal_limit_override: -1(기본) = 바꾸지 않음 / null = 회사 기본 한도 사용 / 0~1,000,000 = 이 멤버만 이 한도
drop function public.update_member(uuid, text, text, uuid, text, text, boolean);

create function public.update_member(
  p_member_id uuid,
  p_name text,
  p_phone text,
  p_department_id uuid,
  p_position text,
  p_employee_number text,
  p_receives_car_allowance boolean default null,
  p_meal_limit_override integer default -1
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
  if p_meal_limit_override is not null and p_meal_limit_override <> -1
     and (p_meal_limit_override < 0 or p_meal_limit_override > 1000000) then
    raise exception 'INVALID_MEAL_LIMIT';
  end if;
  update public.members
     set name = v_name,
         phone = private.normalize_phone(p_phone),
         department_id = p_department_id,
         position = v_position,
         employee_number = v_no,
         receives_car_allowance = coalesce(p_receives_car_allowance, receives_car_allowance),
         meal_limit_override = case when p_meal_limit_override = -1 then meal_limit_override else p_meal_limit_override end,
         updated_at = now()
   where id = v_target.id;
end;
$$;

revoke all on function public.update_member(uuid, text, text, uuid, text, text, boolean, integer) from public, anon;
grant execute on function public.update_member(uuid, text, text, uuid, text, text, boolean, integer) to authenticated;
