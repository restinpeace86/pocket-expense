-- =============================================================================
-- 100_closing_card_reconcile.sql — 월말 마감 알림에 법인카드 내역 대조 권유 (D-190)
-- 사용자 지시(2026-11-01): 대조는 필수는 아니지만 월말마다 반강제로 하게 — 세무사와 크로스체크가 되도록.
-- 법인카드를 등록해 둔 회사(사용 중 카드 1장 이상)만: has_cards, card_missing(그 달 대조 결과 저장 없음).
-- 3일(hometax_missing): 홈택스 자료 없음·승인 대기 외에 대조 안 함도 대상. 5일(close_due): 그대로(마감 안 했으면 이미 대상) — 문구에 대조 권유를 더한다.
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
             where e.company_id = c.id and e.status = 'submitted' and i.expense_date < t.first_day) as pending,
           exists (select 1 from public.corporate_cards cc where cc.company_id = c.id and cc.is_active) as has_cards
      from today t cross join public.companies c
  ), co2 as (
    select co.*, co.has_cards and not exists (select 1 from public.card_reconciliations r where r.company_id = co.company_id and r.month = co.month) as card_missing
      from co
  )
  select coalesce(jsonb_agg(jsonb_build_object('company_id', m.company_id, 'member_id', m.id, 'kind', co2.kind, 'month', co2.month, 'cutoff', co2.cutoff, 'due', co2.d5,
                                               'pending', co2.pending, 'hometax_missing', co2.hometax_missing, 'closed', co2.closed,
                                               'has_cards', co2.has_cards, 'card_missing', co2.card_missing)), '[]'::jsonb)
    from co2
    join public.members m on m.company_id = co2.company_id and m.status = 'approved' and m.role in ('super_admin', 'admin')
   where co2.kind = 'week_start'
      or (co2.kind = 'hometax_missing' and (co2.hometax_missing or co2.pending > 0 or (co2.card_missing and not co2.closed)))
      or (co2.kind = 'close_due' and (not co2.closed or co2.pending > 0));
$$;
revoke all on function public.closing_admin_targets(date) from public, anon, authenticated;
grant execute on function public.closing_admin_targets(date) to service_role;
