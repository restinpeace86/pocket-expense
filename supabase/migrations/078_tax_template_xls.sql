-- =============================================================================
-- 078_tax_template_xls.sql — 결산 양식 .xls(Excel 97-2003) 지원 (D-150 보완)
-- 내려받기용 양식에 원래 파일 이름을 함께 돌려준다: 원본이 .xls면 받는 파일도 .xls로 만든다(보관은 .xlsx로 바꿔서)
-- =============================================================================
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
  return jsonb_build_object('id', t.id, 'name', t.name, 'target', t.target, 'file_path', t.file_path, 'file_name', t.file_name, 'sheet_name', t.sheet_name,
    'header_row', t.header_row, 'columns', t.columns, 'office_name', (select name from public.tax_offices where id = t.office_id));
end;
$$;
