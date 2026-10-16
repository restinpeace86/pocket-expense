-- =============================================================================
-- 007_onboarding_functions.sql — 회사 생성 · 직원 가입 · 개별 초대 수락 · 내 소속 조회 (T2)
-- 기준: spec/features/auth-onboarding.md, spec/screens/admin-onboarding.md, D-003/D-004/D-030/D-036/D-038/D-042/D-046
-- 격리: 멤버가 아닌 사용자는 회사 데이터를 직접 읽을 수 없으므로(RLS) 가입 전 단계는 아래 함수로만 처리한다.
--       모든 함수는 호출자(auth.uid())가 아직 어느 회사에도 속하지 않았는지 확인한다(1계정 1회사).
-- =============================================================================

-- 초대 코드: 혼동 문자(0/O/1/I) 제외 32자 알파벳 8자리, 중복 시 재생성
create or replace function private.gen_invite_code()
returns text
language plpgsql volatile
set search_path = ''
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_idx constant integer[] := array[0, 1, 2, 3, 4, 5, 10, 11]; -- uuid v4에서 완전 난수인 바이트만 사용
  v_bytes bytea;
  v_code text;
  i integer;
begin
  loop
    v_bytes := uuid_send(gen_random_uuid());
    v_code := '';
    foreach i in array v_idx loop
      v_code := v_code || substr(v_alphabet, (get_byte(v_bytes, i) % 32) + 1, 1);
    end loop;
    exit when not exists (select 1 from public.companies where invite_code = v_code);
  end loop;
  return v_code;
end;
$$;

-- 휴대폰: 숫자만 남기고 국내 휴대폰 형식 검사
create or replace function private.normalize_phone(p_phone text)
returns text
language plpgsql immutable
set search_path = ''
as $$
declare v text := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
begin
  if v !~ '^01[016789][0-9]{7,8}$' then
    raise exception 'INVALID_PHONE';
  end if;
  return v;
end;
$$;

create or replace function private.require_no_membership()
returns uuid
language plpgsql stable security definer
set search_path = ''
as $$
declare v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '42501';
  end if;
  if exists (select 1 from public.members where auth_user_id = v_uid) then
    raise exception 'ALREADY_MEMBER';
  end if;
  return v_uid;
end;
$$;

-- 내 소속 (로그인 후 분기용). 본인 행만, 승인 대기·비활성도 포함
create or replace function public.my_membership()
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'member_id', m.id, 'company_id', m.company_id, 'company_name', c.name,
    'name', m.name, 'role', m.role, 'status', m.status
  )
  from public.members m join public.companies c on c.id = m.company_id
  where m.auth_user_id = (select auth.uid())
$$;

-- 회사 생성 (첫 관리자 = 최고 관리자) ------------------------------------------------
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
  v_bizno text := nullif(regexp_replace(coalesce(p_business_number, ''), '[^0-9]', '', 'g'), '');
  v_name text := trim(coalesce(p_company_name, ''));
  v_my_name text := trim(coalesce(p_my_name, ''));
  v_welfare uuid; v_travel uuid; v_entertain uuid;
  t public.trip_type;
