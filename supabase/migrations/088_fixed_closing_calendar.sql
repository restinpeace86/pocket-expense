-- =============================================================================
-- 088_fixed_closing_calendar.sql — 고정 마감 일정 + 영업일 + 늦은 청구는 다음 달 정산 (D-161, 개선사항 1)
-- 사용자 결정(2026-10-29):
-- - 직원 청구 마감 = 매월 2일(전월 사용분), 세무 마감 = 매월 5일. 회사별로 바꾸지 않는다(D-031·D-064의 회사별 기한 대체)
-- - 마감일·알림일이 쉬는 날(주말 + 공휴일)이면 앞 영업일로 당긴다. 공휴일은 kr_holidays 표(운영자가 해마다 확인·추가)
-- - 청구 마감이 지난 뒤 상신한 전월 영수증도 상신은 된다 — 대신 정산(세무 마감) 달이 상신한 달로 넘어간다("전월 추가분")
-- - 관리자 알림: 1일 마감 주간 시작(전체 관리자) / 3일 홈택스 자료 안 올린 회사 / 5일 세무 마감 안 한 회사
-- =============================================================================

create table public.kr_holidays (
  day date primary key,
  name text not null check (char_length(name) between 1 and 40),
  created_at timestamptz not null default now()
);
alter table public.kr_holidays enable row level security;
alter table public.kr_holidays force row level security;
revoke all on public.kr_holidays from anon, authenticated;
grant select on public.kr_holidays to authenticated;
create policy kr_holidays_select on public.kr_holidays for select to authenticated using (true);

-- 2026·2027 관공서 공휴일(대체공휴일·선거일 포함). 운영자 화면에서 확인·추가한다
insert into public.kr_holidays (day, name) values
  ('2026-01-01', '신정'), ('2026-02-16', '설날 연휴'), ('2026-02-17', '설날'), ('2026-02-18', '설날 연휴'),
  ('2026-03-02', '삼일절 대체공휴일'), ('2026-05-05', '어린이날'), ('2026-05-25', '부처님오신날 대체공휴일'),
  ('2026-06-03', '전국동시지방선거'), ('2026-08-17', '광복절 대체공휴일'),
  ('2026-09-24', '추석 연휴'), ('2026-09-25', '추석'), ('2026-09-26', '추석 연휴'), ('2026-09-28', '추석 대체공휴일'),
  ('2026-10-05', '개천절 대체공휴일'), ('2026-10-09', '한글날'), ('2026-12-25', '성탄절'),
  ('2027-01-01', '신정'), ('2027-02-06', '설날 연휴'), ('2027-02-07', '설날'), ('2027-02-08', '설날 연휴'), ('2027-02-09', '설날 대체공휴일'),
  ('2027-03-01', '삼일절'), ('2027-05-05', '어린이날'), ('2027-05-13', '부처님오신날'), ('2027-08-16', '광복절 대체공휴일'),
  ('2027-09-14', '추석 연휴'), ('2027-09-15', '추석'), ('2027-09-16', '추석 연휴'),
  ('2027-10-04', '개천절 대체공휴일'), ('2027-10-11', '한글날 대체공휴일'), ('2027-12-27', '성탄절 대체공휴일')
on conflict (day) do nothing;

-- 그날이 쉬는 날이면 앞 영업일
create or replace function private.prev_working_day(p_day date)
returns date
language plpgsql stable security definer
set search_path = ''
as $$
declare d date := p_day;
begin
  while extract(isodow from d) in (6, 7) or exists (select 1 from public.kr_holidays where day = d) loop
    d := d - 1;
  end loop;
  return d;
end;
$$;

-- 사용한 달(YYYY-MM) → 직원 청구 마감일(다음 달 2일, 쉬는 날이면 앞 영업일)
create or replace function private.claim_cutoff(p_month text)
returns date
language sql stable security definer
set search_path = ''
as $$
  select private.prev_working_day(((p_month || '-01')::date + interval '1 month')::date + 1);
$$;

