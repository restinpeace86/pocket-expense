-- =============================================================================
-- 009_business_verification.sql — 사업자등록번호 국세청 상태조회 (D-057)
--   모드(private.app_settings.business_verify_mode)
--     off     : 검사 안 함, 아무 번호나 통과 (현재 기본값 — MVP 테스트용)
--     warn    : 조회 결과를 기록만 하고 통과
--     enforce : 미등록·폐업 번호는 회사 생성 거부. 휴업은 경고 후 통과. 조회 실패(키·API 장애)는 '확인 대기'로 통과
--   통과 구멍: business_verify_bypass_numbers(쉼표 구분)에 넣은 번호는 어떤 모드에서도 통과('bypass')
--   검사는 create_company 안에서 하므로 화면을 우회해 함수를 직접 불러도 피할 수 없다.
-- =============================================================================

-- 1. 앱 설정 (API로 노출되지 않는 private 스키마, 운영자가 SQL로 변경)
create table if not exists private.app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
insert into private.app_settings (key, value) values
  ('business_verify_mode', 'off'),
  ('business_verify_bypass_numbers', '')
on conflict (key) do nothing;

create or replace function private.setting(p_key text, p_default text)
returns text
language sql stable security definer
set search_path = ''
as $$
  select coalesce((select value from private.app_settings where key = p_key), p_default)
$$;

-- 화면이 조회 여부를 판단하도록 모드만 공개 (값은 비밀 아님)
create or replace function public.business_verify_mode()
returns text
language sql stable security definer
set search_path = ''
as $$
  select private.setting('business_verify_mode', 'off')
$$;

-- 2. 사업자등록번호 체크섬 (국세청 검증 공식)
create or replace function private.valid_business_number(p text)
returns boolean
language plpgsql immutable
set search_path = ''
as $$
declare
  w constant integer[] := array[1, 3, 7, 1, 3, 7, 1, 3, 5];
  s integer := 0;
  i integer;
begin
  if p !~ '^[0-9]{10}$' then return false; end if;
  for i in 1..9 loop
    s := s + substr(p, i, 1)::integer * w[i];
  end loop;
  s := s + (substr(p, 9, 1)::integer * 5) / 10;
  return (10 - (s % 10)) % 10 = substr(p, 10, 1)::integer;
end;
$$;

-- 3. 조회 결과 기록 (서버가 service role로만 기록. 앱 사용자는 읽기·쓰기 불가)
create table public.business_verifications (
  id uuid primary key default gen_random_uuid(),
  b_no text not null check (b_no ~ '^[0-9]{10}$'),
  auth_user_id uuid not null references auth.users (id) on delete cascade,
  status text not null check (status in ('active', 'suspended', 'closed', 'not_registered', 'unverified')),
  status_label text,
  raw jsonb,
  checked_at timestamptz not null default now()
);
create index business_verifications_lookup_idx on public.business_verifications (b_no, auth_user_id, checked_at desc);
alter table public.business_verifications enable row level security;
alter table public.business_verifications force row level security;
revoke all on public.business_verifications from anon, authenticated;
grant select, insert on public.business_verifications to service_role;

-- 4. 회사에 검증 결과 저장
alter table public.companies
  add column business_status text not null default 'skipped'
    check (business_status in ('skipped', 'bypass', 'active', 'suspended', 'unverified')),
  add column business_verified_at timestamptz;

-- 5. 회사 생성 시 판정
create or replace function private.check_business_number(p_uid uuid, p_bizno text)
returns text
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_mode text := private.setting('business_verify_mode', 'off');
  v_bypass text[] := array_remove(string_to_array(replace(private.setting('business_verify_bypass_numbers', ''), ' ', ''), ','), '');
  v_status text;
begin
  if v_mode = 'off' then return 'skipped'; end if;
  if p_bizno = any(v_bypass) then return 'bypass'; end if;
  if not private.valid_business_number(p_bizno) then raise exception 'INVALID_BUSINESS_NUMBER'; end if;

  -- 같은 사용자가 최근 30분 안에 서버를 통해 조회한 결과
  select status into v_status from public.business_verifications
   where b_no = p_bizno and auth_user_id = p_uid and checked_at > now() - interval '30 minutes'
   order by checked_at desc limit 1;
  v_status := coalesce(v_status, 'unverified');

  if v_mode = 'enforce' then
    if v_status = 'closed' then raise exception 'BUSINESS_CLOSED'; end if;
    if v_status = 'not_registered' then raise exception 'BUSINESS_NOT_REGISTERED'; end if;
  end if;
  -- warn 모드에서 closed/not_registered는 기록만 하고 '확인 대기'로 저장
  if v_status in ('closed', 'not_registered') then return 'unverified'; end if;
  return v_status;
end;
$$;

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
  if not (trim(coalesce(p_my_department, '')) = any(v_depts)) then raise exception 'INVALID_MY_DEPARTMENT'; end if;

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
    (select id from public.departments where company_id = v_company_id and name = trim(p_my_department)),
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

-- 6. 권한
revoke all on function private.setting(text, text), private.valid_business_number(text),
  private.check_business_number(uuid, text) from public, anon, authenticated;
revoke all on function public.business_verify_mode() from public, anon;
grant execute on function public.business_verify_mode() to authenticated;
