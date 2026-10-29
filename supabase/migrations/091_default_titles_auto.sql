-- =============================================================================
-- 091_default_titles_auto.sql — 사무소 기본 계정과목 모든 고객사 자동 적용 + 개별 설정 예외 (D-167, D-160 변경)
-- 사용자 결정(2026-10-29): 사무소가 기본값을 정하면 모든 고객사(새로 연결되는 고객사 포함)에 자동 적용.
-- 사무소가 특정 고객사의 계정과목·분류 연결을 직접 고치면 그 회사는 "개별 설정" — 이후 기본값 변경에서 빠진다. [기본값으로 되돌리기]로 다시 기본값.
-- - 적용 중에는 세션 표시(pe.default_apply)를 켜서 079 기록 트리거가 "직접 수정"으로 보지 않게 한다
-- - 사무소 구성원이 아닌 사람 때문에 적용될 때(회사가 사무소를 지정·사무소 가입으로 연결)는 요약 이력 1줄을 남긴다
-- =============================================================================

alter table public.company_tax_offices add column custom_titles boolean not null default false;

-- 한 회사에 사무소 기본값 적용(같은 이름은 코드·순서 맞춤, 없으면 추가, 분류 연결은 기본값대로, 회사에만 있는 계정과목은 남김). 바뀐 줄 수
create or replace function private.apply_office_default_titles(p_company uuid, p_office uuid)
returns integer
language plpgsql security definer
set search_path = ''
as $$
declare
  o public.tax_offices;
  t jsonb;
  m jsonb;
  v_title uuid;
  v_n integer;
  v_changes integer := 0;
begin
  select * into o from public.tax_offices where id = p_office;
  if o.id is null or o.default_titles is null then return 0; end if;
  perform set_config('pe.default_apply', '1', true);
  for t in select * from jsonb_array_elements(o.default_titles) loop
    insert into public.account_titles (company_id, name, code, sort_order)
    values (p_company, t->>'name', nullif(t->>'code', ''), coalesce((t->>'sort_order')::integer, 0))
    on conflict (company_id, name) do update set code = excluded.code, sort_order = excluded.sort_order, updated_at = now()
      where public.account_titles.code is distinct from excluded.code or public.account_titles.sort_order is distinct from excluded.sort_order;
    get diagnostics v_n = row_count;
    v_changes := v_changes + v_n;
  end loop;
  for m in select * from jsonb_array_elements(o.default_mappings) loop
    select id into v_title from public.account_titles where company_id = p_company and name = m->>'title_name';
    continue when v_title is null;
    insert into public.account_title_mappings (company_id, category, trip_type, purchase_type, condolence_target, account_title_id)
    values (p_company, (m->>'category')::public.expense_category, (m->>'trip_type')::public.trip_type, (m->>'purchase_type')::public.purchase_type, m->>'condolence_target', v_title)
    on conflict on constraint account_title_mappings_unique_classification do update set account_title_id = excluded.account_title_id, updated_at = now()
      where public.account_title_mappings.account_title_id is distinct from excluded.account_title_id;
    get diagnostics v_n = row_count;
    v_changes := v_changes + v_n;
  end loop;
  perform set_config('pe.default_apply', '', true);
  -- 사무소 구성원이 직접 한 적용이 아니면(연결될 때) 요약 1줄
  if v_changes > 0 and not exists (select 1 from public.tax_office_members where auth_user_id = (select auth.uid()) and office_id = p_office and status = 'active') then
    insert into public.account_title_changes (company_id, entity, action, detail, actor_name, office_name)
    values (p_company, 'title', 'update', jsonb_build_object('summary', '세무사무소 기본 계정과목 적용', 'count', v_changes), null, o.name);
  end if;
  return v_changes;
end;
$$;
revoke all on function private.apply_office_default_titles(uuid, uuid) from public, anon, authenticated;

