-- =============================================================================
-- 085_hometax_uploads.sql — 회사가 올린 홈택스 자료를 세무사무소도 보기 (D-158)
-- 사용자 지시(2026-10-29): 회사가 홈택스에서 내려받아 올린 자료(전자세금계산서·현금영수증·사업용 신용카드 매입 등)는
-- 세무사무소가 우리 앱에서 보고 원본을 받을 수 있게 — 세무사가 홈택스에 다시 들어가지 않아도 되게.
-- - 달별·종류별로 원본 파일을 비공개 보관함(hometax-files/{회사}/{uuid}.{확장자})에 두고, 머리글·미리보기(30줄)·줄 수를 함께 저장
-- - 쓰기·지우기는 회사 관리자(함수), 읽기는 회사 관리자와 그 회사를 볼 수 있는 세무사무소 구성원. 파일은 서버가 운영 키로만 읽고 쓴다
-- - 결의서와 맞춰 보는 대조는 실제 파일 형식을 확인한 뒤(다음 단계)
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit)
values ('hometax-files', 'hometax-files', false, 10485760)
on conflict (id) do nothing;

create table public.hometax_uploads (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  month text not null check (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  kind text not null check (kind in ('tax_invoice', 'cash_receipt', 'business_card', 'other')),
  file_path text not null check (split_part(file_path, '/', 1) = company_id::text),
  file_name text not null check (char_length(file_name) between 1 and 200),
  file_size integer not null check (file_size between 1 and 10485760),
  header jsonb not null default '[]'::jsonb check (jsonb_typeof(header) = 'array'),
  preview jsonb not null default '[]'::jsonb check (jsonb_typeof(preview) = 'array'),
  row_count integer not null default 0 check (row_count >= 0),
  memo text check (memo is null or char_length(memo) <= 200),
  uploaded_by_name text,
  created_at timestamptz not null default now()
);
create index hometax_uploads_company_month_idx on public.hometax_uploads (company_id, month, created_at);

alter table public.hometax_uploads enable row level security;
alter table public.hometax_uploads force row level security;
revoke all on public.hometax_uploads from anon, authenticated;
grant select on public.hometax_uploads to authenticated;
create policy hometax_uploads_select on public.hometax_uploads for select to authenticated
  using ((company_id = (select private.current_company_id()) and (select private.is_admin())) or company_id in (select private.tax_office_company_ids()));

-- 회사 관리자: 올린 파일 기록(파일은 서버가 먼저 보관함에 올림). 한 달에 30개까지
create or replace function public.add_hometax_upload(p_month text, p_kind text, p_file_path text, p_file_name text, p_file_size integer, p_header jsonb, p_preview jsonb, p_row_count integer, p_memo text)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_admin public.members := private.require_admin();
  v_id uuid;
begin
  if p_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then raise exception 'INVALID_MONTH'; end if;
  if split_part(coalesce(p_file_path, ''), '/', 1) <> v_admin.company_id::text then raise exception 'INVALID_HOMETAX'; end if;
  if (select count(*) from public.hometax_uploads where company_id = v_admin.company_id and month = p_month) >= 30 then raise exception 'HOMETAX_LIMIT'; end if;
  begin
    insert into public.hometax_uploads (company_id, month, kind, file_path, file_name, file_size, header, preview, row_count, memo, uploaded_by_name)
    values (v_admin.company_id, p_month, p_kind, p_file_path, left(p_file_name, 200), p_file_size, coalesce(p_header, '[]'::jsonb), coalesce(p_preview, '[]'::jsonb),
            greatest(coalesce(p_row_count, 0), 0), nullif(btrim(coalesce(p_memo, '')), ''), v_admin.name)
    returning id into v_id;
  exception when check_violation then
    raise exception 'INVALID_HOMETAX';
  end;
  return v_id;
end;
$$;

-- 회사 관리자: 지우기(지운 파일 경로를 돌려줘 서버가 보관함에서 지움)
create or replace function public.delete_hometax_upload(p_id uuid)
returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  v_admin public.members := private.require_admin();
  v_path text;
begin
  delete from public.hometax_uploads where id = p_id and company_id = v_admin.company_id returning file_path into v_path;
  if v_path is null then raise exception 'NOT_FOUND'; end if;
  return v_path;
end;
$$;
revoke all on function public.add_hometax_upload(text, text, text, text, integer, jsonb, jsonb, integer, text), public.delete_hometax_upload(uuid) from public, anon;
grant execute on function public.add_hometax_upload(text, text, text, text, integer, jsonb, jsonb, integer, text), public.delete_hometax_upload(uuid) to authenticated;

-- 내려받기 기록에 홈택스 원본 받기 추가
alter table public.tax_export_downloads drop constraint tax_export_downloads_kind_check;
alter table public.tax_export_downloads add constraint tax_export_downloads_kind_check check (kind in ('preview', 'package', 'office_xlsx', 'office_zip', 'template', 'hometax'));
create or replace function public.log_tax_export(p_company_id uuid, p_month text, p_kind text, p_row_count integer, p_template_name text, p_closed boolean)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  m public.members;
  o public.tax_office_members;
  v_office text;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '42501'; end if;
  select * into m from public.members where auth_user_id = v_uid and status = 'approved' and company_id = p_company_id and role in ('super_admin', 'admin');
  if m.id is not null and p_kind in ('preview', 'package', 'template', 'hometax') then
    insert into public.tax_export_downloads (company_id, actor_kind, actor_name, month, kind, template_name, row_count, closed)
    values (p_company_id, 'company', m.name, p_month, p_kind, nullif(btrim(coalesce(p_template_name, '')), ''), greatest(coalesce(p_row_count, 0), 0), coalesce(p_closed, false));
    return;
  end if;
  select * into o from public.tax_office_members where auth_user_id = v_uid and status = 'active';
  if o.id is not null and exists (select 1 from private.tax_office_company_ids() c where c = p_company_id) and p_kind in ('office_xlsx', 'office_zip', 'template', 'hometax') then
    select name into v_office from public.tax_offices where id = o.office_id;
    insert into public.tax_export_downloads (company_id, actor_kind, actor_name, office_name, month, kind, template_name, row_count, closed)
    values (p_company_id, 'tax_office', o.name, v_office, p_month, p_kind, nullif(btrim(coalesce(p_template_name, '')), ''), greatest(coalesce(p_row_count, 0), 0), coalesce(p_closed, false));
    return;
  end if;
  raise exception 'NOT_FOUND';
end;
$$;
