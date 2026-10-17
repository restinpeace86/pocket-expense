-- =============================================================================
-- 025_purchase_category.sql — "회사 물품 구매" 세부 유형·기본 계정과목 (D-076)
--   세부 유형: pantry(탕비실·간식) → 복리후생비 / office_supplies(사무용품·소모품) → 소모품비 / small_equipment(소액 비품) → 소모품비
--   식대처럼 1인 한도 계산 없이 전액 지원(출장비·외부 미팅비와 같음).
--   회사 기본 계정과목·매핑 만들기를 private.seed_account_defaults로 모으고, 새 회사·기존 회사 모두에 적용한다(있으면 건너뜀).
-- =============================================================================

alter table public.expense_items add column purchase_type public.purchase_type;
alter table public.expense_items
  add constraint expense_items_purchase_type_only_for_purchase check (purchase_type is null or category = 'purchase');

alter table public.account_title_mappings add column purchase_type public.purchase_type;
alter table public.account_title_mappings drop constraint account_title_mappings_trip_type_only_for_trip;
alter table public.account_title_mappings
  add constraint account_title_mappings_sub_type check (
    ((category = 'trip') = (trip_type is not null)) and ((category = 'purchase') = (purchase_type is not null))
  );
alter table public.account_title_mappings drop constraint account_title_mappings_company_id_category_trip_type_key;
alter table public.account_title_mappings
  add constraint account_title_mappings_unique_classification unique nulls not distinct (company_id, category, trip_type, purchase_type);

-- 직원이 항목의 세부 유형을 고를 수 있게(기존 trip_type과 같은 권한)
grant insert (purchase_type), update (purchase_type) on public.expense_items to authenticated;

