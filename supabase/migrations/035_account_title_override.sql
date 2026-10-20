-- =============================================================================
-- 035_account_title_override.sql — 항목별 계정과목 개별 조정 (T11-3, account-titles.md §4, expense-lifecycle.md §7)
-- - 관리자 이상만, 같은 회사 항목만, 세무 마감된 항목은 불가(D-045). 계정과목 외의 값은 바꾸지 않는다.
-- - p_account_title_id = null 이면 조정을 취소하고 매핑 기준 계정과목으로 되돌린다.
-- =============================================================================

create or replace function public.override_item_account_title(p_item_id uuid, p_account_title_id uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_member public.members := private.require_member();
  v_item public.expense_items;
  v_title public.account_titles;
begin
  if v_member.role not in ('super_admin', 'admin') then
    raise exception 'NOT_ALLOWED' using errcode = '42501';
  end if;
  select * into v_item from public.expense_items where id = p_item_id and company_id = v_member.company_id for update;
  if not found then raise exception 'NOT_FOUND' using errcode = '42501'; end if;
  if v_item.closed_month is not null then raise exception 'ITEM_CLOSED'; end if;

  if p_account_title_id is null then
    -- 매핑 기준으로 되돌림 (매핑이 없으면 비움)
    update public.expense_items i
       set (account_title_id, account_title_name, account_title_code) = (
             select t.id, t.name, t.code
               from public.account_title_mappings m
               join public.account_titles t on t.id = m.account_title_id and t.company_id = m.company_id
              where m.company_id = i.company_id and m.category = i.category
                and m.trip_type is not distinct from i.trip_type and m.purchase_type is not distinct from i.purchase_type),
           account_title_overridden = false,
           updated_at = now()
     where i.id = p_item_id;
    return;
  end if;

  select * into v_title from public.account_titles where id = p_account_title_id and company_id = v_member.company_id;
  if not found then raise exception 'NOT_FOUND' using errcode = '42501'; end if;
  update public.expense_items
     set account_title_id = v_title.id, account_title_name = v_title.name, account_title_code = v_title.code,
         account_title_overridden = true, updated_at = now()
   where id = p_item_id;
end;
$$;

revoke all on function public.override_item_account_title(uuid, uuid) from public, anon;
grant execute on function public.override_item_account_title(uuid, uuid) to authenticated;
