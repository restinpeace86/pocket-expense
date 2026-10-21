-- =============================================================================
-- 043_tax_closing.sql — 세무 마감 잠금·해제 + 증빙 순번 고정 (T10, D-045, D-052, tax-closing.md §4)
-- - 마감 대상(마감 대기 월 M): 승인·지급완료 결의서의 아직 마감 안 된 항목 중
--     (a) 사용일자가 M인 항목(당월) + (b) 사용일자가 M보다 앞이고 그 달이 이미 마감 완료인 항목(전월 추가분)
-- - close_tax_month(M): 위 항목에 마감월·증빙 순번(1부터, 사용일자 → 사용자 이름 → 결의서번호 → 항목 순서)·구분을 기록하고 M을 마감 완료로.
--   이미 마감된 달은 그대로 돌려준다(다시 받기 = 같은 항목·같은 순번).
-- - reopen_tax_month(M, 사유): 최고 관리자만. 항목의 마감 기록을 지우고 M을 해제(다음 다운로드 때 다시 집계).
-- - 마감된 항목: 계정과목 조정 불가(035)·결의서 삭제 불가(002/028)는 기존 규칙 그대로.
-- =============================================================================

alter table public.expense_items
  add column closing_seq integer check (closing_seq > 0),
  add column closing_kind text check (closing_kind in ('current', 'carryover')),
  add constraint expense_items_closing_consistent check ((closed_month is null) = (closing_seq is null) and (closed_month is null) = (closing_kind is null));
create unique index expense_items_closing_seq_unique on public.expense_items (company_id, closed_month, closing_seq) where closed_month is not null;

-- 마감 대기 월의 대상 항목(순서 포함). 권한 확인은 부르는 쪽에서
create or replace function private.tax_month_pending_items(p_company_id uuid, p_month text)
returns table (item_id uuid, kind text, seq integer)
language sql stable security definer
set search_path = ''
as $$
  select i.id,
         case when to_char(i.expense_date, 'YYYY-MM') = p_month then 'current' else 'carryover' end,
         (row_number() over (order by case when to_char(i.expense_date, 'YYYY-MM') = p_month then 0 else 1 end,
                                      i.expense_date, m.name, c.id, i.sort_order))::integer
    from public.expense_items i
    join public.expense_claims c on c.id = i.claim_id
    join public.members m on m.id = c.member_id
   where i.company_id = p_company_id
     and c.company_id = p_company_id
     and c.status in ('approved', 'paid')
     and i.closed_month is null
     and i.expense_date is not null
     and (to_char(i.expense_date, 'YYYY-MM') = p_month
          or (to_char(i.expense_date, 'YYYY-MM') < p_month
              and exists (select 1 from public.monthly_closings mc
                           where mc.company_id = p_company_id and mc.year_month = to_char(i.expense_date, 'YYYY-MM') and mc.status = 'closed')));
$$;

create or replace function public.close_tax_month(p_month text)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_admin public.members := private.require_admin();
  v_row public.monthly_closings;
  v_count integer;
begin
  if p_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' or p_month > to_char(now() at time zone 'Asia/Seoul', 'YYYY-MM') then
    raise exception 'INVALID_MONTH';
  end if;
  insert into public.monthly_closings (company_id, year_month, status)
  values (v_admin.company_id, p_month, 'reopened')
  on conflict (company_id, year_month) do nothing;
  select * into v_row from public.monthly_closings where company_id = v_admin.company_id and year_month = p_month for update;
  if v_row.status = 'closed' then
    select count(*) into v_count from public.expense_items where company_id = v_admin.company_id and closed_month = p_month;
    return jsonb_build_object('status', 'closed', 'closed_at', v_row.closed_at, 'count', v_count, 'already', true);
  end if;

  update public.expense_items i
     set closed_month = p_month, closing_seq = t.seq, closing_kind = t.kind
    from private.tax_month_pending_items(v_admin.company_id, p_month) t
   where i.id = t.item_id;
  get diagnostics v_count = row_count;
  if v_count = 0 then raise exception 'NOTHING_TO_CLOSE'; end if;

  update public.monthly_closings
     set status = 'closed', closed_at = now(), closed_by_member_id = v_admin.id, updated_at = now()
   where id = v_row.id;
  return jsonb_build_object('status', 'closed', 'closed_at', now(), 'count', v_count, 'already', false);
end;
$$;

create or replace function public.reopen_tax_month(p_month text, p_reason text)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_admin public.members := private.require_admin();
  v_reason text := btrim(coalesce(p_reason, ''));
  v_row public.monthly_closings;
begin
  if v_admin.role <> 'super_admin' then raise exception 'NOT_ALLOWED' using errcode = '42501'; end if;
  if length(v_reason) = 0 or length(v_reason) > 200 then raise exception 'INVALID_REOPEN_REASON'; end if;
  select * into v_row from public.monthly_closings where company_id = v_admin.company_id and year_month = p_month for update;
  if not found or v_row.status <> 'closed' then raise exception 'NOT_CLOSED'; end if;
  update public.expense_items set closed_month = null, closing_seq = null, closing_kind = null
   where company_id = v_admin.company_id and closed_month = p_month;
  update public.monthly_closings
     set status = 'reopened', reopened_at = now(), reopened_by_member_id = v_admin.id, reopen_reason = v_reason, updated_at = now()
   where id = v_row.id;
end;
$$;

-- 마감 화면용: 이 달 대상(마감 완료면 마감된 항목, 아니면 대기 대상)의 항목 id·구분·순번
create or replace function public.tax_month_items(p_month text)
returns table (item_id uuid, kind text, seq integer, closed boolean)
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_admin public.members := private.require_admin();
begin
  if p_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then raise exception 'INVALID_MONTH'; end if;
  if exists (select 1 from public.monthly_closings where company_id = v_admin.company_id and year_month = p_month and status = 'closed') then
    return query select i.id, i.closing_kind, i.closing_seq, true from public.expense_items i
                  where i.company_id = v_admin.company_id and i.closed_month = p_month order by i.closing_seq;
  else
    return query select t.item_id, t.kind, t.seq, false from private.tax_month_pending_items(v_admin.company_id, p_month) t order by t.seq;
  end if;
end;
$$;

revoke all on function private.tax_month_pending_items(uuid, text) from public, anon, authenticated;
revoke all on function public.close_tax_month(text), public.reopen_tax_month(text, text), public.tax_month_items(text) from public, anon;
grant execute on function public.close_tax_month(text), public.reopen_tax_month(text, text), public.tax_month_items(text) to authenticated;
