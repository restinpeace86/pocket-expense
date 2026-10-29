-- =============================================================================
-- 090_closing_pending_approvals.sql — 마감 알림에 승인 대기 독촉 (D-166, D-161 보완)
-- 사용자 지시(2026-10-29): 5일까지 승인 안 된 결의서는 대표·관리자 책임 — 마감일에 빨리 승인하거나 반려하라고 독촉한다.
-- - 3일·5일 관리자 알림 대상: 기존(홈택스 자료 없음 / 세무 마감 안 함) + 지난달까지 쓴 영수증이 든 승인 대기(상신) 결의서가 있는 회사
-- - 돌려주는 값에 pending(그 결의서 수)·hometax_missing·closed를 더해 문구를 상황에 맞게 만든다
-- =============================================================================

create or replace function public.closing_admin_targets(p_today date default ((now() at time zone 'Asia/Seoul')::date))
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  with n as (
    select date_trunc('month', p_today)::date as first_day union all select (date_trunc('month', p_today) + interval '1 month')::date
  ), sched as (
    select to_char(n.first_day - interval '1 month', 'YYYY-MM') as month,
           n.first_day,
           private.prev_working_day(n.first_day) as d1,
           private.prev_working_day(n.first_day + 2) as d3,
           private.prev_working_day(n.first_day + 4) as d5,
           private.prev_working_day(n.first_day + 1) as cutoff
      from n
  ), today as (
    select s.month, s.first_day, s.cutoff, s.d5,
           case when s.d5 = p_today then 'close_due' when s.d3 = p_today then 'hometax_missing' when s.d1 = p_today then 'week_start' end as kind
      from sched s
     where p_today in (s.d1, s.d3, s.d5)
  ), co as (
    select t.*, c.id as company_id,
           not exists (select 1 from public.hometax_uploads h where h.company_id = c.id and h.month = t.month) as hometax_missing,
           exists (select 1 from public.monthly_closings mc where mc.company_id = c.id and mc.year_month = t.month and mc.status = 'closed') as closed,
           (select count(distinct e.id) from public.expense_claims e join public.expense_items i on i.claim_id = e.id
             where e.company_id = c.id and e.status = 'submitted' and i.expense_date < t.first_day) as pending
      from today t cross join public.companies c
  )
  select coalesce(jsonb_agg(jsonb_build_object('company_id', m.company_id, 'member_id', m.id, 'kind', co.kind, 'month', co.month, 'cutoff', co.cutoff, 'due', co.d5,
                                               'pending', co.pending, 'hometax_missing', co.hometax_missing, 'closed', co.closed)), '[]'::jsonb)
    from co
    join public.members m on m.company_id = co.company_id and m.status = 'approved' and m.role in ('super_admin', 'admin')
   where co.kind = 'week_start'
      or (co.kind = 'hometax_missing' and (co.hometax_missing or co.pending > 0))
      or (co.kind = 'close_due' and (not co.closed or co.pending > 0));
$$;
revoke all on function public.closing_admin_targets(date) from public, anon, authenticated;
grant execute on function public.closing_admin_targets(date) to service_role;
