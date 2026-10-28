-- =============================================================================
-- 079_tax_office_governance.sql — 세무사무소 운영 보완 (D-152)
-- 사용자 결정(2026-10-28):
-- ① 사무소가 고객사 연결을 해제할 수 있다(회사가 일방적으로 넣은 연결). 해제된 연결은 회사가 다시 저장하기 전까지 자동으로 붙지 않는다
-- ② 등록된 세무사무소와 연결된 회사는 계정과목·분류 연결을 회사가 바꿀 수 없고 사무소가 관리한다. 회사는 변경 이력을 본다
-- ③ 사무소 관리자 넘기기, 세무사 사무소 나가기, 사무소 닫기
-- =============================================================================

-- ── ① 고객사 해제 ───────────────────────────────────────────────────────────
alter table public.company_tax_offices
  add column released_at timestamptz,
  add column released_office_name text;

-- 등록·합류 때 요청을 붙일 때 해제된 연결은 건너뛴다
create or replace function private.attach_tax_office_clients(p_office uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare v_email text;
begin
  select contact_email into v_email from public.tax_offices where id = p_office;
  update public.company_tax_offices set office_id = p_office, updated_at = now()
   where office_id is null and released_at is null and office_email = v_email;
  update public.company_tax_offices c set assigned_member_id = m.id
    from public.tax_office_members m
   where c.office_id = p_office and c.assigned_member_id is null and c.agent_email is not null
     and m.office_id = p_office and m.status = 'active' and m.email = c.agent_email;
end;
$$;

-- 회사가 저장하면(다시 지정) 해제 표시는 지운다
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
  v_office uuid;
begin
  if char_length(v_office_name) not between 1 and 100 then raise exception 'INVALID_TAX_OFFICE'; end if;
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' or char_length(v_email) > 254 then raise exception 'INVALID_TAX_OFFICE_EMAIL'; end if;
  if v_agent is not null and char_length(v_agent) > 50 then raise exception 'INVALID_TAX_AGENT_NAME'; end if;
  if v_agent_email is not null and v_agent_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then raise exception 'INVALID_TAX_AGENT_EMAIL'; end if;
  if v_phone is not null and v_phone !~ '^0[0-9]{8,10}$' then raise exception 'INVALID_TAX_AGENT_PHONE'; end if;

  perform 1 from public.company_tax_offices where company_id = v_admin.company_id for update;
  select id into v_office from public.tax_offices where contact_email = v_email;
  insert into public.company_tax_offices (company_id, office_name, office_email, agent_name, agent_email, agent_phone, office_id, updated_by_member_id)
  values (v_admin.company_id, v_office_name, v_email, v_agent, v_agent_email, v_phone, v_office, v_admin.id)
  on conflict (company_id) do update
     set office_name = excluded.office_name, office_email = excluded.office_email, agent_name = excluded.agent_name,
         agent_email = excluded.agent_email, agent_phone = excluded.agent_phone, office_id = excluded.office_id,
         assigned_member_id = case when public.company_tax_offices.office_email = excluded.office_email
                                    and public.company_tax_offices.office_id is not distinct from excluded.office_id
                               then public.company_tax_offices.assigned_member_id end,
         released_at = null, released_office_name = null,
         updated_by_member_id = excluded.updated_by_member_id, updated_at = now();
  if v_office is not null then perform private.attach_tax_office_clients(v_office); end if;
end;
$$;

-- 사무소 관리자: 고객사 연결 해제
create or replace function public.release_tax_office_client(p_company_id uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v public.tax_office_members := private.require_tax_office_admin();
  v_office_name text;
begin
  select name into v_office_name from public.tax_offices where id = v.office_id;
  update public.company_tax_offices
     set office_id = null, assigned_member_id = null, released_at = now(), released_office_name = v_office_name, updated_at = now()
   where company_id = p_company_id and office_id = v.office_id;
  if not found then raise exception 'NOT_FOUND'; end if;
end;
$$;

-- 회사 화면 표시: 해제 여부·계정과목 사무소 관리 여부 추가
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
    'assigned_name', r.assigned_name, 'assigned_email', r.assigned_email, 'updated_at', r.updated_at,
    'released_at', r.released_at, 'released_office_name', r.released_office_name);
end;
$$;

-- ── ② 계정과목은 연결된 세무사무소가 관리 ─────────────────────────────────────────
-- 등록된 세무사무소와 연결된(해제되지 않은) 회사인가
create or replace function private.company_tax_office_managed(p_company uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.company_tax_offices where company_id = p_company and office_id is not null)
$$;
revoke all on function private.company_tax_office_managed(uuid) from public, anon;
grant execute on function private.company_tax_office_managed(uuid) to authenticated;

-- 회사 관리자의 쓰기 정책: 사무소가 관리하는 동안은 막는다(조회는 그대로)
do $$
declare t text;
begin
  foreach t in array array['account_titles', 'account_title_mappings'] loop
    execute format('drop policy %I on public.%I', t || '_insert', t);
    execute format('drop policy %I on public.%I', t || '_update', t);
    execute format('drop policy %I on public.%I', t || '_delete', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (company_id = private.current_company_id() and private.is_admin() and not private.company_tax_office_managed(company_id))', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (company_id = private.current_company_id() and private.is_admin() and not private.company_tax_office_managed(company_id)) with check (company_id = private.current_company_id() and private.is_admin() and not private.company_tax_office_managed(company_id))', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (company_id = private.current_company_id() and private.is_admin() and not private.company_tax_office_managed(company_id))', t || '_delete', t);
  end loop;
end;
$$;

-- 변경 이력: 세무사무소 구성원이 바꾼 것만 남긴다(회사는 연결된 동안 못 바꾸므로)
create table public.account_title_changes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  entity text not null check (entity in ('title', 'mapping')),
  action text not null check (action in ('insert', 'update', 'delete')),
  detail jsonb not null default '{}'::jsonb,
  actor_name text,
  office_name text,
  created_at timestamptz not null default now()
);
create index account_title_changes_company_idx on public.account_title_changes (company_id, created_at desc);
alter table public.account_title_changes enable row level security;
alter table public.account_title_changes force row level security;
revoke all on public.account_title_changes from anon, authenticated;
grant select on public.account_title_changes to authenticated;
create policy account_title_changes_select on public.account_title_changes for select to authenticated
  using ((company_id = (select private.current_company_id()) and (select private.is_admin()))
         or company_id in (select private.tax_office_company_ids()));

create or replace function private.log_account_title_change()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_company uuid := coalesce(new.company_id, old.company_id);
  m public.tax_office_members;
  v_office text;
  v_detail jsonb;
  v_old_title text;
  v_new_title text;
begin
  -- 사무소 구성원이 그 회사를 볼 수 있을 때만(회사 자신의 변경·시스템 기본값은 남기지 않음)
  select * into m from public.tax_office_members where auth_user_id = (select auth.uid()) and status = 'active';
  if m.id is null or not exists (select 1 from private.tax_office_company_ids() c where c = v_company) then
    return coalesce(new, old);
  end if;
  select name into v_office from public.tax_offices where id = m.office_id;
  if tg_table_name = 'account_titles' then
    if tg_op = 'UPDATE' and new.name is not distinct from old.name and new.code is not distinct from old.code then return new; end if;
    v_detail := jsonb_build_object('old_name', case when tg_op <> 'INSERT' then old.name end, 'old_code', case when tg_op <> 'INSERT' then old.code end,
                                   'new_name', case when tg_op <> 'DELETE' then new.name end, 'new_code', case when tg_op <> 'DELETE' then new.code end);
  else
    if tg_op = 'UPDATE' and new.account_title_id is not distinct from old.account_title_id then return new; end if;
    if tg_op <> 'INSERT' then select name into v_old_title from public.account_titles where id = old.account_title_id; end if;
    if tg_op <> 'DELETE' then select name into v_new_title from public.account_titles where id = new.account_title_id; end if;
    v_detail := jsonb_build_object('category', coalesce(new.category, old.category), 'trip_type', coalesce(new.trip_type, old.trip_type),
                                   'purchase_type', coalesce(new.purchase_type, old.purchase_type), 'condolence_target', coalesce(new.condolence_target, old.condolence_target),
                                   'old_title', v_old_title, 'new_title', v_new_title);
  end if;
  insert into public.account_title_changes (company_id, entity, action, detail, actor_name, office_name)
  values (v_company, case when tg_table_name = 'account_titles' then 'title' else 'mapping' end, lower(tg_op), v_detail, m.name, v_office);
  return coalesce(new, old);
end;
$$;
revoke all on function private.log_account_title_change() from public, anon, authenticated;
create trigger account_titles_change_log after insert or update or delete on public.account_titles
  for each row execute function private.log_account_title_change();
create trigger account_title_mappings_change_log after insert or update or delete on public.account_title_mappings
  for each row execute function private.log_account_title_change();

-- ── ③ 관리자 넘기기·나가기·사무소 닫기 ─────────────────────────────────────────────
create or replace function public.transfer_tax_office_admin(p_member_id uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare v public.tax_office_members := private.require_tax_office_admin();
begin
  if p_member_id = v.id then raise exception 'INVALID_TARGET'; end if;
  update public.tax_office_members set role = 'admin' where id = p_member_id and office_id = v.office_id and status = 'active';
  if not found then raise exception 'NOT_FOUND'; end if;
  update public.tax_office_members set role = 'staff' where id = v.id;
end;
$$;

-- 세무사(관리자 아님)가 사무소에서 나가기. 관리자는 먼저 넘기거나 사무소를 닫는다
create or replace function public.leave_tax_office()
returns void
language plpgsql security definer
set search_path = ''
as $$
declare v public.tax_office_members;
begin
  select * into v from public.tax_office_members where auth_user_id = (select auth.uid());
  if v.id is null then raise exception 'NOT_A_TAX_OFFICE_MEMBER' using errcode = '42501'; end if;
  if v.role = 'admin' then raise exception 'ADMIN_MUST_TRANSFER'; end if;
  delete from public.tax_office_members where id = v.id; -- 맡던 배정은 FK로 풀린다
end;
$$;

-- 사무소 닫기(관리자, 사무소명을 그대로 입력해 확인): 고객사 연결은 '가입 대기'로 돌아가고 구성원·양식은 지운다.
-- 지운 양식 파일 경로를 돌려준다(서버가 보관함에서 지움)
create or replace function public.close_tax_office(p_confirm_name text)
returns text[]
language plpgsql security definer
set search_path = ''
as $$
declare
  v public.tax_office_members := private.require_tax_office_admin();
  v_name text;
  v_paths text[];
begin
  select name into v_name from public.tax_offices where id = v.office_id for update;
  if btrim(coalesce(p_confirm_name, '')) <> v_name then raise exception 'CONFIRM_NAME_MISMATCH'; end if;
  select coalesce(array_agg(file_path) filter (where file_path is not null), '{}') into v_paths from public.tax_office_templates where office_id = v.office_id;
  update public.company_tax_offices set office_id = null, assigned_member_id = null, updated_at = now() where office_id = v.office_id;
  delete from public.tax_offices where id = v.office_id; -- 구성원·양식은 함께 지워진다
  return v_paths;
end;
$$;

revoke all on function public.release_tax_office_client(uuid), public.transfer_tax_office_admin(uuid), public.leave_tax_office(), public.close_tax_office(text) from public, anon;
grant execute on function public.release_tax_office_client(uuid), public.transfer_tax_office_admin(uuid), public.leave_tax_office(), public.close_tax_office(text) to authenticated;
