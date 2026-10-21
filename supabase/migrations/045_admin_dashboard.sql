-- =============================================================================
-- 045_admin_dashboard.sql — 관리자 홈 대시보드 숫자 (T11-1, admin-dashboard.md ①)
-- admin_dashboard(M): 관리자만, 자기 회사만. 한 번에 돌려준다:
--   kpi: M 지출 합계(사용일자 기준, 상신·승인·지급완료 결의서 — 작성중·반려 제외)와 전월 합계,
--        승인 대기 결의서 수(상신됨, 사전 검토 중 포함)와 가장 오래 기다린 일수, 미지급 사비(승인·정산 대기의 지급액)·미수 납부액
--   todo: 가입 승인 대기 인원, 계정과목 미지정 항목(상신 이후), 정산 대기 결의서 수, 최근 30일 알림 실패 수
--   checklist: 승인된 직원 수, 부서 수, 정산 정책 확인 여부, 사전 검토 결재라인 단계 수
--   categories: M 카테고리·세부 유형별 금액 / top_members: M 직원별 상위 5명
-- =============================================================================

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
      'failed_notifications', (select count(*) from public.notification_logs where company_id = v_cid and status = 'failed' and created_at > now() - interval '30 days')
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

revoke all on function public.admin_dashboard(text) from public, anon;
grant execute on function public.admin_dashboard(text) to authenticated;