begin
  if p_privacy_agreed is not true then raise exception 'PRIVACY_REQUIRED'; end if;
  if length(v_name) = 0 or length(v_name) > 100 then raise exception 'INVALID_COMPANY_NAME'; end if;
  if length(v_my_name) = 0 or length(v_my_name) > 50 then raise exception 'INVALID_NAME'; end if;
  if v_bizno is not null and v_bizno !~ '^[0-9]{10}$' then raise exception 'INVALID_BUSINESS_NUMBER'; end if;

  select array_agg(d order by ord) into v_depts
  from (
    select distinct on (trim(x)) trim(x) as d, ord
    from unnest(coalesce(p_departments, '{}')) with ordinality as u(x, ord)
    where length(trim(x)) between 1 and 50
    order by trim(x), ord
  ) s;
  if v_depts is null or array_length(v_depts, 1) > 50 then raise exception 'INVALID_DEPARTMENTS'; end if;
  if not (trim(coalesce(p_my_department, '')) = any(v_depts)) then raise exception 'INVALID_MY_DEPARTMENT'; end if;

  insert into public.companies (name, business_number, invite_code)
  values (v_name, v_bizno, private.gen_invite_code())
  returning id into v_company_id;

  insert into public.departments (company_id, name, sort_order)
  select v_company_id, d, ord::integer from unnest(v_depts) with ordinality as u(d, ord);

  insert into public.members (auth_user_id, company_id, name, phone, email, department_id, position,
                              role, status, joined_via, privacy_agreed_at, approved_at)
  values (
    v_uid, v_company_id, v_my_name, private.normalize_phone(p_my_phone),
    (select email from auth.users where id = v_uid),
    (select id from public.departments where company_id = v_company_id and name = trim(p_my_department)),
    nullif(trim(coalesce(p_my_position, '')), ''),
    'super_admin', 'approved', 'company_creation', now(), now()
  )
  returning id into v_member_id;

  -- 기본 결재라인: 사전 검토 0단계 = 관리자 직통 (D-039)
  insert into public.approval_lines (company_id, name) values (v_company_id, '기본 결재라인');

  -- 기본 계정과목·매핑 (D-036)
  insert into public.account_titles (company_id, name, sort_order) values (v_company_id, '복리후생비', 1) returning id into v_welfare;
  insert into public.account_titles (company_id, name, sort_order) values (v_company_id, '여비교통비', 2) returning id into v_travel;
  insert into public.account_titles (company_id, name, sort_order) values (v_company_id, '기업업무추진비', 3) returning id into v_entertain;
  insert into public.account_title_mappings (company_id, category, trip_type, account_title_id)
  values (v_company_id, 'meal', null, v_welfare), (v_company_id, 'meeting', null, v_entertain);
  foreach t in array enum_range(null::public.trip_type) loop
    insert into public.account_title_mappings (company_id, category, trip_type, account_title_id)
    values (v_company_id, 'trip', t, v_travel);
  end loop;

  -- 무료 크레딧 100장 (D-046)
  insert into public.credit_ledger (company_id, delta, reason, member_id)
  values (v_company_id, 100, 'free_trial_grant', v_member_id);

  return v_company_id;
end;
$$;

-- 공용 초대 링크/QR ----------------------------------------------------------------
-- 로그인 전 화면에서 회사명만 보여 준다
create or replace function public.get_invite_company(p_code text)
returns text
language sql stable security definer
set search_path = ''
as $$
  select name from public.companies where invite_code = upper(trim(coalesce(p_code, '')))
$$;

-- 로그인 후 가입 폼의 부서 목록 (아직 멤버가 아닌 사용자만)
create or replace function public.get_invite_departments(p_code text)
returns table (id uuid, name text)
language plpgsql stable security definer
set search_path = ''
as $$
declare v_company uuid;
begin
  perform private.require_no_membership();
  select c.id into v_company from public.companies c where c.invite_code = upper(trim(coalesce(p_code, '')));
  if v_company is null then raise exception 'INVALID_INVITE_CODE'; end if;
  return query select d.id, d.name from public.departments d where d.company_id = v_company order by d.sort_order, d.name;
end;
$$;

create or replace function private.insert_joining_member(
  p_uid uuid, p_company uuid, p_name text, p_phone text, p_department_id uuid, p_position text,
  p_employee_number text, p_vehicle_number text, p_bank_name text, p_account_number text, p_account_holder text,
  p_privacy_agreed boolean, p_status public.member_status, p_joined_via text
)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare v_member uuid; v_name text := trim(coalesce(p_name, ''));
begin
  if p_privacy_agreed is not true then raise exception 'PRIVACY_REQUIRED'; end if;
  if length(v_name) = 0 or length(v_name) > 50 then raise exception 'INVALID_NAME'; end if;
  -- 부서는 반드시 가입하려는 회사의 부서
  if p_department_id is null or not exists (select 1 from public.departments where id = p_department_id and company_id = p_company) then
    raise exception 'INVALID_DEPARTMENT';
  end if;
  if (nullif(trim(coalesce(p_bank_name, '')), '') is null) <> (nullif(trim(coalesce(p_account_number, '')), '') is null)
     or (nullif(trim(coalesce(p_bank_name, '')), '') is null) <> (nullif(trim(coalesce(p_account_holder, '')), '') is null) then
    raise exception 'INCOMPLETE_BANK_ACCOUNT';
  end if;

  insert into public.members (auth_user_id, company_id, name, phone, email, department_id, position, employee_number,
                              vehicle_number, role, status, joined_via, privacy_agreed_at, approved_at)
  values (p_uid, p_company, v_name, private.normalize_phone(p_phone), (select email from auth.users where id = p_uid),
          p_department_id, nullif(trim(coalesce(p_position, '')), ''), nullif(trim(coalesce(p_employee_number, '')), ''),
          nullif(trim(coalesce(p_vehicle_number, '')), ''), 'employee', p_status, p_joined_via, now(),
          case when p_status = 'approved' then now() end)
  returning id into v_member;

  if nullif(trim(coalesce(p_bank_name, '')), '') is not null then
    insert into public.member_bank_accounts (member_id, company_id, bank_name, account_number, account_holder)
    values (v_member, p_company, trim(p_bank_name), trim(p_account_number), trim(p_account_holder));
  end if;
  return v_member;
