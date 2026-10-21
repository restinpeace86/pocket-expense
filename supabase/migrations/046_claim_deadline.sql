-- =============================================================================
-- 046_claim_deadline.sql — 청구 기한 판정 함수 + 관리자 홈 "기한 초과 상신 결의서" 건수 (T6-8, D-031, D-064)
-- private.claim_deadline_date(결제일, 방식, N): 그날까지 상신하면 되는 날짜(기한 없음이면 null)
--   end_of_month = 결제한 달 말일 / days_after = 결제일 + N일 / next_month_day = 결제한 다음 달 N일(1~28)
--   src/lib/expense/deadline.ts 와 같은 규칙 — 바꾸면 함께 고친다. 상신은 막지 않는다(경고·배지만).
-- =============================================================================

create or replace function private.claim_deadline_date(p_date date, p_type public.claim_deadline_type, p_days integer)
returns date
language sql immutable
set search_path = ''
as $$
  select case
    when p_date is null or p_type = 'none' then null
    when p_type = 'end_of_month' then (date_trunc('month', p_date) + interval '1 month - 1 day')::date
    when p_type = 'days_after' then p_date + coalesce(p_days, 30)
    else (date_trunc('month', p_date) + interval '1 month')::date + (least(greatest(coalesce(p_days, 5), 1), 28) - 1)
  end;
$$;
revoke all on function private.claim_deadline_date(date, public.claim_deadline_type, integer) from public, anon, authenticated;

-- 관리자 홈 (045 정의 + 기한 초과 상신 결의서)
create or replace function public.admin_dashboard(p_month text)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_admin public.members := private.require_admin();
  v_cid uuid := v_admin.company_id;
  v_prev text;
  v_result jsonb;
begin
  if p_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then raise exception 'INVALID_MONTH'; end if;
  v_prev := to_char((p_month || '-01')::date - interval '1 month', 'YYYY-MM');

  with spend as (
    select i.amount, i.category, i.trip_type, to_char(i.expense_date, 'YYYY-MM') as ym, c.member_id
      from public.expense_items i
      join public.expense_claims c on c.id = i.claim_id
     where i.company_id = v_cid and c.company_id = v_cid
       and c.status in ('submitted', 'approved', 'paid')
       and to_char(i.expense_date, 'YYYY-MM') in (p_month, v_prev)
  ), settle as (
    select coalesce(sum(case when i.payment_method = 'personal_card' then coalesce(i.company_supported_amount, 0) else 0 end), 0) as payout,
           coalesce(sum(case when i.payment_method = 'corporate_card' then coalesce(i.personal_burden_amount, 0) else 0 end), 0) as payback,
           count(distinct c.id) as claims
      from public.expense_claims c
      join public.expense_items i on i.claim_id = c.id
     where c.company_id = v_cid and c.status = 'approved'
  )
  select jsonb_build_object(
    'month', p_month,
    'kpi', jsonb_build_object(
      'spend', (select coalesce(sum(amount), 0) from spend where ym = p_month),
      'spend_prev', (select coalesce(sum(amount), 0) from spend where ym = v_prev),
      'pending_claims', (select count(*) from public.expense_claims where company_id = v_cid and status = 'submitted'),
      'pending_oldest_days', (select floor(extract(epoch from now() - min(submitted_at)) / 86400)::int from public.expense_claims where company_id = v_cid and status = 'submitted'),
      'unpaid_payout', (select payout from settle),
      'unpaid_payback', (select payback from settle)
    ),
    'todo', jsonb_build_object(
      'pending_members', (select count(*) from public.members where company_id = v_cid and status = 'pending'),
      'unmapped_items', (select count(*) from public.expense_items i join public.expense_claims c on c.id = i.claim_id
                          where i.company_id = v_cid and c.status in ('submitted', 'approved', 'paid') and i.account_title_name is null),
      'settle_claims', (select claims from settle),
      'failed_notifications', (select count(*) from public.notification_logs where company_id = v_cid and status = 'failed' and created_at > now() - interval '30 days'),
      -- 기한 초과 항목이 있는 상신 결의서(상신일 기준 판정, D-031)
      'overdue_claims', (select count(distinct c.id)
                           from public.expense_claims c
                           join public.expense_items i on i.claim_id = c.id
                           join public.companies co on co.id = c.company_id
                          where c.company_id = v_cid and c.status = 'submitted'
                            and private.claim_deadline_date(i.expense_date, co.claim_deadline_type, co.claim_deadline_days)
                                < (c.submitted_at at time zone 'Asia/Seoul')::date)
    ),
    'checklist', jsonb_build_object(
      'approved_members', (select count(*) from public.members where company_id = v_cid and status = 'approved'),
      'departments', (select count(*) from public.departments where company_id = v_cid),
      'policy_confirmed', (select policy_confirmed_at is not null from public.companies where id = v_cid),
      'review_steps', (select count(*) from public.approval_line_steps where company_id = v_cid)
    ),
    'categories', (select coalesce(jsonb_agg(jsonb_build_object('category', category, 'trip_type', trip_type, 'amount', amount, 'count', n) order by amount desc), '[]'::jsonb)
                     from (select category, case when category = 'trip' then trip_type end as trip_type, sum(coalesce(amount, 0)) as amount, count(*) as n
                             from spend where ym = p_month group by 1, 2) g),
    'top_members', (select coalesce(jsonb_agg(jsonb_build_object('name', m.name, 'department', d.name, 'amount', t.amount, 'count', t.n) order by t.amount desc), '[]'::jsonb)
                      from (select member_id, sum(coalesce(amount, 0)) as amount, count(*) as n from spend where ym = p_month group by member_id order by 2 desc limit 5) t
                      join public.members m on m.id = t.member_id
                      left join public.departments d on d.id = m.department_id)
  ) into v_result;
  return v_result;
end;
$$;

