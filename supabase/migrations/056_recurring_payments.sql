-- =============================================================================
-- 056_recurring_payments.sql — 정기 결제(SaaS 구독료) (D-110)
-- - 관리자가 한 번 등록: 서비스명·예상 금액·매월/매년·결제일(·결제 월)·결제수단(법인카드)·담당자.
-- - 매일 서버(cron)가 generate_recurring_claims()를 부른다: 결제일이 된(지난) 정기 결제마다 담당자 앞으로
--   내용이 채워진 작성 중 결의서(카테고리 온라인 SaaS 구독료, 영수증 줄 1개)를 만든다. 증빙은 담당자가 붙인다(D-108).
--   같은 기간은 한 번만(고유 키). 등록일 이전 결제일은 만들지 않는다. 담당자가 활성 멤버가 아니면 건너뛴다.
-- - 결제가 실제로 됐는지는 우리 시스템이 모른다(카드사 연동 없음) → "준비"까지만 자동, 상신은 사람이.
-- =============================================================================

create type public.recurring_cycle as enum ('monthly', 'yearly');

create table public.recurring_payments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  service_name text not null check (length(btrim(service_name)) between 1 and 60),
  amount integer not null check (amount between 1 and 100000000),
  cycle public.recurring_cycle not null default 'monthly',
  billing_day smallint not null check (billing_day between 1 and 31),
  billing_month smallint check (billing_month between 1 and 12),
  payment_method public.payment_method not null default 'corporate_card',
  corporate_card_id uuid,
  assignee_member_id uuid not null,
  memo text check (char_length(memo) <= 200),
  starts_on date not null default ((now() at time zone 'Asia/Seoul')::date),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, company_id),
  check ((cycle = 'yearly') = (billing_month is not null)),
  check (payment_method = 'corporate_card' or corporate_card_id is null),
  foreign key (corporate_card_id, company_id) references public.corporate_cards (id, company_id) on delete set null (corporate_card_id),
  foreign key (assignee_member_id, company_id) references public.members (id, company_id)
);
create index recurring_payments_company_idx on public.recurring_payments (company_id);
create trigger set_updated_at before update on public.recurring_payments for each row execute function public.set_updated_at();

alter table public.recurring_payments enable row level security;
alter table public.recurring_payments force row level security;
grant select, insert, update, delete on public.recurring_payments to authenticated;
create policy recurring_payments_select on public.recurring_payments for select to authenticated
  using (company_id = (select private.current_company_id()) and (select private.is_admin()));
create policy recurring_payments_insert on public.recurring_payments for insert to authenticated
  with check (company_id = (select private.current_company_id()) and (select private.is_admin()));
create policy recurring_payments_update on public.recurring_payments for update to authenticated
  using (company_id = (select private.current_company_id()) and (select private.is_admin()))
  with check (company_id = (select private.current_company_id()) and (select private.is_admin()));
create policy recurring_payments_delete on public.recurring_payments for delete to authenticated
  using (company_id = (select private.current_company_id()) and (select private.is_admin()));

-- 결의서 ↔ 정기 결제(어느 기간 것인지). 같은 정기 결제·같은 기간은 결의서 하나
alter table public.expense_claims add column recurring_payment_id uuid, add column recurring_period date;
alter table public.expense_claims
  add constraint expense_claims_recurring_fk foreign key (recurring_payment_id, company_id)
  references public.recurring_payments (id, company_id) on delete set null (recurring_payment_id);
create unique index expense_claims_recurring_period on public.expense_claims (recurring_payment_id, recurring_period) where recurring_payment_id is not null;

-- 알림 종류에 "정기 결제 결의서 준비" 추가
alter table public.notification_logs drop constraint notification_logs_template_code_check;
alter table public.notification_logs add constraint notification_logs_template_code_check
  check (template_code in ('APPROVAL_REQUEST', 'APPROVAL_COMPLETED', 'APPROVAL_REJECTED', 'PAYOUT_COMPLETED', 'INVITE', 'REMINDER', 'RECURRING_READY'));

-- 이번에 만들 기간(결제일). 짧은 달은 말일로. 매월은 이번 달, 매년은 결제 월이 지난 뒤 31일 안에서만(놓친 날 따라잡기)
create or replace function private.recurring_due_period(p_cycle public.recurring_cycle, p_day smallint, p_month smallint, p_starts date, p_today date)
returns date
language plpgsql immutable
set search_path = ''
as $$
declare v_month int; v_last int; v_date date;
begin
  v_month := case when p_cycle = 'monthly' then extract(month from p_today)::int else p_month end;
  v_last := extract(day from (make_date(extract(year from p_today)::int, v_month, 1) + interval '1 month - 1 day'))::int;
  v_date := make_date(extract(year from p_today)::int, v_month, least(p_day, v_last));
  if v_date > p_today or v_date < p_starts then return null; end if;
  if p_cycle = 'yearly' and p_today - v_date > 31 then return null; end if;
  return v_date;
end;
$$;
revoke all on function private.recurring_due_period(public.recurring_cycle, smallint, smallint, date, date) from public, anon, authenticated;

-- 매일 서버가 부른다(service role 전용). 만든 결의서 목록을 돌려준다(알림 보내기용)
create or replace function public.generate_recurring_claims(p_today date default ((now() at time zone 'Asia/Seoul')::date))
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  r record;
  v_period date;
  v_claim uuid;
  v_label text;
  v_out jsonb := '[]'::jsonb;
begin
  for r in
    select p.*, m.status as assignee_status
      from public.recurring_payments p
      join public.members m on m.id = p.assignee_member_id and m.company_id = p.company_id
     where p.is_active
  loop
    v_period := private.recurring_due_period(r.cycle, r.billing_day, r.billing_month, r.starts_on, p_today);
    continue when v_period is null or r.assignee_status <> 'approved';
    continue when exists (select 1 from public.expense_claims where recurring_payment_id = r.id and recurring_period = v_period);
    v_label := case when r.cycle = 'monthly' then to_char(v_period, 'FMYYYY"년" FMMM"월"') else to_char(v_period, 'FMYYYY"년"') end;
    insert into public.expense_claims (company_id, member_id, title, description, category, default_payment_method, recurring_payment_id, recurring_period)
    values (r.company_id, r.assignee_member_id,
            left('[온라인 SaaS 구독료] ' || r.service_name || ' ' || v_label, 100),
            left(r.service_name || ' ' || v_label || ' 정기 결제 구독료', 1000),
            'saas', r.payment_method, r.id, v_period)
    returning id into v_claim;
    insert into public.expense_items (claim_id, company_id, sort_order, category, payment_method, corporate_card_id, evidence_type, expense_date, merchant_name, amount, headcount, parse_status, purpose)
    values (v_claim, r.company_id, 1, 'saas', r.payment_method, case when r.payment_method = 'corporate_card' then r.corporate_card_id end,
            'card_slip', v_period, left(r.service_name, 100), r.amount, 1, 'none', left(r.service_name || ' ' || v_label || ' 구독료', 200));
    perform private.recompute_claim(v_claim);
    v_out := v_out || jsonb_build_object('claim_id', v_claim, 'company_id', r.company_id, 'member_id', r.assignee_member_id,
                                         'service_name', r.service_name, 'period_label', v_label, 'amount', r.amount);
  end loop;
  return v_out;
end;
$$;
revoke all on function public.generate_recurring_claims(date) from public, anon, authenticated;
grant execute on function public.generate_recurring_claims(date) to service_role;