-- 그 달의 세무 마감일(다음 달 5일, 쉬는 날이면 앞 영업일)
create or replace function private.tax_close_due(p_month text)
returns date
language sql stable security definer
set search_path = ''
as $$
  select private.prev_working_day(((p_month || '-01')::date + interval '1 month')::date + 4);
$$;

-- 정산 달: 청구 마감(상신일 한국 날짜 기준) 안이면 사용한 달, 지나서 상신했으면 상신한 달
create or replace function private.settlement_month(p_expense_date date, p_submitted_at timestamptz)
returns text
language sql stable security definer
set search_path = ''
as $$
  select case
    when p_expense_date is null then null
    when p_submitted_at is null or (p_submitted_at at time zone 'Asia/Seoul')::date <= private.claim_cutoff(to_char(p_expense_date, 'YYYY-MM'))
      then to_char(p_expense_date, 'YYYY-MM')
    else greatest(to_char(p_expense_date, 'YYYY-MM'), to_char(p_submitted_at at time zone 'Asia/Seoul', 'YYYY-MM'))
  end;
$$;
revoke all on function private.prev_working_day(date), private.claim_cutoff(text), private.tax_close_due(text), private.settlement_month(date, timestamptz) from public, anon, authenticated;

-- 기존 청구 기한 함수는 고정 규칙으로(회사 설정 칸은 남기되 쓰지 않음) — 관리자 홈 "늦은 청구" 건수가 이걸 쓴다
create or replace function private.claim_deadline_date(p_date date, p_type public.claim_deadline_type, p_days integer)
returns date
language sql stable
set search_path = ''
as $$
  select case when p_date is null then null else private.claim_cutoff(to_char(p_date, 'YYYY-MM')) end;
$$;
revoke all on function private.claim_deadline_date(date, public.claim_deadline_type, integer) from public, anon, authenticated;
update public.companies set claim_deadline_type = 'next_month_day', claim_deadline_days = 2;
alter table public.companies alter column claim_deadline_days set default 2;

-- 세무 마감 대상: 늦게 상신한 전월 영수증은 상신한 달의 "전월 추가분"으로
create or replace function private.tax_month_pending_items(p_company_id uuid, p_month text)
returns table (item_id uuid, kind text, seq integer)
language sql stable security definer
set search_path = ''
as $$
  with base as (
    select i.id, i.expense_date, i.sort_order, c.id as claim_id, m.name as member_name,
           to_char(i.expense_date, 'YYYY-MM') as em,
           private.settlement_month(i.expense_date, c.submitted_at) as sm
      from public.expense_items i
      join public.expense_claims c on c.id = i.claim_id
      join public.members m on m.id = c.member_id
     where i.company_id = p_company_id
       and c.company_id = p_company_id
       and c.status in ('approved', 'paid')
       and i.closed_month is null
       and i.expense_date is not null
       and to_char(i.expense_date, 'YYYY-MM') <= p_month
  )
  select b.id,
         case when b.em = p_month then 'current' else 'carryover' end,
         (row_number() over (order by case when b.em = p_month then 0 else 1 end, b.expense_date, b.member_name, b.claim_id, b.sort_order))::integer
    from base b
   where (b.em = p_month and b.sm = b.em)
      or (b.em < p_month and b.sm <= p_month
          and (b.sm > b.em
               or exists (select 1 from public.monthly_closings mc
                           where mc.company_id = p_company_id and mc.year_month = b.em and mc.status = 'closed')));
$$;
revoke all on function private.tax_month_pending_items(uuid, text) from public, anon, authenticated;

