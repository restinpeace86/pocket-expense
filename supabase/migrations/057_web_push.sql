-- =============================================================================
-- 057_web_push.sql — 무료 웹푸시: 마감 D-Day 리마인더 · 결재 대기 독촉 · 공지 2채널 (D-116)
-- - push_subscriptions: 기기(브라우저)별 푸시 주소. 본인 것만 보고 등록·삭제(RLS). 보내기는 서버(service role).
-- - announcements: 공지. scope = platform(앱 운영자 → 전체 사용자) / company(그 회사 관리자 → 그 회사 직원만, 회사 격리).
--   company 공지는 같은 회사 멤버만 읽고 관리자만 쓴다. platform 공지는 로그인한 모두가 읽고, 쓰기는 서버(앱 운영자 확인 뒤)만.
-- - push_logs: 같은 날 같은 알림을 두 번 보내지 않게(리마인더). 서버 전용.
-- - 대상 계산 함수(서버 전용): push_deadline_targets(오늘), push_approval_targets(지금)
-- =============================================================================

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  member_id uuid not null,
  endpoint text not null unique check (endpoint ~ '^https://' and char_length(endpoint) <= 1000),
  p256dh text not null check (char_length(p256dh) between 20 and 200),
  auth text not null check (char_length(auth) between 10 and 100),
  user_agent text check (char_length(user_agent) <= 300),
  created_at timestamptz not null default now(),
  last_sent_at timestamptz,
  foreign key (member_id, company_id) references public.members (id, company_id) on delete cascade
);
create index push_subscriptions_member_idx on public.push_subscriptions (member_id);
create index push_subscriptions_company_idx on public.push_subscriptions (company_id);
alter table public.push_subscriptions enable row level security;
alter table public.push_subscriptions force row level security;
grant select, insert, delete on public.push_subscriptions to authenticated;
create policy push_subscriptions_select on public.push_subscriptions for select to authenticated
  using (member_id = (select private.current_member_id()) and company_id = (select private.current_company_id()));
create policy push_subscriptions_insert on public.push_subscriptions for insert to authenticated
  with check (member_id = (select private.current_member_id()) and company_id = (select private.current_company_id()));
create policy push_subscriptions_delete on public.push_subscriptions for delete to authenticated
  using (member_id = (select private.current_member_id()));

create type public.announcement_scope as enum ('platform', 'company');
create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  scope public.announcement_scope not null,
  company_id uuid references public.companies (id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 80),
  body text not null check (length(btrim(body)) between 1 and 1000),
  created_by_member_id uuid,
  pushed_count integer not null default 0,
  created_at timestamptz not null default now(),
  check ((scope = 'platform') = (company_id is null)),
  foreign key (created_by_member_id, company_id) references public.members (id, company_id) on delete set null (created_by_member_id)
);
create index announcements_company_idx on public.announcements (company_id, created_at desc);
create index announcements_platform_idx on public.announcements (created_at desc) where scope = 'platform';
alter table public.announcements enable row level security;
alter table public.announcements force row level security;
grant select, insert on public.announcements to authenticated;
create policy announcements_select on public.announcements for select to authenticated
  using (scope = 'platform' or company_id = (select private.current_company_id()));
-- 사내 공지: 그 회사 관리자만, 작성자는 본인
create policy announcements_insert on public.announcements for insert to authenticated
  with check (scope = 'company' and company_id = (select private.current_company_id()) and (select private.is_admin())
              and created_by_member_id = (select private.current_member_id()));

create table public.push_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies (id) on delete cascade,
  member_id uuid,
  kind text not null check (kind in ('deadline', 'approval_pending', 'announcement')),
  ref text not null default '',
  sent_on date not null default ((now() at time zone 'Asia/Seoul')::date),
  devices integer not null default 0,
  created_at timestamptz not null default now(),
  unique (member_id, kind, ref, sent_on)
);
alter table public.push_logs enable row level security;
alter table public.push_logs force row level security; -- 정책 없음 = 서버(service role)만

-- ── 마감 D-Day: 회사 청구 기한(D-031)이 "월 단위"인 회사(말일 / 다음 달 N일)만. 마감 3일 전·당일
--    대상: 작성 중·반려 결의서(영수증 1장 이상)가 있는 활성 직원
create or replace function public.push_deadline_targets(p_today date default ((now() at time zone 'Asia/Seoul')::date))
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  with co as (
    select c.id, c.name,
           case c.claim_deadline_type
             when 'end_of_month' then (date_trunc('month', p_today) + interval '1 month - 1 day')::date
             when 'next_month_day' then date_trunc('month', p_today)::date + (least(greatest(coalesce(c.claim_deadline_days, 5), 1), 28) - 1)
           end as deadline
      from public.companies c
     where c.claim_deadline_type in ('end_of_month', 'next_month_day')
  ), open_claims as (
    select e.company_id, e.member_id, count(*) as n
      from public.expense_claims e
     where e.status in ('draft', 'rejected') and e.item_count > 0
     group by e.company_id, e.member_id
  )
  select coalesce(jsonb_agg(jsonb_build_object('company_id', co.id, 'member_id', o.member_id, 'deadline', co.deadline, 'days_left', co.deadline - p_today, 'open_claims', o.n)), '[]'::jsonb)
    from co
    join open_claims o on o.company_id = co.id
    join public.members m on m.id = o.member_id and m.company_id = co.id and m.status = 'approved'
   where co.deadline - p_today in (3, 0);
$$;

-- ── 결재 대기 독촉: 상신 뒤 24시간 넘게 처리 안 된 단계. 검토 단계는 지정 검토자, 최종 단계는 청구자 외 관리자 이상
create or replace function public.push_approval_targets(p_now timestamptz default now(), p_hours integer default 24)
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  with waiting as (
    select a.company_id, a.claim_id, a.step_kind, a.approver_member_id, e.member_id as claimant
      from public.claim_approvals a
      join public.expense_claims e on e.id = a.claim_id and a.round = e.current_round
     where a.status = 'pending' and e.status = 'submitted' and e.submitted_at <= p_now - make_interval(hours => p_hours)
  ), who as (
    select w.company_id, w.approver_member_id as member_id, w.claim_id from waiting w where w.step_kind = 'review'
    union
    select w.company_id, m.id, w.claim_id
      from waiting w join public.members m on m.company_id = w.company_id and m.status = 'approved' and m.role in ('admin', 'super_admin') and m.id <> w.claimant
     where w.step_kind = 'final'
  )
  select coalesce(jsonb_agg(jsonb_build_object('company_id', company_id, 'member_id', member_id, 'pending', n)), '[]'::jsonb)
    from (select company_id, member_id, count(distinct claim_id) as n from who group by company_id, member_id) t;
$$;

revoke all on function public.push_deadline_targets(date), public.push_approval_targets(timestamptz, integer) from public, anon, authenticated;
grant execute on function public.push_deadline_targets(date), public.push_approval_targets(timestamptz, integer) to service_role;
