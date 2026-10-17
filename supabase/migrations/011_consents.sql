-- =============================================================================
-- 011_consents.sql — 이용약관 · 개인정보 동의 기록 (D-059)
--   [필수] 서비스 이용약관 / [필수] 개인정보 수집·이용 / [선택] 선택 항목(정산 계좌·차량번호) 수집·이용
--   동의 시각과 동의한 문서 버전을 저장한다. 문서 본문은 초안이며 정식 오픈 전 보완한다(O-07).
-- =============================================================================

alter table public.members
  add column terms_agreed_at timestamptz,
  add column terms_version text,
  add column privacy_version text,
  add column optional_consent_at timestamptz;

insert into private.app_settings (key, value) values
  ('terms_version', 'draft-2026-10-17'),
  ('privacy_version', 'draft-2026-10-17')
on conflict (key) do nothing;

-- 서명(인자)이 바뀌므로 기존 함수를 지우고 다시 만든다
drop function if exists public.create_company(text, text, text[], text, text, text, text, boolean);
drop function if exists public.join_company(text, text, text, uuid, text, text, text, text, text, text, boolean);
drop function if exists public.accept_invitation(text, text, text, uuid, text, text, text, text, text, text, boolean);
drop function if exists private.insert_joining_member(uuid, uuid, text, text, uuid, text, text, text, text, text, text, boolean, public.member_status, text);

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
  v_welfare uuid; v_travel uuid; v_entertain uuid;
  t public.trip_type;
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

create or replace function private.insert_joining_member(
  p_uid uuid, p_company uuid, p_name text, p_phone text, p_department_id uuid, p_position text,
  p_employee_number text, p_vehicle_number text, p_bank_name text, p_account_number text, p_account_holder text,
  p_privacy_agreed boolean, p_terms_agreed boolean, p_optional_agreed boolean,
  p_status public.member_status, p_joined_via text
)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_member uuid;
  v_name text := trim(coalesce(p_name, ''));
  v_has_bank boolean := nullif(trim(coalesce(p_bank_name, '')), '') is not null;
  v_has_vehicle boolean := nullif(trim(coalesce(p_vehicle_number, '')), '') is not null;
begin
  if p_terms_agreed is not true then raise exception 'TERMS_REQUIRED'; end if;
  if p_privacy_agreed is not true then raise exception 'PRIVACY_REQUIRED'; end if;
  -- 선택 항목(정산 계좌·차량번호)은 선택 동의가 있어야 저장한다
  if (v_has_bank or v_has_vehicle) and p_optional_agreed is not true then raise exception 'OPTIONAL_CONSENT_REQUIRED'; end if;
  if length(v_name) = 0 or length(v_name) > 50 then raise exception 'INVALID_NAME'; end if;
  -- 부서는 반드시 가입하려는 회사의 부서
  if p_department_id is null or not exists (select 1 from public.departments where id = p_department_id and company_id = p_company) then
    raise exception 'INVALID_DEPARTMENT';
  end if;
  if v_has_bank <> (nullif(trim(coalesce(p_account_number, '')), '') is not null)
     or v_has_bank <> (nullif(trim(coalesce(p_account_holder, '')), '') is not null) then
    raise exception 'INCOMPLETE_BANK_ACCOUNT';
  end if;

  insert into public.members (auth_user_id, company_id, name, phone, email, department_id, position, employee_number,
                              vehicle_number, role, status, joined_via, privacy_agreed_at, approved_at,
                              terms_agreed_at, terms_version, privacy_version, optional_consent_at)
  values (p_uid, p_company, v_name, private.normalize_phone(p_phone), (select email from auth.users where id = p_uid),
          p_department_id, nullif(trim(coalesce(p_position, '')), ''), nullif(trim(coalesce(p_employee_number, '')), ''),
          nullif(trim(coalesce(p_vehicle_number, '')), ''), 'employee', p_status, p_joined_via, now(),
          case when p_status = 'approved' then now() end,
          now(), private.setting('terms_version', 'draft'), private.setting('privacy_version', 'draft'),
          case when p_optional_agreed then now() end)
  returning id into v_member;

  if v_has_bank then
    insert into public.member_bank_accounts (member_id, company_id, bank_name, account_number, account_holder)
    values (v_member, p_company, trim(p_bank_name), trim(p_account_number), trim(p_account_holder));
  end if;
  return v_member;
end;
$$;

create or replace function public.join_company(
  p_code text, p_name text, p_phone text, p_department_id uuid, p_position text, p_employee_number text,
  p_vehicle_number text, p_bank_name text, p_account_number text, p_account_holder text,
  p_privacy_agreed boolean, p_terms_agreed boolean, p_optional_agreed boolean
)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare v_uid uuid := private.require_no_membership(); v_company uuid;
begin
  select id into v_company from public.companies where invite_code = upper(trim(coalesce(p_code, '')));
  if v_company is null then raise exception 'INVALID_INVITE_CODE'; end if;
  return private.insert_joining_member(v_uid, v_company, p_name, p_phone, p_department_id, p_position, p_employee_number,
                                       p_vehicle_number, p_bank_name, p_account_number, p_account_holder,
                                       p_privacy_agreed, p_terms_agreed, p_optional_agreed, 'pending', 'shared_link');
end;
$$;

create or replace function public.accept_invitation(
  p_token text, p_name text, p_phone text, p_department_id uuid, p_position text, p_employee_number text,
  p_vehicle_number text, p_bank_name text, p_account_number text, p_account_holder text,
  p_privacy_agreed boolean, p_terms_agreed boolean, p_optional_agreed boolean
)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare v_uid uuid := private.require_no_membership(); v_inv public.member_invitations; v_member uuid;
begin
  select * into v_inv from public.member_invitations where token = p_token for update;
  if not found or v_inv.status <> 'invited' then raise exception 'INVALID_INVITATION'; end if;
  v_member := private.insert_joining_member(v_uid, v_inv.company_id, p_name, p_phone, p_department_id, p_position,
                                            p_employee_number, p_vehicle_number, p_bank_name, p_account_number,
                                            p_account_holder, p_privacy_agreed, p_terms_agreed, p_optional_agreed,
                                            'approved', 'invitation');
  update public.member_invitations set status = 'accepted', accepted_member_id = v_member where id = v_inv.id;
  return v_member;
end;
$$;

-- 권한
revoke all on function private.insert_joining_member(uuid, uuid, text, text, uuid, text, text, text, text, text, text, boolean, boolean, boolean, public.member_status, text)
  from public, anon, authenticated;
revoke all on function public.create_company(text, text, text[], text, text, text, text, boolean, boolean),
  public.join_company(text, text, text, uuid, text, text, text, text, text, text, boolean, boolean, boolean),
  public.accept_invitation(text, text, text, uuid, text, text, text, text, text, text, boolean, boolean, boolean)
  from public, anon;
grant execute on function public.create_company(text, text, text[], text, text, text, text, boolean, boolean),
  public.join_company(text, text, text, uuid, text, text, text, text, text, text, boolean, boolean, boolean),
  public.accept_invitation(text, text, text, uuid, text, text, text, text, text, text, boolean, boolean, boolean)
  to authenticated;
