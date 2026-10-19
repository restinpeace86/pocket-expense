-- =============================================================================
-- 031_app_admin_overview.sql — 운영자 화면 회사 목록 집계 (D-080)
-- service role(운영자 화면 서버 코드)만 부를 수 있다. 고객 역할은 실행 권한 없음.
-- =============================================================================

create or replace function public.app_admin_company_overview(p_month text)
returns table (
  company_id uuid,
  name text,
  business_number text,
  created_at timestamptz,
  billing_status text,
  credits_granted integer,
  credits_used integer,
  members_approved bigint,
  members_pending bigint,
  receipts_total bigint,
  receipts_month bigint,
  receipts_deleted bigint,
  last_receipt_at timestamptz
)
language sql stable security definer
set search_path = ''
as $$
  with m as (
    select (p_month || '-01')::date at time zone 'Asia/Seoul' as s,
           ((p_month || '-01')::date + interval '1 month') at time zone 'Asia/Seoul' as e
  )
  select c.id, c.name, c.business_number, c.created_at, c.billing_status::text, c.receipt_credits_granted, c.receipt_credits_used,
         (select count(*) from public.members x where x.company_id = c.id and x.status = 'approved'),
         (select count(*) from public.members x where x.company_id = c.id and x.status = 'pending'),
         (select count(*) from public.receipt_usage_records r where r.company_id = c.id),
         (select count(*) from public.receipt_usage_records r, m where r.company_id = c.id and r.credited_at >= m.s and r.credited_at < m.e),
         (select count(*) from public.receipt_usage_records r where r.company_id = c.id and r.item_deleted_at is not null),
         (select max(r.credited_at) from public.receipt_usage_records r where r.company_id = c.id)
    from public.companies c
   order by c.created_at desc
$$;

revoke all on function public.app_admin_company_overview(text) from public, anon, authenticated;
grant execute on function public.app_admin_company_overview(text) to service_role;