-- 웹푸시 직원 마감 D-3·당일: 다가오는 청구 마감(이번 달 2일 또는 다음 달 2일, 영업일로 당김)
create or replace function public.push_deadline_targets(p_today date default ((now() at time zone 'Asia/Seoul')::date))
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  with dl as (
    select x.deadline from (values (private.claim_cutoff(to_char(p_today - interval '1 month', 'YYYY-MM'))),
                                   (private.claim_cutoff(to_char(p_today, 'YYYY-MM')))) x(deadline)
     where x.deadline - p_today in (3, 0)
  ), open_claims as (
    select e.company_id, e.member_id, count(*) as n
      from public.expense_claims e
     where e.status in ('draft', 'rejected') and e.item_count > 0
     group by e.company_id, e.member_id
  )
  select coalesce(jsonb_agg(jsonb_build_object('company_id', o.company_id, 'member_id', o.member_id, 'deadline', dl.deadline, 'days_left', dl.deadline - p_today, 'open_claims', o.n)), '[]'::jsonb)
    from dl
    cross join open_claims o
    join public.members m on m.id = o.member_id and m.company_id = o.company_id and m.status = 'approved';
$$;
revoke all on function public.push_deadline_targets(date) from public, anon, authenticated;
grant execute on function public.push_deadline_targets(date) to service_role;

-- 관리자 마감 알림 대상(cron, service role). 같은 날 여러 단계가 겹치면 뒤 단계 하나만
-- kind: week_start(1일, 전체 관리자) / hometax_missing(3일, 그 달 홈택스 자료 0개) / close_due(5일, 그 달 세무 마감 안 함)
create or replace function public.closing_admin_targets(p_today date default ((now() at time zone 'Asia/Seoul')::date))
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  with n as (
    select date_trunc('month', p_today)::date as first_day union all select (date_trunc('month', p_today) + interval '1 month')::date
  ), sched as (
    select to_char(n.first_day - interval '1 month', 'YYYY-MM') as month,
           private.prev_working_day(n.first_day) as d1,
           private.prev_working_day(n.first_day + 2) as d3,
           private.prev_working_day(n.first_day + 4) as d5,
           private.prev_working_day(n.first_day + 1) as cutoff
      from n
  ), today as (
    select s.month, s.cutoff, s.d5,
           case when s.d5 = p_today then 'close_due' when s.d3 = p_today then 'hometax_missing' when s.d1 = p_today then 'week_start' end as kind
      from sched s
     where p_today in (s.d1, s.d3, s.d5)
  )
  select coalesce(jsonb_agg(jsonb_build_object('company_id', m.company_id, 'member_id', m.id, 'kind', t.kind, 'month', t.month, 'cutoff', t.cutoff, 'due', t.d5)), '[]'::jsonb)
    from today t
    join public.members m on m.status = 'approved' and m.role in ('super_admin', 'admin')
   where t.kind = 'week_start'
      or (t.kind = 'hometax_missing' and not exists (select 1 from public.hometax_uploads h where h.company_id = m.company_id and h.month = t.month))
      or (t.kind = 'close_due' and not exists (select 1 from public.monthly_closings mc where mc.company_id = m.company_id and mc.year_month = t.month and mc.status = 'closed'));
$$;
revoke all on function public.closing_admin_targets(date) from public, anon, authenticated;
grant execute on function public.closing_admin_targets(date) to service_role;

-- 화면용: 그 달의 청구 마감일·세무 마감일
create or replace function public.closing_calendar(p_month text)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if p_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then raise exception 'INVALID_MONTH'; end if;
  return jsonb_build_object('month', p_month, 'claim_cutoff', private.claim_cutoff(p_month), 'tax_due', private.tax_close_due(p_month));
end;
$$;
revoke all on function public.closing_calendar(text) from public, anon;
grant execute on function public.closing_calendar(text) to authenticated;

-- 알림 기록 종류 추가
alter table public.push_logs drop constraint push_logs_kind_check;
alter table public.push_logs add constraint push_logs_kind_check check (kind in ('deadline', 'approval_pending', 'announcement', 'closing'));
alter table public.notification_logs drop constraint notification_logs_template_code_check;
alter table public.notification_logs add constraint notification_logs_template_code_check
  check (template_code in ('APPROVAL_REQUEST', 'APPROVAL_COMPLETED', 'APPROVAL_REJECTED', 'PAYOUT_COMPLETED', 'INVITE', 'REMINDER', 'RECURRING_READY', 'CLOSING'));
