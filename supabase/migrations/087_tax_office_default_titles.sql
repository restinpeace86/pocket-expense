-- =============================================================================
-- 087_tax_office_default_titles.sql — 세무사무소 기본 계정과목 + 고객사 일괄 적용 (D-160, 개선사항 3)
-- 사용자 결정(2026-10-29): 사무소 기본값 + [일괄 적용] 버튼. 복잡하지 않게 —
-- - 기본값은 새로 편집하지 않고 "이 고객사 설정을 사무소 기본값으로 저장"(계정과목·코드·분류 연결을 그대로 복사)
-- - [고객사에 적용]: 고른 고객사에 같은 이름의 계정과목은 코드·순서를 맞추고 없는 것은 추가, 분류 연결은 기본값대로. 회사에만 있는 계정과목은 지우지 않는다
-- - 바뀐 내용은 회사 계정과목 변경 이력(079 트리거)에 사무소 이름으로 남고 회사 홈 알림으로 보인다
-- - 쓰기는 사무소 관리자만, 대상은 그 사무소가 볼 수 있는 고객사만
-- =============================================================================

alter table public.tax_offices
  add column default_titles jsonb check (default_titles is null or jsonb_typeof(default_titles) = 'array'),
  add column default_mappings jsonb check (default_mappings is null or jsonb_typeof(default_mappings) = 'array'),
  add column default_source_name text,
  add column default_saved_at timestamptz;

-- 이 고객사의 계정과목·분류 연결을 사무소 기본값으로 저장
create or replace function public.save_tax_office_default_titles(p_company_id uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v public.tax_office_members := private.require_tax_office_admin();
begin
  perform private.require_tax_office_company(p_company_id);
  update public.tax_offices o set
    default_titles = (select coalesce(jsonb_agg(jsonb_build_object('name', t.name, 'code', t.code, 'sort_order', t.sort_order) order by t.sort_order, t.name), '[]'::jsonb)
                        from public.account_titles t where t.company_id = p_company_id),
    default_mappings = (select coalesce(jsonb_agg(jsonb_build_object('category', m.category, 'trip_type', m.trip_type, 'purchase_type', m.purchase_type,
                                                                     'condolence_target', m.condolence_target, 'title_name', t.name)), '[]'::jsonb)
                          from public.account_title_mappings m join public.account_titles t on t.id = m.account_title_id
                         where m.company_id = p_company_id),
    default_source_name = (select name from public.companies where id = p_company_id),
    default_saved_at = now()
  where o.id = v.office_id;
end;
$$;

-- 기본값 보기(사무소 구성원)
create or replace function public.tax_office_default_titles()
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v public.tax_office_members := private.my_tax_office_member();
  o public.tax_offices;
begin
  if v.id is null then raise exception 'NOT_A_TAX_OFFICE_MEMBER' using errcode = '42501'; end if;
  select * into o from public.tax_offices where id = v.office_id;
  if o.default_titles is null then return null; end if;
  return jsonb_build_object('titles', o.default_titles, 'mapping_count', jsonb_array_length(o.default_mappings),
                            'source_name', o.default_source_name, 'saved_at', o.default_saved_at);
end;
$$;

-- 고른 고객사에 기본값 적용. 돌려주는 값: 적용한 회사 수, 바뀐 줄 수
create or replace function public.apply_tax_office_default_titles(p_company_ids uuid[])
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v public.tax_office_members := private.require_tax_office_admin();
  o public.tax_offices;
  c uuid;
  t jsonb;
  m jsonb;
  v_title uuid;
  v_n integer;
  v_changes integer := 0;
  v_companies integer := 0;
begin
  select * into o from public.tax_offices where id = v.office_id;
  if o.default_titles is null then raise exception 'NO_DEFAULT_TITLES'; end if;
  for c in select distinct x from unnest(coalesce(p_company_ids, '{}')) x where x in (select private.tax_office_company_ids()) loop
    v_companies := v_companies + 1;
    for t in select * from jsonb_array_elements(o.default_titles) loop
      insert into public.account_titles (company_id, name, code, sort_order)
      values (c, t->>'name', nullif(t->>'code', ''), coalesce((t->>'sort_order')::integer, 0))
      on conflict (company_id, name) do update set code = excluded.code, sort_order = excluded.sort_order, updated_at = now()
        where public.account_titles.code is distinct from excluded.code or public.account_titles.sort_order is distinct from excluded.sort_order;
      get diagnostics v_n = row_count;
      v_changes := v_changes + v_n;
    end loop;
    for m in select * from jsonb_array_elements(o.default_mappings) loop
      select id into v_title from public.account_titles where company_id = c and name = m->>'title_name';
      continue when v_title is null;
      insert into public.account_title_mappings (company_id, category, trip_type, purchase_type, condolence_target, account_title_id)
      values (c, (m->>'category')::public.expense_category, (m->>'trip_type')::public.trip_type, (m->>'purchase_type')::public.purchase_type, m->>'condolence_target', v_title)
      on conflict on constraint account_title_mappings_unique_classification do update set account_title_id = excluded.account_title_id, updated_at = now()
        where public.account_title_mappings.account_title_id is distinct from excluded.account_title_id;
      get diagnostics v_n = row_count;
      v_changes := v_changes + v_n;
    end loop;
  end loop;
  return jsonb_build_object('companies', v_companies, 'changes', v_changes);
end;
$$;

revoke all on function public.save_tax_office_default_titles(uuid), public.tax_office_default_titles(), public.apply_tax_office_default_titles(uuid[]) from public, anon;
grant execute on function public.save_tax_office_default_titles(uuid), public.tax_office_default_titles(), public.apply_tax_office_default_titles(uuid[]) to authenticated;
