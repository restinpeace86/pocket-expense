-- =============================================================================
-- 010_creator_department_optional.sql — 회사 등록자의 본인 부서 "부서 없음" 허용 (D-058)
--   대표·임원은 부서에 속하지 않을 수 있다. 부서 없음(department_id null)은 모든 기능에서 정상 상태로 다룬다
--   (결재라인은 회사 기본 결재라인, 화면·엑셀은 "부서 없음"). 직원 가입은 지금처럼 부서 필수.
-- =============================================================================

create or replace function public.create_company(
  p_company_name text,
  p_business_number text,
  p_departments text[],
  p_my_name text,
  p_my_phone text,
  p_my_department text,
  p_my_position text,
  p_privacy_agreed boolean
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
  v_welfare uuid; v_travel uuid; v_entertain uuid;
  t public.trip_type;
begin
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
                              role, status, joined_via, privacy_agreed_at, approved_at)
  values (
    v_uid, v_company_id, v_my_name, private.normalize_phone(p_my_phone),
    (select email from auth.users where id = v_uid),
    (select id from public.departments where company_id = v_company_id and name = nullif(trim(coalesce(p_my_department, '')), '')),
    nullif(trim(coalesce(p_my_position, '')), ''),
    'super_admin', 'approved', 'company_creation', now(), now()
  )
  returning id into v_member_id;

  insert into public.approval_lines (company_id, name) values (v_company_id, '기본 결재라인');

  insert into public.account_titles (company_id, name, sort_order) values (v_company_id, '복리후생비', 1) returning id into v_welfare;
  insert into public.account_titles (company_id, name, sort_order) values (v_company_id, '여비교통비', 2) returning id into v_travel;
  insert into public.account_titles (company_id, name, sort_order) values (v_company_id, '기업업무추진비', 3) returning id into v_entertain;
  insert into public.account_title_mappings (company_id, category, trip_type, account_title_id)
  values (v_company_id, 'meal', null, v_welfare), (v_company_id, 'meeting', null, v_entertain);
  foreach t in array enum_range(null::public.trip_type) loop
    insert into public.account_title_mappings (company_id, category, trip_type, account_title_id)
    values (v_company_id, 'trip', t, v_travel);
  end loop;

  insert into public.credit_ledger (company_id, delta, reason, member_id)
  values (v_company_id, 100, 'free_trial_grant', v_member_id);

  return v_company_id;
end;
$$;
