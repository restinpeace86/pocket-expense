-- =============================================================================
-- 076_tax_offices.sql — 세무사무소 워크스페이스 (D-149, D-148 연결 구조 대체)
-- 사용자 결정(2026-10-28): 회사가 계약하는 상대는 세무사 개인이 아니라 세무사무소, 담당 세무사는 사무소가 배정
-- - 세무사무소 = 별도 조직(회사 멤버와 별개, D-004와 무관). 처음 등록한 사람이 사무소 관리자, 소속 세무사·직원은 초대 코드로 합류
-- - 회사 관리자가 [설정 › 세무사무소]에 사무소명·사무소 이메일·담당 세무사(선택)를 넣으면:
--   그 이메일로 등록된 사무소가 있으면 바로 그 사무소 고객사 목록에, 없으면 그 이메일로 로그인해 사무소를 등록하는 순간 목록에
-- - 회사가 적은 담당 세무사 이메일이 사무소 구성원과 같으면 자동 배정, 아니면 사무소 관리자가 배정
-- - 열람: 사무소 관리자 = 모든 고객사, 소속 세무사 = 배정된 고객사만 (승인·지급된 지출만, 세무 마감과 같은 함수)
-- - 계정과목·분류 연결: 열람 가능한 세무사무소 구성원이 추가·수정(삭제 없음)
-- =============================================================================

-- ── D-148(세무사 개인 이메일 연결) 걷어내기: 실제 데이터 0행 ───────────────────
drop policy if exists account_titles_tax_agent_select on public.account_titles;
drop policy if exists account_titles_tax_agent_insert on public.account_titles;
drop policy if exists account_titles_tax_agent_update on public.account_titles;
drop policy if exists account_title_mappings_tax_agent_select on public.account_title_mappings;
drop policy if exists account_title_mappings_tax_agent_insert on public.account_title_mappings;
drop policy if exists account_title_mappings_tax_agent_update on public.account_title_mappings;
drop function if exists public.tax_agent_month_export(uuid, text);
drop function if exists public.my_tax_agent_companies();
drop function if exists public.set_tax_agent(text, text, text, text);
drop function if exists public.clear_tax_agent();
drop function if exists private.require_tax_agent(uuid);
drop function if exists private.tax_agent_company_ids();
drop table if exists public.tax_agent_links;

-- ── 테이블 ────────────────────────────────────────────────────────────────
create table public.tax_offices (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100),
  business_number text not null unique check (business_number ~ '^[0-9]{10}$'),
  business_status text not null default 'skipped' check (business_status in ('skipped', 'bypass', 'active', 'suspended', 'unverified')),
  contact_email text not null unique check (contact_email = lower(contact_email) and char_length(contact_email) <= 254),
  invite_code text not null unique check (invite_code ~ '^[A-Z0-9]{8}$'),
  created_at timestamptz not null default now()
);

create table public.tax_office_members (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.tax_offices (id) on delete cascade,
  auth_user_id uuid not null unique references auth.users (id) on delete cascade, -- 한 계정은 한 사무소(회사 멤버와는 별개)
  name text not null check (char_length(name) between 1 and 50),
  phone text check (phone is null or phone ~ '^01[016789][0-9]{7,8}$'),
  email text check (email is null or email = lower(email)),
  role text not null check (role in ('admin', 'staff')),
  status text not null default 'active' check (status in ('active', 'inactive')),
  terms_agreed_at timestamptz not null,
  privacy_agreed_at timestamptz not null,
  terms_version text,
  privacy_version text,
  created_at timestamptz not null default now(),
  unique (id, office_id)
);
create index tax_office_members_office_idx on public.tax_office_members (office_id);
create index tax_office_members_email_idx on public.tax_office_members (email);