end;
$$;

-- 공용 링크로 가입 → 승인 대기
create or replace function public.join_company(
  p_code text, p_name text, p_phone text, p_department_id uuid, p_position text, p_employee_number text,
  p_vehicle_number text, p_bank_name text, p_account_number text, p_account_holder text, p_privacy_agreed boolean
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
                                       p_privacy_agreed, 'pending', 'shared_link');
end;
$$;

-- 개별 초대 (D-042) ---------------------------------------------------------------
-- 로그인 전: 회사명·초대받은 사람 이름만
create or replace function public.get_invitation_public(p_token text)
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select jsonb_build_object('company_name', c.name, 'name', i.name)
  from public.member_invitations i join public.companies c on c.id = i.company_id
  where i.token = p_token and i.status = 'invited'
$$;

-- 로그인 후(아직 멤버 아님): 미리 채울 값 + 부서 목록
create or replace function public.get_invitation_detail(p_token text)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare v jsonb;
begin
  perform private.require_no_membership();
  select jsonb_build_object(
    'company_name', c.name, 'name', i.name, 'phone', i.phone, 'department_id', i.department_id, 'position', i.position,
    'departments', coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'name', d.name) order by d.sort_order, d.name)
                             from public.departments d where d.company_id = i.company_id), '[]'::jsonb)
  ) into v
  from public.member_invitations i join public.companies c on c.id = i.company_id
  where i.token = p_token and i.status = 'invited';
  if v is null then raise exception 'INVALID_INVITATION'; end if;
  return v;
end;
$$;

-- 개별 초대 수락 → 즉시 활성
create or replace function public.accept_invitation(
  p_token text, p_name text, p_phone text, p_department_id uuid, p_position text, p_employee_number text,
  p_vehicle_number text, p_bank_name text, p_account_number text, p_account_holder text, p_privacy_agreed boolean
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
                                            p_account_holder, p_privacy_agreed, 'approved', 'invitation');
  update public.member_invitations set status = 'accepted', accepted_member_id = v_member where id = v_inv.id;
  return v_member;
end;
$$;

-- 실행 권한 -----------------------------------------------------------------------
revoke all on function private.gen_invite_code(), private.normalize_phone(text), private.require_no_membership(),
  private.insert_joining_member(uuid, uuid, text, text, uuid, text, text, text, text, text, text, boolean, public.member_status, text)
  from public, anon, authenticated;
revoke all on function public.my_membership(), public.create_company(text, text, text[], text, text, text, text, boolean),
  public.get_invite_company(text), public.get_invite_departments(text),
  public.join_company(text, text, text, uuid, text, text, text, text, text, text, boolean),
  public.get_invitation_public(text), public.get_invitation_detail(text),
  public.accept_invitation(text, text, text, uuid, text, text, text, text, text, text, boolean)
  from public, anon;
grant execute on function public.get_invite_company(text), public.get_invitation_public(text) to anon, authenticated;
grant execute on function public.my_membership(), public.create_company(text, text, text[], text, text, text, text, boolean),
  public.get_invite_departments(text), public.join_company(text, text, text, uuid, text, text, text, text, text, text, boolean),
  public.get_invitation_detail(text), public.accept_invitation(text, text, text, uuid, text, text, text, text, text, text, boolean)
  to authenticated;
