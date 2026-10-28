-- =============================================================================
-- 077_tax_office_templates.sql — 세무사무소 월말 결산 양식 (D-150)
-- 사용자 지시(2026-10-28): 세무사무소가 자기 회계 프로그램의 엑셀 양식을 한 번 올리면, 그 사무소를 쓰는 고객사들의 월말 자료를
-- 그 양식 그대로 채워서 받게 한다. 양식 파일이 없으면 reference.md 기준 초안 양식(칸 구성만)으로 시작할 수 있다.
-- - 사무소당 양식 최대 10개. 쓰기·지우기는 사무소 관리자, 목록은 사무소 구성원
-- - 양식 파일은 비공개 보관함(tax-office-templates)에 사무소 폴더로, 서버가 운영 키로만 읽고 쓴다(사용자 저장소 권한 없음)
-- - 내려받기: 사무소 구성원(그 고객사를 볼 수 있을 때) 또는 그 사무소와 연결된 회사의 관리자. 행은 세무 마감과 같은 함수
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tax-office-templates', 'tax-office-templates', false, 5242880, array['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict (id) do nothing;

create table public.tax_office_templates (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.tax_offices (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 50),
  target text not null default 'all' check (target in ('all', 'corporate_card', 'personal')),
  file_path text check (file_path is null or file_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.xlsx$'), -- null = 초안(칸 구성만)
  file_name text check (file_name is null or char_length(file_name) <= 200),
  sheet_name text check (sheet_name is null or char_length(sheet_name) <= 100),
  header_row integer not null default 1 check (header_row between 1 and 50),
  columns jsonb not null check (jsonb_typeof(columns) = 'array' and jsonb_array_length(columns) between 1 and 80),
  created_by uuid references public.tax_office_members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (file_path is null or split_part(file_path, '/', 1) = office_id::text)
);
create index tax_office_templates_office_idx on public.tax_office_templates (office_id, created_at);

alter table public.tax_office_templates enable row level security;
alter table public.tax_office_templates force row level security;
revoke all on public.tax_office_templates from anon, authenticated;

-- 칸 설정 검사: [{index 1~200(중복 없음), header ≤100자, field 정해진 값, fixed ≤100자}]
create or replace function private.valid_template_columns(p jsonb)
returns boolean
language plpgsql immutable
set search_path = ''
as $$
declare
  c jsonb;
  v_fields constant text[] := array['empty','fixed','seq','date','date8','month','day','merchant','client_code','biz_no','biz_no_digits','account_name',
    'account_code','memo','supply','vat','amount','service_fee','evidence','payment','card_last4','card_name','member','department','claim_title',
    'category','purpose','evidence_file'];
  v_seen integer[] := '{}';
  v_idx integer;
begin
  if p is null or jsonb_typeof(p) <> 'array' or jsonb_array_length(p) not between 1 and 80 then return false; end if;
  for c in select * from jsonb_array_elements(p) loop
    if jsonb_typeof(c->'index') <> 'number' then return false; end if;
    v_idx := (c->>'index')::integer;
    if v_idx not between 1 and 200 or v_idx = any(v_seen) then return false; end if;
    v_seen := v_seen || v_idx;
    if char_length(coalesce(c->>'header', '')) > 100 then return false; end if;
    if not (c->>'field') = any(v_fields) then return false; end if;
    if c->>'field' = 'fixed' and char_length(coalesce(c->>'fixed', '')) > 100 then return false; end if;
  end loop;
  return true;
end;
$$;
revoke all on function private.valid_template_columns(jsonb) from public, anon, authenticated;

-- 사무소 관리자: 양식 저장(새로 또는 고치기). 파일 경로는 서버가 올린 자기 사무소 폴더만
create or replace function public.save_tax_office_template(p_id uuid, p_name text, p_target text, p_file_path text, p_file_name text,
  p_sheet_name text, p_header_row integer, p_columns jsonb)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v public.tax_office_members := private.require_tax_office_admin();
  v_name text := btrim(coalesce(p_name, ''));
  v_id uuid;
begin
  if char_length(v_name) not between 1 and 50 then raise exception 'INVALID_TEMPLATE_NAME'; end if;
  if p_target not in ('all', 'corporate_card', 'personal') then raise exception 'INVALID_TEMPLATE'; end if;
  if not private.valid_template_columns(p_columns) then raise exception 'INVALID_TEMPLATE'; end if;
  if p_file_path is not null and split_part(p_file_path, '/', 1) <> v.office_id::text then raise exception 'INVALID_TEMPLATE'; end if;
  if p_id is null then
    if (select count(*) from public.tax_office_templates where office_id = v.office_id) >= 10 then raise exception 'TEMPLATE_LIMIT'; end if;
    insert into public.tax_office_templates (office_id, name, target, file_path, file_name, sheet_name, header_row, columns, created_by)
    values (v.office_id, v_name, p_target, p_file_path, nullif(btrim(coalesce(p_file_name, '')), ''), nullif(btrim(coalesce(p_sheet_name, '')), ''),
            coalesce(p_header_row, 1), p_columns, v.id)
    returning id into v_id;
  else
    -- 고칠 때는 이름·대상·칸 설정만(파일은 그대로)
    update public.tax_office_templates
       set name = v_name, target = p_target, columns = p_columns, updated_at = now()
     where id = p_id and office_id = v.office_id
    returning id into v_id;
    if v_id is null then raise exception 'NOT_FOUND'; end if;
  end if;
  return v_id;
end;
$$;

-- 지우기: 지운 양식의 파일 경로를 돌려준다(서버가 보관함에서 지움)
create or replace function public.delete_tax_office_template(p_id uuid)
returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  v public.tax_office_members := private.require_tax_office_admin();
  v_path text;
begin
  delete from public.tax_office_templates where id = p_id and office_id = v.office_id returning file_path into v_path;
  if not found then raise exception 'NOT_FOUND'; end if;
  return v_path;
end;
$$;

-- 사무소 구성원: 우리 사무소 양식 목록
create or replace function public.tax_office_template_list()
returns table (id uuid, name text, target text, file_name text, sheet_name text, header_row integer, columns jsonb, updated_at timestamptz)
language plpgsql stable security definer
set search_path = ''
as $$
declare v public.tax_office_members := private.my_tax_office_member();
begin
  if v.id is null then return; end if;
  return query select t.id, t.name, t.target, t.file_name, t.sheet_name, t.header_row, t.columns, t.updated_at
                 from public.tax_office_templates t where t.office_id = v.office_id order by t.created_at;
end;
$$;

-- 회사 관리자: 우리 회사가 연결된(등록된) 세무사무소의 양식 목록
create or replace function public.my_company_tax_templates()
returns table (id uuid, name text, target text, office_name text)
language plpgsql stable security definer
set search_path = ''
as $$
declare v_admin public.members := private.require_admin();
begin
  return query select t.id, t.name, t.target, o.name
                 from public.company_tax_offices c
                 join public.tax_offices o on o.id = c.office_id
                 join public.tax_office_templates t on t.office_id = c.office_id
                where c.company_id = v_admin.company_id
                order by t.created_at;
end;
$$;

-- 내려받기용 양식(파일 경로·칸 설정): 그 고객사를 볼 수 있는 사무소 구성원, 또는 그 사무소와 연결된 회사의 관리자만
create or replace function public.tax_template_for_export(p_template_id uuid, p_company_id uuid)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  t public.tax_office_templates;
  v_member public.tax_office_members := private.my_tax_office_member();
  v_ok boolean := false;
begin
  if (select auth.uid()) is null then raise exception 'NOT_AUTHENTICATED' using errcode = '42501'; end if;
  select * into t from public.tax_office_templates where id = p_template_id;
  if not found then raise exception 'NOT_FOUND'; end if;
  -- 사무소 쪽
  if v_member.id is not null and v_member.office_id = t.office_id
     and exists (select 1 from private.tax_office_company_ids() c where c = p_company_id) then
    v_ok := true;
  end if;
  -- 회사 쪽(관리자, 자기 회사, 그 사무소와 연결)
  if not v_ok and p_company_id = private.current_company_id() and private.is_admin()
     and exists (select 1 from public.company_tax_offices c where c.company_id = p_company_id and c.office_id = t.office_id) then
    v_ok := true;
  end if;
  if not v_ok then raise exception 'NOT_FOUND'; end if;
  return jsonb_build_object('id', t.id, 'name', t.name, 'target', t.target, 'file_path', t.file_path, 'sheet_name', t.sheet_name,
    'header_row', t.header_row, 'columns', t.columns, 'office_name', (select name from public.tax_offices where id = t.office_id));
end;
$$;

revoke all on function public.save_tax_office_template(uuid, text, text, text, text, text, integer, jsonb), public.delete_tax_office_template(uuid),
  public.tax_office_template_list(), public.my_company_tax_templates(), public.tax_template_for_export(uuid, uuid) from public, anon;
grant execute on function public.save_tax_office_template(uuid, text, text, text, text, text, integer, jsonb), public.delete_tax_office_template(uuid),
  public.tax_office_template_list(), public.my_company_tax_templates(), public.tax_template_for_export(uuid, uuid) to authenticated;