create table public.company_tax_offices (
  company_id uuid primary key references public.companies (id) on delete cascade,
  office_name text not null check (char_length(office_name) between 1 and 100), -- 회사가 적은 사무소명
  office_email text not null check (office_email = lower(office_email) and office_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' and char_length(office_email) <= 254),
  agent_name text check (agent_name is null or char_length(agent_name) between 1 and 50), -- 회사가 알고 있는 담당 세무사(참고)
  agent_email text check (agent_email is null or (agent_email = lower(agent_email) and agent_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')),
  agent_phone text check (agent_phone is null or agent_phone ~ '^0[0-9]{8,10}$'),
  office_id uuid references public.tax_offices (id) on delete set null, -- 사무소가 등록되면 채워짐
  assigned_member_id uuid,
  updated_by_member_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (assigned_member_id, office_id) references public.tax_office_members (id, office_id) on delete set null (assigned_member_id),
  foreign key (updated_by_member_id, company_id) references public.members (id, company_id) on delete set null (updated_by_member_id),
  check (assigned_member_id is null or office_id is not null)
);
create index company_tax_offices_email_idx on public.company_tax_offices (office_email) where office_id is null;
create index company_tax_offices_office_idx on public.company_tax_offices (office_id);

do $$
declare t text;
begin
  foreach t in array array['tax_offices', 'tax_office_members', 'company_tax_offices'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end;
$$;
-- 고객 쪽: 자기 회사 관리자만 자기 회사 연결을 읽는다. 사무소 쪽·쓰기는 모두 함수로
grant select on public.company_tax_offices to authenticated;
create policy company_tax_offices_select on public.company_tax_offices for select to authenticated
  using (company_id = (select private.current_company_id()) and (select private.is_admin()));

-- ── 내부 함수 ──────────────────────────────────────────────────────────────
create or replace function private.my_tax_office_member()
returns public.tax_office_members
language sql stable security definer
set search_path = ''
as $$
  select m.* from public.tax_office_members m where m.auth_user_id = (select auth.uid()) and m.status = 'active'
$$;

-- 이 계정(사무소 구성원)이 볼 수 있는 회사: 관리자 = 사무소 모든 고객사, 세무사 = 배정된 고객사
create or replace function private.tax_office_company_ids()
returns setof uuid
language sql stable security definer
set search_path = ''
as $$
  select c.company_id
    from public.company_tax_offices c
    join public.tax_office_members m on m.office_id = c.office_id
   where m.auth_user_id = (select auth.uid()) and m.status = 'active'
     and (m.role = 'admin' or c.assigned_member_id = m.id)
$$;

create or replace function private.require_tax_office_company(p_company uuid)
returns void
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then raise exception 'NOT_AUTHENTICATED' using errcode = '42501'; end if;
  if p_company is null or not exists (select 1 from private.tax_office_company_ids() c where c = p_company) then
    raise exception 'NOT_FOUND';
  end if;
end;
$$;

create or replace function private.require_tax_office_admin()
returns public.tax_office_members
language plpgsql stable security definer
set search_path = ''
as $$
declare v public.tax_office_members := private.my_tax_office_member();
begin
  if v.id is null then raise exception 'NOT_A_TAX_OFFICE_MEMBER' using errcode = '42501'; end if;
  if v.role <> 'admin' then raise exception 'NOT_ALLOWED' using errcode = '42501'; end if;
  return v;
end;
$$;

create or replace function private.gen_tax_office_code()
returns text
language plpgsql volatile
set search_path = ''
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_bytes bytea;
  v_code text;
  i integer;
begin
  loop
    v_bytes := uuid_send(gen_random_uuid());
    v_code := '';
    foreach i in array array[0, 1, 2, 3, 4, 5, 10, 11] loop
      v_code := v_code || substr(v_alphabet, (get_byte(v_bytes, i) % 32) + 1, 1);
    end loop;
    exit when not exists (select 1 from public.tax_offices where invite_code = v_code);
  end loop;
  return v_code;
end;
$$;

-- 사무소가 정해지지 않은 고객사 연결을 사무소에 붙이고, 담당 세무사 이메일이 구성원과 같으면 배정한다
create or replace function private.attach_tax_office_clients(p_office uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare v_email text;
begin
  select contact_email into v_email from public.tax_offices where id = p_office;
  update public.company_tax_offices set office_id = p_office, updated_at = now()
   where office_id is null and office_email = v_email;
  update public.company_tax_offices c set assigned_member_id = m.id
    from public.tax_office_members m
   where c.office_id = p_office and c.assigned_member_id is null and c.agent_email is not null
     and m.office_id = p_office and m.status = 'active' and m.email = c.agent_email;
end;
$$;

revoke all on function private.my_tax_office_member(), private.tax_office_company_ids(), private.require_tax_office_company(uuid),
  private.require_tax_office_admin(), private.gen_tax_office_code(), private.attach_tax_office_clients(uuid) from public, anon, authenticated;
-- RLS 정책(계정과목)이 호출
grant execute on function private.tax_office_company_ids() to authenticated;

-- ── 회사 관리자: 세무사무소 지정·해제·상태 ─────────────────────────────────────
create or replace function public.set_company_tax_office(p_office_name text, p_office_email text, p_agent_name text, p_agent_email text, p_agent_phone text)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_admin public.members := private.require_admin();
  v_office_name text := btrim(coalesce(p_office_name, ''));
  v_email text := lower(btrim(coalesce(p_office_email, '')));
  v_agent text := nullif(btrim(coalesce(p_agent_name, '')), '');
  v_agent_email text := nullif(lower(btrim(coalesce(p_agent_email, ''))), '');
  v_phone text := nullif(regexp_replace(coalesce(p_agent_phone, ''), '[^0-9]', '', 'g'), '');
  v_old public.company_tax_offices;
  v_office uuid;
begin
  if char_length(v_office_name) not between 1 and 100 then raise exception 'INVALID_TAX_OFFICE'; end if;
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' or char_length(v_email) > 254 then raise exception 'INVALID_TAX_OFFICE_EMAIL'; end if;
  if v_agent is not null and char_length(v_agent) > 50 then raise exception 'INVALID_TAX_AGENT_NAME'; end if;
  if v_agent_email is not null and v_agent_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then raise exception 'INVALID_TAX_AGENT_EMAIL'; end if;
  if v_phone is not null and v_phone !~ '^0[0-9]{8,10}$' then raise exception 'INVALID_TAX_AGENT_PHONE'; end if;

  select * into v_old from public.company_tax_offices where company_id = v_admin.company_id for update;
  select id into v_office from public.tax_offices where contact_email = v_email;
  insert into public.company_tax_offices (company_id, office_name, office_email, agent_name, agent_email, agent_phone, office_id, updated_by_member_id)
  values (v_admin.company_id, v_office_name, v_email, v_agent, v_agent_email, v_phone, v_office, v_admin.id)
  on conflict (company_id) do update
     set office_name = excluded.office_name, office_email = excluded.office_email, agent_name = excluded.agent_name,
         agent_email = excluded.agent_email, agent_phone = excluded.agent_phone, office_id = excluded.office_id,
         -- 사무소가 바뀌면 배정도 처음부터
         assigned_member_id = case when public.company_tax_offices.office_email = excluded.office_email then public.company_tax_offices.assigned_member_id end,
         updated_by_member_id = excluded.updated_by_member_id, updated_at = now();
  if v_office is not null then perform private.attach_tax_office_clients(v_office); end if;
end;
$$;

create or replace function public.clear_company_tax_office()
returns void
language plpgsql security definer
set search_path = ''
as $$
declare v_admin public.members := private.require_admin();
begin
  delete from public.company_tax_offices where company_id = v_admin.company_id;
end;
$$;

-- 관리자 화면 표시용: 사무소 등록 여부·배정된 담당 세무사
create or replace function public.my_company_tax_office()
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_admin public.members := private.require_admin();
  r record;
begin
  select c.*, o.name as registered_name, m.name as assigned_name, m.email as assigned_email
    into r
    from public.company_tax_offices c
    left join public.tax_offices o on o.id = c.office_id
    left join public.tax_office_members m on m.id = c.assigned_member_id and m.status = 'active'
   where c.company_id = v_admin.company_id;
  if not found then return null; end if;
  return jsonb_build_object(
    'office_name', r.office_name, 'office_email', r.office_email, 'agent_name', r.agent_name, 'agent_email', r.agent_email, 'agent_phone', r.agent_phone,
    'registered', r.office_id is not null, 'registered_name', r.registered_name,
    'assigned_name', r.assigned_name, 'assigned_email', r.assigned_email, 'updated_at', r.updated_at);
end;
$$;
revoke all on function public.set_company_tax_office(text, text, text, text, text), public.clear_company_tax_office(), public.my_company_tax_office() from public, anon;
grant execute on function public.set_company_tax_office(text, text, text, text, text), public.clear_company_tax_office(), public.my_company_tax_office() to authenticated;

-- ── 세무사무소: 등록·합류·내 정보 ─────────────────────────────────────────────
-- 사무소 화면 진입 상태: 구성원 정보, 또는 아직 구성원이 아니면 내 이메일로 들어온 요청(등록 전 안내용)
create or replace function public.my_tax_office()
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_email text := private.current_verified_email();
  m public.tax_office_members;
  o public.tax_offices;
begin
  if v_uid is null then return null; end if;
  select * into m from public.tax_office_members where auth_user_id = v_uid;
  if found then
    select * into o from public.tax_offices where id = m.office_id;
    return jsonb_build_object('member_id', m.id, 'office_id', o.id, 'office_name', o.name, 'role', m.role, 'status', m.status, 'name', m.name,
      'invite_code', case when m.role = 'admin' and m.status = 'active' then o.invite_code end);
  end if;
  return jsonb_build_object('member_id', null, 'email', v_email,
    'requests', coalesce((select jsonb_agg(jsonb_build_object('company_name', co.name, 'office_name', c.office_name) order by c.created_at)
                            from public.company_tax_offices c join public.companies co on co.id = c.company_id
                           where c.office_id is null and v_email is not null and c.office_email = v_email), '[]'::jsonb));
end;
$$;

create or replace function public.register_tax_office(p_name text, p_business_number text, p_my_name text, p_my_phone text, p_terms_agreed boolean, p_privacy_agreed boolean)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_email text := private.current_verified_email();
  v_name text := btrim(coalesce(p_name, ''));
  v_bizno text := regexp_replace(coalesce(p_business_number, ''), '[^0-9]', '', 'g');
  v_my text := btrim(coalesce(p_my_name, ''));
  v_status text;
  v_office uuid;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '42501'; end if;
  if v_email is null then raise exception 'EMAIL_NOT_VERIFIED'; end if;
  if exists (select 1 from public.tax_office_members where auth_user_id = v_uid) then raise exception 'ALREADY_TAX_OFFICE_MEMBER'; end if;
  if not coalesce(p_terms_agreed, false) then raise exception 'TERMS_REQUIRED'; end if;
  if not coalesce(p_privacy_agreed, false) then raise exception 'PRIVACY_REQUIRED'; end if;
  if char_length(v_name) not between 1 and 100 then raise exception 'INVALID_TAX_OFFICE'; end if;
  if v_bizno !~ '^[0-9]{10}$' then raise exception 'INVALID_BUSINESS_NUMBER'; end if;
  if char_length(v_my) not between 1 and 50 then raise exception 'INVALID_NAME'; end if;
  if exists (select 1 from public.tax_offices where contact_email = v_email) then raise exception 'TAX_OFFICE_EMAIL_TAKEN'; end if;
  if exists (select 1 from public.tax_offices where business_number = v_bizno) then raise exception 'TAX_OFFICE_ALREADY_REGISTERED'; end if;
  v_status := private.check_business_number(v_uid, v_bizno); -- 회사 등록과 같은 국세청 확인(D-057)

  insert into public.tax_offices (name, business_number, business_status, contact_email, invite_code)
  values (v_name, v_bizno, v_status, v_email, private.gen_tax_office_code())
  returning id into v_office;
  insert into public.tax_office_members (office_id, auth_user_id, name, phone, email, role, terms_agreed_at, privacy_agreed_at, terms_version, privacy_version)
  values (v_office, v_uid, v_my, case when nullif(btrim(coalesce(p_my_phone, '')), '') is null then null else private.normalize_phone(p_my_phone) end,
          v_email, 'admin', now(), now(), private.setting('terms_version', 'draft'), private.setting('privacy_version', 'draft'));
  perform private.attach_tax_office_clients(v_office);
  return v_office;
end;
$$;

create or replace function public.get_tax_office_by_code(p_code text)
returns text
language sql stable security definer
set search_path = ''
as $$
  select name from public.tax_offices where invite_code = upper(btrim(coalesce(p_code, '')))
$$;

create or replace function public.join_tax_office(p_code text, p_my_name text, p_my_phone text, p_terms_agreed boolean, p_privacy_agreed boolean)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_office uuid;
  v_my text := btrim(coalesce(p_my_name, ''));
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '42501'; end if;
  if exists (select 1 from public.tax_office_members where auth_user_id = v_uid) then raise exception 'ALREADY_TAX_OFFICE_MEMBER'; end if;
  select id into v_office from public.tax_offices where invite_code = upper(btrim(coalesce(p_code, '')));
  if v_office is null then raise exception 'INVALID_TAX_OFFICE_CODE'; end if;
  if not coalesce(p_terms_agreed, false) then raise exception 'TERMS_REQUIRED'; end if;
  if not coalesce(p_privacy_agreed, false) then raise exception 'PRIVACY_REQUIRED'; end if;
  if char_length(v_my) not between 1 and 50 then raise exception 'INVALID_NAME'; end if;
  insert into public.tax_office_members (office_id, auth_user_id, name, phone, email, role, terms_agreed_at, privacy_agreed_at, terms_version, privacy_version)
  values (v_office, v_uid, v_my, case when nullif(btrim(coalesce(p_my_phone, '')), '') is null then null else private.normalize_phone(p_my_phone) end,
          private.current_verified_email(), 'staff', now(), now(), private.setting('terms_version', 'draft'), private.setting('privacy_version', 'draft'));
  perform private.attach_tax_office_clients(v_office);
  return v_office;
end;
$$;
revoke all on function public.my_tax_office(), public.register_tax_office(text, text, text, text, boolean, boolean),
  public.get_tax_office_by_code(text), public.join_tax_office(text, text, text, boolean, boolean) from public, anon;
grant execute on function public.my_tax_office(), public.register_tax_office(text, text, text, text, boolean, boolean),
  public.get_tax_office_by_code(text), public.join_tax_office(text, text, text, boolean, boolean) to authenticated;

-- ── 세무사무소: 고객사·배정·구성원 ───────────────────────────────────────────
-- 고객사 목록: 관리자 = 전체(배정 정보 포함), 세무사 = 배정된 곳
create or replace function public.tax_office_clients()
returns table (company_id uuid, company_name text, business_number text, agent_name text, agent_email text, assigned_member_id uuid, assigned_name text, linked_at timestamptz)
language plpgsql stable security definer
set search_path = ''
as $$
declare v public.tax_office_members := private.my_tax_office_member();
begin
  if v.id is null then return; end if;
  return query
    select c.company_id, co.name, co.business_number, c.agent_name, c.agent_email, c.assigned_member_id, m.name, c.updated_at
      from public.company_tax_offices c
      join public.companies co on co.id = c.company_id
      left join public.tax_office_members m on m.id = c.assigned_member_id
     where c.office_id = v.office_id and (v.role = 'admin' or c.assigned_member_id = v.id)
     order by co.name;
end;
$$;

create or replace function public.assign_tax_office_agent(p_company_id uuid, p_member_id uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare v public.tax_office_members := private.require_tax_office_admin();
begin
  if not exists (select 1 from public.company_tax_offices where company_id = p_company_id and office_id = v.office_id) then raise exception 'NOT_FOUND'; end if;
  if p_member_id is not null and not exists (select 1 from public.tax_office_members where id = p_member_id and office_id = v.office_id and status = 'active') then
    raise exception 'NOT_FOUND';
  end if;
  update public.company_tax_offices set assigned_member_id = p_member_id, updated_at = now() where company_id = p_company_id;
end;
$$;

create or replace function public.tax_office_member_list()
returns table (id uuid, name text, email text, phone text, role text, status text, created_at timestamptz, assigned_count bigint)
language plpgsql stable security definer
set search_path = ''
as $$
declare v public.tax_office_members := private.require_tax_office_admin();
begin
  return query
    select m.id, m.name, m.email, m.phone, m.role, m.status, m.created_at,
           (select count(*) from public.company_tax_offices c where c.assigned_member_id = m.id)
      from public.tax_office_members m
     where m.office_id = v.office_id
     order by m.role, m.created_at;
end;
$$;

-- 구성원 이용 중지·다시 사용(관리자, 본인 제외). 중지하면 맡던 고객사 배정은 풀린다
create or replace function public.set_tax_office_member_status(p_member_id uuid, p_status text)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare v public.tax_office_members := private.require_tax_office_admin();
begin
  if p_status not in ('active', 'inactive') then raise exception 'INVALID_STATUS'; end if;
  if p_member_id = v.id then raise exception 'INVALID_TARGET'; end if;
  update public.tax_office_members set status = p_status where id = p_member_id and office_id = v.office_id;
  if not found then raise exception 'NOT_FOUND'; end if;
  if p_status = 'inactive' then
    update public.company_tax_offices set assigned_member_id = null, updated_at = now() where assigned_member_id = p_member_id;
  end if;
end;
$$;

create or replace function public.regenerate_tax_office_code()
returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  v public.tax_office_members := private.require_tax_office_admin();
  v_code text := private.gen_tax_office_code();
begin
  update public.tax_offices set invite_code = v_code where id = v.office_id;
  return v_code;
end;
$$;

-- 세무 자료(열람 가능한 회사만) — 관리자 세무 마감과 같은 함수
create or replace function public.tax_office_month_export(p_company_id uuid, p_month text)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
begin
  perform private.require_tax_office_company(p_company_id);
  return private.tax_month_export_for(p_company_id, p_month);
end;
$$;
revoke all on function public.tax_office_clients(), public.assign_tax_office_agent(uuid, uuid), public.tax_office_member_list(),
  public.set_tax_office_member_status(uuid, text), public.regenerate_tax_office_code(), public.tax_office_month_export(uuid, text) from public, anon;
grant execute on function public.tax_office_clients(), public.assign_tax_office_agent(uuid, uuid), public.tax_office_member_list(),
  public.set_tax_office_member_status(uuid, text), public.regenerate_tax_office_code(), public.tax_office_month_export(uuid, text) to authenticated;

-- ── 계정과목·분류 연결: 열람 가능한 사무소 구성원이 조회·추가·수정 ───────────────────
create policy account_titles_tax_office_select on public.account_titles for select to authenticated
  using (company_id in (select private.tax_office_company_ids()));
create policy account_titles_tax_office_insert on public.account_titles for insert to authenticated
  with check (company_id in (select private.tax_office_company_ids()));
create policy account_titles_tax_office_update on public.account_titles for update to authenticated
  using (company_id in (select private.tax_office_company_ids())) with check (company_id in (select private.tax_office_company_ids()));
create policy account_title_mappings_tax_office_select on public.account_title_mappings for select to authenticated
  using (company_id in (select private.tax_office_company_ids()));
create policy account_title_mappings_tax_office_insert on public.account_title_mappings for insert to authenticated
  with check (company_id in (select private.tax_office_company_ids()));
create policy account_title_mappings_tax_office_update on public.account_title_mappings for update to authenticated
  using (company_id in (select private.tax_office_company_ids())) with check (company_id in (select private.tax_office_company_ids()));
