-- =============================================================================
-- 081_tax_export_downloads.sql — 세무 자료 내려받기 기록 (D-153)
-- 회사 관리자·세무사무소가 세무 자료(장부 엑셀·ZIP·결산 양식)를 받을 때마다 누가·언제·어느 달·몇 건을 남긴다.
-- 기록은 서버가 내려보내는 시점에 함수로만 쓰고(받을 권한이 있는 사람만), 회사 관리자가 세무 마감 화면에서 본다.
-- =============================================================================

create table public.tax_export_downloads (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  actor_kind text not null check (actor_kind in ('company', 'tax_office')),
  actor_name text,
  office_name text,
  month text not null check (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  kind text not null check (kind in ('preview', 'package', 'office_xlsx', 'office_zip', 'template')),
  template_name text check (template_name is null or char_length(template_name) <= 50),
  row_count integer not null default 0 check (row_count >= 0),
  closed boolean not null default false,
  created_at timestamptz not null default now()
);
create index tax_export_downloads_company_idx on public.tax_export_downloads (company_id, created_at desc);

alter table public.tax_export_downloads enable row level security;
alter table public.tax_export_downloads force row level security;
revoke all on public.tax_export_downloads from anon, authenticated;
grant select on public.tax_export_downloads to authenticated;
create policy tax_export_downloads_select on public.tax_export_downloads for select to authenticated
  using (company_id = (select private.current_company_id()) and (select private.is_admin()));

-- 기록 남기기: 그 회사 관리자이거나, 그 회사를 볼 수 있는 세무사무소 구성원만
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
  if m.id is not null and p_kind in ('preview', 'package', 'template') then
    insert into public.tax_export_downloads (company_id, actor_kind, actor_name, month, kind, template_name, row_count, closed)
    values (p_company_id, 'company', m.name, p_month, p_kind, nullif(btrim(coalesce(p_template_name, '')), ''), greatest(coalesce(p_row_count, 0), 0), coalesce(p_closed, false));
    return;
  end if;
  select * into o from public.tax_office_members where auth_user_id = v_uid and status = 'active';
  if o.id is not null and exists (select 1 from private.tax_office_company_ids() c where c = p_company_id) and p_kind in ('office_xlsx', 'office_zip', 'template') then
    select name into v_office from public.tax_offices where id = o.office_id;
    insert into public.tax_export_downloads (company_id, actor_kind, actor_name, office_name, month, kind, template_name, row_count, closed)
    values (p_company_id, 'tax_office', o.name, v_office, p_month, p_kind, nullif(btrim(coalesce(p_template_name, '')), ''), greatest(coalesce(p_row_count, 0), 0), coalesce(p_closed, false));
    return;
  end if;
  raise exception 'NOT_FOUND';
end;
$$;
revoke all on function public.log_tax_export(uuid, text, text, integer, text, boolean) from public, anon;
grant execute on function public.log_tax_export(uuid, text, text, integer, text, boolean) to authenticated;
