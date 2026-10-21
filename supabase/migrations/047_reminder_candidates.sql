-- =============================================================================
-- 047_reminder_candidates.sql — 미제출자 독촉 대상 (T3-8, D-043, D-094)
-- reminder_candidates(): 관리자만, 자기 회사만. 활성 멤버 중 아직 상신하지 않은 결의서(작성중·반려, 영수증 1장 이상)가 있는 사람과
--   그 건수, 휴대폰 번호 유무, 오늘(한국 날짜) 이미 독촉 알림을 받았는지(실패 건 제외 — 하루 1회).
-- 서버는 이 목록에 있는 사람에게만, 오늘 받지 않은 사람에게만 보낸다.
-- =============================================================================

create or replace function public.reminder_candidates()
returns table (member_id uuid, name text, department text, has_phone boolean, open_claims integer, reminded_today boolean)
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_admin public.members := private.require_admin();
  v_today_start timestamptz := ((now() at time zone 'Asia/Seoul')::date)::timestamp at time zone 'Asia/Seoul';
begin
  return query
  select m.id, m.name, d.name,
         coalesce(length(regexp_replace(coalesce(m.phone, ''), '[^0-9]', '', 'g')) >= 10, false),
         count(distinct c.id)::integer,
         exists (select 1 from public.notification_logs l
                  where l.company_id = v_admin.company_id and l.recipient_member_id = m.id and l.template_code = 'REMINDER'
                    and l.status <> 'failed' and l.created_at >= v_today_start)
    from public.members m
    join public.expense_claims c on c.member_id = m.id and c.company_id = v_admin.company_id and c.status in ('draft', 'rejected')
    left join public.departments d on d.id = m.department_id
   where m.company_id = v_admin.company_id and m.status = 'approved'
     and exists (select 1 from public.expense_items i where i.claim_id = c.id)
   group by m.id, m.name, d.name, m.phone
   order by count(distinct c.id) desc, m.name;
end;
$$;

revoke all on function public.reminder_candidates() from public, anon;
grant execute on function public.reminder_candidates() to authenticated;
