-- =============================================================================
-- 101_office_client_status.sql — 세무사무소 고객사 현황에 달별 마감 상태 (D-193)
-- 사용자 지시(2026-11-01): 고객사 목록에 이번 달 마감 상태가 보이게.
-- 볼 수 있는 고객사(관리자 = 전체, 세무사 = 배정된 곳)만: 그 달 회사 세무 마감 여부·시각 + 자료 요청(달 상관없이) 회사 답변 대기·답변 옴 수
-- =============================================================================

create or replace function public.tax_office_client_status(p_month text)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then raise exception 'NOT_AUTHENTICATED' using errcode = '42501'; end if;
  if p_month is null or p_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then raise exception 'INVALID_MONTH'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'company_id', c.id,
             'closed', mc.status is not distinct from 'closed',
             'closed_at', case when mc.status = 'closed' then mc.closed_at end,
             'requests_open', (select count(*) from public.tax_office_requests r where r.company_id = c.id and r.status = 'open'),
             'requests_answered', (select count(*) from public.tax_office_requests r where r.company_id = c.id and r.status = 'answered')))
      from public.companies c
      left join public.monthly_closings mc on mc.company_id = c.id and mc.year_month = p_month
     where c.id in (select private.tax_office_company_ids())
  ), '[]'::jsonb);
end;
$$;
revoke all on function public.tax_office_client_status(text) from public, anon;
grant execute on function public.tax_office_client_status(text) to authenticated;