-- 회사 기본 계정과목·매핑 (있으면 건너뛴다 — 관리자가 바꾼 매핑·이름은 건드리지 않음)
create or replace function private.seed_account_defaults(p_company_id uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_welfare uuid; v_travel uuid; v_entertain uuid; v_supplies uuid;
  v_next integer;
  t public.trip_type;
  p public.purchase_type;
begin
  select coalesce(max(sort_order), 0) into v_next from public.account_titles where company_id = p_company_id;

  insert into public.account_titles (company_id, name, sort_order) values (p_company_id, '복리후생비', 1) on conflict (company_id, name) do nothing;
  insert into public.account_titles (company_id, name, sort_order) values (p_company_id, '여비교통비', 2) on conflict (company_id, name) do nothing;
  insert into public.account_titles (company_id, name, sort_order) values (p_company_id, '기업업무추진비', 3) on conflict (company_id, name) do nothing;
  insert into public.account_titles (company_id, name, sort_order) values (p_company_id, '소모품비', greatest(4, v_next + 1)) on conflict (company_id, name) do nothing;

  select id into v_welfare from public.account_titles where company_id = p_company_id and name = '복리후생비';
  select id into v_travel from public.account_titles where company_id = p_company_id and name = '여비교통비';
  select id into v_entertain from public.account_titles where company_id = p_company_id and name = '기업업무추진비';
  select id into v_supplies from public.account_titles where company_id = p_company_id and name = '소모품비';

  insert into public.account_title_mappings (company_id, category, account_title_id) values (p_company_id, 'meal', v_welfare)
    on conflict on constraint account_title_mappings_unique_classification do nothing;
  insert into public.account_title_mappings (company_id, category, account_title_id) values (p_company_id, 'meeting', v_entertain)
    on conflict on constraint account_title_mappings_unique_classification do nothing;
  foreach t in array enum_range(null::public.trip_type) loop
    insert into public.account_title_mappings (company_id, category, trip_type, account_title_id) values (p_company_id, 'trip', t, v_travel)
      on conflict on constraint account_title_mappings_unique_classification do nothing;
  end loop;
  foreach p in array enum_range(null::public.purchase_type) loop
    insert into public.account_title_mappings (company_id, category, purchase_type, account_title_id)
    values (p_company_id, 'purchase', p, case when p = 'pantry' then v_welfare else v_supplies end)
      on conflict on constraint account_title_mappings_unique_classification do nothing;
  end loop;
end;
$$;
revoke all on function private.seed_account_defaults(uuid) from public, anon, authenticated;

-- 기존 회사에도 소모품비·물품 구매 매핑 채우기
do $$
declare c uuid;
begin
  for c in select id from public.companies loop
    perform private.seed_account_defaults(c);
  end loop;
end;
$$;

-- 회사 생성: 기본 계정과목·매핑을 공용 함수로 (011 버전 + seed_account_defaults)
create or replace function public.create_company(
  p_company_name text,
  p_business_number text,
  p_departments text[],
  p_my_name text,
  p_my_phone text,
  p_my_department text,
  p_my_position text,
  p_privacy_agreed boolean,
  p_terms_agreed boolean
)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_no_membership();
  v_company_id uuid;
  v_member_id uuid;
  v_depts text[];
  v_bizno text := regexp_replace(coalesce(p_business_number, ''), '[^0-9]', '', 'g');
  v_biz_status text;
  v_name text := trim(coalesce(p_company_name, ''));
  v_my_name text := trim(coalesce(p_my_name, ''));
begin
  if p_terms_agreed is not true then raise exception 'TERMS_REQUIRED'; end if;
  if p_privacy_agreed is not true then raise exception 'PRIVACY_REQUIRED'; end if;
  if length(v_name) = 0 or length(v_name) > 100 then raise exception 'INVALID_COMPANY_NAME'; end if;
  if length(v_my_name) = 0 or length(v_my_name) > 50 then raise exception 'INVALID_NAME'; end if;
  if v_bizno !~ '^[0-9]{10}$' then raise exception 'INVALID_BUSINESS_NUMBER'; end if;
  v_biz_status := private.check_business_number(v_uid, v_bizno);

  select array_agg(d order by ord) into v_depts
  from (
    select distinct on (trim(x)) trim(x) as d, ord
    from unnest(coalesce(p_departments, '{}')) with ordinality as u(x, ord)
    where length(trim(x)) between 1 and 50
    order by trim(x), ord
  ) s;
  if v_depts is null or array_length(v_depts, 1) > 50 then raise exception 'INVALID_DEPARTMENTS'; end if;
  -- 본인 부서: 비우면 '부서 없음'(대표·임원), 입력하면 부서 목록에 있어야 한다 (D-058)
  if length(trim(coalesce(p_my_department, ''))) > 0 and not (trim(p_my_department) = any(v_depts)) then raise exception 'INVALID_MY_DEPARTMENT'; end if;

  insert into public.companies (name, business_number, invite_code, business_status, business_verified_at)
  values (v_name, v_bizno, private.gen_invite_code(), v_biz_status,
          case when v_biz_status in ('active', 'suspended') then now() end)
  returning id into v_company_id;

  insert into public.departments (company_id, name, sort_order)
  select v_company_id, d, ord::integer from unnest(v_depts) with ordinality as u(d, ord);

  insert into public.members (auth_user_id, company_id, name, phone, email, department_id, position,
                              role, status, joined_via, privacy_agreed_at, approved_at,
                              terms_agreed_at, terms_version, privacy_version)
  values (
    v_uid, v_company_id, v_my_name, private.normalize_phone(p_my_phone),
    (select email from auth.users where id = v_uid),
    (select id from public.departments where company_id = v_company_id and name = nullif(trim(coalesce(p_my_department, '')), '')),
    nullif(trim(coalesce(p_my_position, '')), ''),
    'super_admin', 'approved', 'company_creation', now(), now(),
    now(), private.setting('terms_version', 'draft'), private.setting('privacy_version', 'draft')
  )
  returning id into v_member_id;

  insert into public.approval_lines (company_id, name) values (v_company_id, '기본 결재라인');

  perform private.seed_account_defaults(v_company_id);

  insert into public.credit_ledger (company_id, delta, reason, member_id)
  values (v_company_id, 100, 'free_trial_grant', v_member_id);

  return v_company_id;
end;
$$;
