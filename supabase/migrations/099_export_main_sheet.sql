-- =============================================================================
-- 099_export_main_sheet.sql — 세무용 엑셀의 회계 프로그램 시트 설정 (D-189)
-- 사용자 지시(2026-11-01):
-- ① 고객사마다 "법인카드 내역은 홈택스로 받아 위하고에 넣고 있어요"(기본 켬). 끄면 위하고 일반전표 시트에 법인카드도 두 줄 전표로 넣는다.
--    세무사무소(그 고객사를 볼 수 있는 구성원 — 관리자·배정된 세무사)가 고른다.
-- ② 사무소마다 "고객사 엑셀에 넣을 회계 프로그램 양식": 기본 = 더존 위하고 일반전표, 결산 양식(D-150) 하나를 고르면 그 자리에 그 양식대로 채운 시트.
--    사무소 관리자만 고른다. 양식을 지우면 다시 위하고(on delete set null).
-- ③ 엑셀을 만드는 쪽(회사 관리자 세무 마감·사무소 세무 자료)이 같은 설정을 읽는 함수.
-- =============================================================================

alter table public.company_tax_offices add column card_via_hometax boolean not null default true;
alter table public.tax_offices add column main_template_id uuid references public.tax_office_templates (id) on delete set null;

-- ① 고객사 법인카드 수집 방식
create or replace function public.set_company_card_via_hometax(p_company_id uuid, p_value boolean)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare v public.tax_office_members := private.my_tax_office_member();
begin
  perform private.require_tax_office_company(p_company_id);
  update public.company_tax_offices
     set card_via_hometax = coalesce(p_value, true), updated_at = now()
   where company_id = p_company_id and office_id = v.office_id and released_at is null;
end;
$$;

-- ② 사무소 기본 시트 양식(null = 더존 위하고 일반전표)
create or replace function public.set_tax_office_main_template(p_template_id uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare v public.tax_office_members := private.require_tax_office_admin();
begin
  if p_template_id is not null and not exists (select 1 from public.tax_office_templates t where t.id = p_template_id and t.office_id = v.office_id) then
    raise exception 'NOT_FOUND';
  end if;
  update public.tax_offices set main_template_id = p_template_id where id = v.office_id;
end;
$$;

create or replace function public.tax_office_main_template_id()
returns uuid
language sql stable security definer
set search_path = ''
as $$
  select o.main_template_id from public.tax_offices o where o.id = (private.my_tax_office_member()).office_id
$$;

-- ③ 엑셀 설정 읽기: 그 회사 관리자 또는 그 회사를 볼 수 있는 사무소 구성원만. 사무소 연결이 없으면 기본값(위하고, 법인카드 홈택스 수집)
create or replace function public.tax_export_options(p_company_id uuid)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare r jsonb;
begin
  if (select auth.uid()) is null then raise exception 'NOT_AUTHENTICATED' using errcode = '42501'; end if;
  if not ((private.current_company_id() = p_company_id and private.is_admin())
          or exists (select 1 from private.tax_office_company_ids() c where c = p_company_id)) then
    raise exception 'NOT_FOUND';
  end if;
  select jsonb_build_object(
           'card_via_hometax', c.card_via_hometax,
           'office_name', o.name,
           'main_template', case when t.id is null then null
                                 else jsonb_build_object('id', t.id, 'name', t.name, 'target', t.target, 'columns', t.columns) end)
    into r
    from public.company_tax_offices c
    join public.tax_offices o on o.id = c.office_id
    left join public.tax_office_templates t on t.id = o.main_template_id
   where c.company_id = p_company_id and c.released_at is null;
  return coalesce(r, jsonb_build_object('card_via_hometax', true, 'office_name', null, 'main_template', null));
end;
$$;

revoke all on function public.set_company_card_via_hometax(uuid, boolean), public.set_tax_office_main_template(uuid), public.tax_office_main_template_id(), public.tax_export_options(uuid) from public, anon;
grant execute on function public.set_company_card_via_hometax(uuid, boolean), public.set_tax_office_main_template(uuid), public.tax_office_main_template_id(), public.tax_export_options(uuid) to authenticated;
