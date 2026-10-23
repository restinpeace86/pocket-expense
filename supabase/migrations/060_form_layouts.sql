-- =============================================================================
-- 060_form_layouts.sql — 지출결의서 양식 고르기·맞춤 양식 저장 (D-118, T5-R)
-- form_templates(001)를 그대로 쓴다: 저장할 때마다 새 버전 + 활성 1개. 되돌리기 = 활성 해제(기본 양식).
-- schema는 출력 문서 모양(src/lib/forms/layout.ts FormLayout). 화면이 다시 검사(normalizeLayout)하므로 여기서는 모양만 본다.
-- =============================================================================

create or replace function public.save_form_template(p_schema jsonb, p_source_file_path text default null, p_ai_extracted jsonb default null)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_admin public.members := private.require_admin();
  v_version integer;
  v_id uuid;
begin
  if p_schema is null or jsonb_typeof(p_schema) <> 'object' or jsonb_typeof(p_schema -> 'columns') is distinct from 'array'
     or jsonb_array_length(p_schema -> 'columns') = 0 or length(p_schema::text) > 20000 then
    raise exception 'INVALID_FORM_LAYOUT';
  end if;
  -- 원본 양식 파일은 자기 회사 폴더만(form-templates 버킷 경로: {company_id}/...)
  if p_source_file_path is not null and split_part(p_source_file_path, '/', 1) <> v_admin.company_id::text then
    raise exception 'INVALID_FORM_SOURCE';
  end if;
  if p_ai_extracted is not null and length(p_ai_extracted::text) > 20000 then
    raise exception 'INVALID_FORM_LAYOUT';
  end if;
  perform pg_advisory_xact_lock(hashtext('form_templates:' || v_admin.company_id::text));
  update public.form_templates set is_active = false, updated_at = now() where company_id = v_admin.company_id and is_active;
  select coalesce(max(version), 0) + 1 into v_version from public.form_templates where company_id = v_admin.company_id;
  insert into public.form_templates (company_id, version, schema, source_file_path, ai_extracted_schema, is_active)
  values (v_admin.company_id, v_version, p_schema, p_source_file_path, p_ai_extracted, true)
  returning id into v_id;
  return v_id;
end;
$$;

-- 기본 양식으로 되돌리기(이전 버전은 지우지 않는다, form-template.md §6)
create or replace function public.clear_form_template()
returns void
language plpgsql security definer
set search_path = ''
as $$
declare v_admin public.members := private.require_admin();
begin
  update public.form_templates set is_active = false, updated_at = now() where company_id = v_admin.company_id and is_active;
end;
$$;

revoke all on function public.save_form_template(jsonb, text, jsonb), public.clear_form_template() from public, anon;
grant execute on function public.save_form_template(jsonb, text, jsonb), public.clear_form_template() to authenticated;