-- 기록 트리거: 사무소 구성원이 기본값 적용이 아닌 직접 수정을 하면 그 회사는 개별 설정
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
  if coalesce(current_setting('pe.default_apply', true), '') <> '1' then
    update public.company_tax_offices set custom_titles = true where company_id = v_company and office_id = m.office_id and not custom_titles;
  end if;
  return coalesce(new, old);
end;
$$;
revoke all on function private.log_account_title_change() from public, anon, authenticated;

-- 사무소와 새로 연결되면(사무소 지정·사무소 가입) 개별 설정을 풀고 기본값 적용
create or replace function private.company_tax_office_linked()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.office_id is not distinct from old.office_id then return new; end if;
  update public.company_tax_offices set custom_titles = false where company_id = new.company_id and custom_titles;
  if new.office_id is not null and new.released_at is null then
    perform private.apply_office_default_titles(new.company_id, new.office_id);
  end if;
  return new;
end;
$$;
revoke all on function private.company_tax_office_linked() from public, anon, authenticated;
create trigger company_tax_offices_linked after insert or update of office_id on public.company_tax_offices
  for each row execute function private.company_tax_office_linked();

-- 기본값 저장 = 개별 설정이 아닌 모든 고객사에 바로 적용. 돌려주는 값: 적용한 회사 수, 바뀐 줄 수
drop function public.save_tax_office_default_titles(uuid);
create function public.save_tax_office_default_titles(p_company_id uuid)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v public.tax_office_members := private.require_tax_office_admin();
  c uuid;
  v_companies integer := 0;
  v_changes integer := 0;
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
  -- 기준이 된 회사는 기본값과 같으니 개별 설정을 푼다
  update public.company_tax_offices set custom_titles = false where company_id = p_company_id and office_id = v.office_id;
  for c in select company_id from public.company_tax_offices where office_id = v.office_id and released_at is null and not custom_titles and company_id <> p_company_id loop
    v_companies := v_companies + 1;
    v_changes := v_changes + private.apply_office_default_titles(c, v.office_id);
  end loop;
  return jsonb_build_object('companies', v_companies, 'changes', v_changes);
end;
$$;

-- [기본값으로 되돌리기]: 고른 고객사의 개별 설정을 풀고 기본값 적용
create or replace function public.apply_tax_office_default_titles(p_company_ids uuid[])
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v public.tax_office_members := private.require_tax_office_admin();
  c uuid;
  v_companies integer := 0;
  v_changes integer := 0;
begin
  if (select default_titles from public.tax_offices where id = v.office_id) is null then raise exception 'NO_DEFAULT_TITLES'; end if;
  for c in select distinct x from unnest(coalesce(p_company_ids, '{}')) x where x in (select private.tax_office_company_ids()) loop
    update public.company_tax_offices set custom_titles = false where company_id = c and office_id = v.office_id;
    v_companies := v_companies + 1;
    v_changes := v_changes + private.apply_office_default_titles(c, v.office_id);
  end loop;
  return jsonb_build_object('companies', v_companies, 'changes', v_changes);
end;
$$;

-- 기본값 보기 + 개별 설정 고객사
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
  return jsonb_build_object(
    'titles', o.default_titles, 'mapping_count', coalesce(jsonb_array_length(o.default_mappings), 0),
    'source_name', o.default_source_name, 'saved_at', o.default_saved_at,
    'custom_company_ids', (select coalesce(jsonb_agg(c.company_id), '[]'::jsonb) from public.company_tax_offices c
                            where c.office_id = v.office_id and c.custom_titles and c.company_id in (select private.tax_office_company_ids())));
end;
$$;

revoke all on function public.save_tax_office_default_titles(uuid), public.apply_tax_office_default_titles(uuid[]), public.tax_office_default_titles() from public, anon;
grant execute on function public.save_tax_office_default_titles(uuid), public.apply_tax_office_default_titles(uuid[]), public.tax_office_default_titles() to authenticated;
