-- 170: 정기결제(토스페이먼츠 자동결제) — D-298 (사용자 2026-11-20, B-4 보류 해제: 테스트 키로 먼저)
-- 규칙(사용자 결정)
--   · 결제일 = 카드 등록(첫 결제)일 기준 매월 같은 날(말일 보정). 무료 기간 중 등록하면 무료 기간 끝난 다음 날 첫 결제
--   · 실패: 0~3일 하루 1번 재시도(막지 않음) · 4~7일 유예 · 8일째부터 새 영수증 올리기·서류 변환만 멈춤 · 30일째 자동 해지(데이터는 그대로)
--   · 요금제 바꾸기·저장 공간 바꾸기·해지 = 다음 결제일부터. 환불·차액 없음
--   · 결제는 운영자가 연 회사만(app_settings billing_mode: closed | test(목록의 회사만) | open). 면제 회사(D-294)는 결제 대상 아님
--   · AI 영수증 읽기 장수: 첫 결제 때 + 매월 1일 = 쓴 장수 + 요금제 월 장수(이월 없음, pricing-policy §1)
-- 카드 결제키(billing key)는 billing_keys에만 — 로그인 사용자는 어떤 경로로도 못 읽는다(서버 service role만)

insert into private.app_settings (key, value) values ('billing_mode', 'test'), ('billing_test_companies', '')
on conflict (key) do nothing;

-- ── 구독 ────────────────────────────────────────────────────────────────────
create table public.billing_subscriptions (
  company_id uuid primary key references public.companies (id) on delete cascade,
  customer_key uuid not null unique default gen_random_uuid(), -- 토스 구매자 ID(추측 불가 값)
  plan_code text not null references public.billing_plans (code),
  storage_gb integer not null default 0 check (storage_gb between 0 and 1000),
  -- pending: 카드 등록 전 · scheduled: 카드 등록됨, 무료 기간 끝난 다음 날 첫 결제 · active · past_due: 결제 실패 · canceled
  status text not null default 'pending' check (status in ('pending', 'scheduled', 'active', 'past_due', 'canceled')),
  card_label text check (card_label is null or char_length(card_label) <= 60),
  anchor_day smallint check (anchor_day between 1 and 31),
  next_billing_on date,
  period_start date,
  period_end date,
  pending_plan_code text references public.billing_plans (code),
  pending_storage_gb integer check (pending_storage_gb is null or pending_storage_gb between 0 and 1000),
  cancel_at_period_end boolean not null default false,
  past_due_since date,
  last_attempt_on date,
  cancel_reason text check (cancel_reason is null or cancel_reason in ('user', 'unpaid')),
  canceled_at timestamptz,
  last_grant_month text, -- 매월 1일 장수 지급을 한 번만
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.billing_subscriptions enable row level security;
alter table public.billing_subscriptions force row level security;
revoke all on public.billing_subscriptions from anon, authenticated;
grant select on public.billing_subscriptions to authenticated;
grant all on public.billing_subscriptions to service_role;
create policy billing_subscriptions_select on public.billing_subscriptions for select to authenticated
  using (company_id = (select private.current_company_id()) and (select private.is_admin()));

-- ── 카드 결제키(서버만) ─────────────────────────────────────────────────────
create table public.billing_keys (
  company_id uuid primary key references public.companies (id) on delete cascade,
  billing_key text not null check (char_length(billing_key) between 1 and 200),
  updated_at timestamptz not null default now()
);
alter table public.billing_keys enable row level security;
alter table public.billing_keys force row level security;
revoke all on public.billing_keys from anon, authenticated;
grant all on public.billing_keys to service_role;

-- ── 결제 내역 ───────────────────────────────────────────────────────────────
create table public.billing_payments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  order_id text not null unique check (char_length(order_id) between 6 and 64),
  payment_key text,
  kind text not null check (kind in ('first', 'renewal', 'retry')),
  plan_code text not null references public.billing_plans (code),
  storage_gb integer not null default 0,
  list_amount integer not null check (list_amount >= 0),
  discount integer not null default 0 check (discount >= 0),
  supply integer not null check (supply >= 0),
  vat integer not null check (vat >= 0),
  total integer not null check (total >= 0),
  coupon boolean not null default false,
  status text not null check (status in ('paid', 'failed')),
  fail_code text,
  fail_message text check (fail_message is null or char_length(fail_message) <= 300),
  period_start date,
  period_end date,
  receipt_url text,
  approved_at timestamptz,
  created_at timestamptz not null default now()
);
create index billing_payments_company_idx on public.billing_payments (company_id, created_at desc);
alter table public.billing_payments enable row level security;
alter table public.billing_payments force row level security;
revoke all on public.billing_payments from anon, authenticated;
grant select on public.billing_payments to authenticated;
grant all on public.billing_payments to service_role;
create policy billing_payments_select on public.billing_payments for select to authenticated
  using (company_id = (select private.current_company_id()) and (select private.is_admin()));

-- 첫 결제·매월 1일 장수 지급 기록
alter table public.credit_ledger drop constraint credit_ledger_reason_check;
alter table public.credit_ledger
  add constraint credit_ledger_reason_check check (reason in ('free_trial_grant', 'receipt_upload', 'event_bonus', 'survey_bonus', 'doc_convert', 'doc_convert_refund', 'plan_grant'));

-- ── 도우미 ──────────────────────────────────────────────────────────────────
create or replace function private.kst_today()
returns date
language sql stable
set search_path = ''
as $$ select (now() at time zone 'Asia/Seoul')::date $$;

-- p_from이 속한 달의 다음 달 anchor일(그 달에 없으면 말일)
create or replace function private.billing_next_date(p_from date, p_anchor integer)
returns date
language sql immutable
set search_path = ''
as $$
  select (date_trunc('month', p_from) + interval '1 month')::date
         + (least(p_anchor, extract(day from (date_trunc('month', p_from) + interval '2 month' - interval '1 day'))::integer) - 1)
$$;

-- 이 회사에 결제가 열려 있나(면제 회사는 아님)
create or replace function private.billing_open_for(p_company uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select not coalesce((select billing_exempt from public.companies where id = p_company), true)
     and case private.setting('billing_mode', 'closed')
           when 'open' then true
           when 'test' then p_company::text = any (string_to_array(replace(private.setting('billing_test_companies', ''), ' ', ''), ','))
           else false
         end
$$;
revoke all on function private.billing_open_for(uuid) from public, anon, authenticated;

-- 새 영수증 올리기·서류 변환 멈춤: 결제 실패 8일째부터, 미납으로 해지된 뒤에도(카드를 다시 등록해 결제하면 풀림)
create or replace function private.billing_blocked(p_company uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce((
    select (s.status = 'past_due' and private.kst_today() - s.past_due_since >= 8)
        or (s.status in ('canceled', 'pending') and s.cancel_reason = 'unpaid') -- 결제하기만 누르고 그만둬도 풀리지 않게
      from public.billing_subscriptions s where s.company_id = p_company), false)
$$;
revoke all on function private.billing_blocked(uuid) from public, anon, authenticated;

-- 적용 요금제: 면제 = 비즈니스, 결제 중(active·past_due) = 구독 요금제, 그 밖 = 지금처럼 프로
create or replace function private.effective_plan(p_company uuid)
returns public.billing_plans
language sql stable security definer
set search_path = ''
as $$
  select * from public.billing_plans
  where code = case
    when coalesce((select billing_exempt from public.companies where id = p_company), false) then 'pro'
    else coalesce((select s.plan_code from public.billing_subscriptions s where s.company_id = p_company and s.status in ('active', 'past_due')), 'standard')
  end
$$;

-- 회사 공용 저장 공간: 면제 = 비즈니스 용량, 결제 중 = 구독 요금제 용량, 그 밖 = 지금처럼 스타터
create or replace function private.storage_total_limit(p_company uuid)
returns bigint
language sql stable security definer
set search_path = ''
as $$
  select coalesce(
           (select storage_mb from public.billing_plans
             where code = case
               when coalesce((select billing_exempt from public.companies where id = p_company), false) then 'pro'
               else coalesce((select s.plan_code from public.billing_subscriptions s where s.company_id = p_company and s.status in ('active', 'past_due')), 'starter')
             end),
           10240)::bigint * 1024 * 1024
         + private.storage_extra_bytes(p_company)
$$;

-- 저장 공간 GB → 월 가격(0이면 0, 없는 상품이면 null)
create or replace function private.storage_price(p_gb integer)
returns integer
language sql stable security definer
set search_path = ''
as $$
  select case when p_gb = 0 then 0 else (select monthly_price from public.storage_addons where storage_gb = p_gb and is_active) end
$$;

-- ── 관리자 화면(로그인 관리자, 자기 회사) ──────────────────────────────────
create or replace function public.billing_state()
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_me public.members := private.require_admin();
  s public.billing_subscriptions;
begin
  select * into s from public.billing_subscriptions where company_id = v_me.company_id;
  return jsonb_build_object(
    'open', private.billing_open_for(v_me.company_id),
    'blocked', private.billing_blocked(v_me.company_id),
    'today', private.kst_today(),
    'subscription', case when s.company_id is null then null else jsonb_build_object(
      'customer_key', s.customer_key, 'plan_code', s.plan_code, 'storage_gb', s.storage_gb, 'status', s.status, 'card_label', s.card_label,
      'next_billing_on', s.next_billing_on, 'period_start', s.period_start, 'period_end', s.period_end,
      'pending_plan_code', s.pending_plan_code, 'pending_storage_gb', s.pending_storage_gb, 'cancel_at_period_end', s.cancel_at_period_end,
      'past_due_since', s.past_due_since, 'cancel_reason', s.cancel_reason) end,
    'payments', coalesce((select jsonb_agg(jsonb_build_object(
        'id', p.id, 'kind', p.kind, 'plan_code', p.plan_code, 'storage_gb', p.storage_gb, 'total', p.total, 'supply', p.supply, 'vat', p.vat,
        'coupon', p.coupon, 'status', p.status, 'fail_message', p.fail_message, 'period_start', p.period_start, 'period_end', p.period_end,
        'receipt_url', p.receipt_url, 'created_at', p.created_at) order by p.created_at desc)
      from (select * from public.billing_payments where company_id = v_me.company_id order by created_at desc limit 24) p), '[]'::jsonb));
end;
$$;
revoke all on function public.billing_state() from public, anon;
grant execute on function public.billing_state() to authenticated;

-- 결제하기/카드 등록·바꾸기 전에: 고른 구성 저장(처음·해지 뒤) → 토스 결제창에 넘길 customer_key
create or replace function public.billing_prepare(p_plan text, p_storage integer)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_me public.members := private.require_admin();
  s public.billing_subscriptions;
begin
  if not private.billing_open_for(v_me.company_id) then raise exception 'BILLING_CLOSED'; end if;
  if not exists (select 1 from public.billing_plans where code = p_plan) or p_storage is null or private.storage_price(p_storage) is null then
    raise exception 'INVALID_PLAN';
  end if;
  select * into s from public.billing_subscriptions where company_id = v_me.company_id for update;
  if s.company_id is null then
    insert into public.billing_subscriptions (company_id, plan_code, storage_gb) values (v_me.company_id, p_plan, p_storage) returning * into s;
  elsif s.status in ('pending', 'canceled') then
    update public.billing_subscriptions
       set plan_code = p_plan, storage_gb = p_storage, status = 'pending', pending_plan_code = null, pending_storage_gb = null,
           cancel_at_period_end = false, next_billing_on = null, updated_at = now()
     where company_id = v_me.company_id returning * into s;
  end if; -- 결제 중(scheduled·active·past_due)이면 카드만 바꾼다 — 구성 바꾸기는 billing_change
  return s.customer_key;
end;
$$;
revoke all on function public.billing_prepare(text, integer) from public, anon;
grant execute on function public.billing_prepare(text, integer) to authenticated;

-- 구성 바꾸기: 첫 결제 전(scheduled)이면 바로, 결제 중이면 다음 결제일부터(지금과 같으면 예약 취소)
create or replace function public.billing_change(p_plan text, p_storage integer)
returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  v_me public.members := private.require_admin();
  s public.billing_subscriptions;
begin
  if not exists (select 1 from public.billing_plans where code = p_plan) or p_storage is null or private.storage_price(p_storage) is null then
    raise exception 'INVALID_PLAN';
  end if;
  select * into s from public.billing_subscriptions where company_id = v_me.company_id for update;
  if s.company_id is null or s.status not in ('scheduled', 'active', 'past_due') then raise exception 'NO_SUBSCRIPTION'; end if;
  if s.status = 'scheduled' then
    update public.billing_subscriptions set plan_code = p_plan, storage_gb = p_storage, pending_plan_code = null, pending_storage_gb = null, updated_at = now()
     where company_id = v_me.company_id;
    return 'now';
  end if;
  if p_plan = s.plan_code and p_storage = s.storage_gb then
    update public.billing_subscriptions set pending_plan_code = null, pending_storage_gb = null, updated_at = now() where company_id = v_me.company_id;
    return 'same';
  end if;
  update public.billing_subscriptions set pending_plan_code = p_plan, pending_storage_gb = p_storage, updated_at = now() where company_id = v_me.company_id;
  return 'next';
end;
$$;
revoke all on function public.billing_change(text, integer) from public, anon;
grant execute on function public.billing_change(text, integer) to authenticated;

-- 해지 신청/취소: 첫 결제 전이면 바로 해지, 결제 중이면 다음 결제일에 해지(그때까지 그대로 씀)
create or replace function public.billing_set_cancel(p_cancel boolean)
returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  v_me public.members := private.require_admin();
  s public.billing_subscriptions;
begin
  if p_cancel is null then raise exception 'INVALID'; end if;
  select * into s from public.billing_subscriptions where company_id = v_me.company_id for update;
  if s.company_id is null or s.status not in ('scheduled', 'active', 'past_due') then raise exception 'NO_SUBSCRIPTION'; end if;
  if s.status = 'scheduled' and p_cancel then
    update public.billing_subscriptions set status = 'canceled', cancel_reason = 'user', canceled_at = now(), next_billing_on = null, updated_at = now()
     where company_id = v_me.company_id;
    return 'canceled';
  end if;
  if s.status = 'past_due' then raise exception 'PAST_DUE_CANCEL'; end if; -- 밀린 결제가 있으면 카드를 바꿔 결제한 뒤 해지
  update public.billing_subscriptions set cancel_at_period_end = p_cancel, updated_at = now() where company_id = v_me.company_id;
  return case when p_cancel then 'at_period_end' else 'resumed' end;
end;
$$;
revoke all on function public.billing_set_cancel(boolean) from public, anon;
grant execute on function public.billing_set_cancel(boolean) to authenticated;

-- ── 서버(service role) ──────────────────────────────────────────────────────
-- 직원 업로드·서류 변환 전에 확인
create or replace function public.billing_upload_blocked(p_company uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$ select private.billing_blocked(p_company) $$;
revoke all on function public.billing_upload_blocked(uuid) from public, anon, authenticated;
grant execute on function public.billing_upload_blocked(uuid) to service_role;

-- 카드 등록 완료(토스에서 결제키 받음) → 'charge'(지금 결제) | 'scheduled'(무료 기간 끝난 다음 날) | 'saved'(카드만 바꿈)
create or replace function public.billing_card_saved(p_company uuid, p_customer_key uuid, p_billing_key text, p_card_label text)
returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  s public.billing_subscriptions;
  c public.companies;
  v_first date;
begin
  select * into s from public.billing_subscriptions where company_id = p_company for update;
  if s.company_id is null or s.customer_key <> p_customer_key then raise exception 'NOT_FOUND'; end if;
  if not private.billing_open_for(p_company) then raise exception 'BILLING_CLOSED'; end if;
  insert into public.billing_keys (company_id, billing_key, updated_at) values (p_company, p_billing_key, now())
  on conflict (company_id) do update set billing_key = excluded.billing_key, updated_at = now();
  update public.billing_subscriptions set card_label = left(p_card_label, 60), updated_at = now() where company_id = p_company;
  if s.status in ('scheduled', 'active') then return 'saved'; end if;
  if s.status = 'past_due' then return 'charge'; end if;
  -- pending: 무료 기간이 남았고 아직 결제한 적 없으면 끝난 다음 날 첫 결제
  select * into c from public.companies where id = p_company;
  if c.first_purchase_at is null and c.trial_ends_on is not null and c.trial_ends_on >= private.kst_today() then
    v_first := c.trial_ends_on + 1;
    update public.billing_subscriptions
       set status = 'scheduled', next_billing_on = v_first, anchor_day = extract(day from v_first)::smallint, cancel_reason = null, canceled_at = null, updated_at = now()
     where company_id = p_company;
    return 'scheduled';
  end if;
  return 'charge';
end;
$$;
revoke all on function public.billing_card_saved(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.billing_card_saved(uuid, uuid, text, text) to service_role;

-- 결제할 내용(예약된 바꾸기 반영) + 결제키
create or replace function public.billing_charge_info(p_company uuid)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  s public.billing_subscriptions;
  c public.companies;
  v_plan text;
  v_gb integer;
begin
  select * into s from public.billing_subscriptions where company_id = p_company;
  if s.company_id is null then return null; end if;
  select * into c from public.companies where id = p_company;
  v_plan := coalesce(s.pending_plan_code, s.plan_code);
  v_gb := coalesce(s.pending_storage_gb, s.storage_gb);
  return jsonb_build_object(
    'company_name', c.name,
    'status', s.status,
    'customer_key', s.customer_key,
    'billing_key', (select billing_key from public.billing_keys where company_id = p_company),
    'plan_code', v_plan,
    'plan_name', (select name from public.billing_plans where code = v_plan),
    'plan_price', (select monthly_price from public.billing_plans where code = v_plan),
    'storage_gb', v_gb,
    'storage_price', coalesce(private.storage_price(v_gb), 0),
    'coupon', c.review_coupon_at is not null and c.first_purchase_at is null,
    'exempt', c.billing_exempt,
    'open', private.billing_open_for(p_company));
end;
$$;
revoke all on function public.billing_charge_info(uuid) from public, anon, authenticated;
grant execute on function public.billing_charge_info(uuid) to service_role;

-- 결제 결과 기록 + 상태 바꾸기(한 트랜잭션)
create or replace function public.billing_payment_result(
  p_company uuid, p_order_id text, p_kind text, p_ok boolean,
  p_plan text, p_storage integer, p_list integer, p_discount integer, p_supply integer, p_vat integer, p_total integer, p_coupon boolean,
  p_payment_key text, p_receipt_url text, p_fail_code text, p_fail_message text)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  s public.billing_subscriptions;
  v_today date := private.kst_today();
  v_start date;
  v_anchor integer;
  v_next date;
  v_first boolean;
  v_receipts integer;
begin
  select * into s from public.billing_subscriptions where company_id = p_company for update;
  if s.company_id is null then raise exception 'NOT_FOUND'; end if;
  if not p_ok then
    insert into public.billing_payments (company_id, order_id, kind, plan_code, storage_gb, list_amount, discount, supply, vat, total, coupon, status, fail_code, fail_message)
    values (p_company, p_order_id, p_kind, p_plan, p_storage, p_list, p_discount, p_supply, p_vat, p_total, p_coupon, 'failed', left(p_fail_code, 60), left(p_fail_message, 300));
    -- 처음 결제(카드 등록 직후)가 실패하면 그대로 결제 전(관리자가 화면에서 바로 봄). 결제 중이면 미납으로
    if s.status in ('scheduled', 'active', 'past_due') then
      update public.billing_subscriptions
         set status = 'past_due', past_due_since = coalesce(past_due_since, v_today), last_attempt_on = v_today, updated_at = now()
       where company_id = p_company;
    end if;
    return jsonb_build_object('status', case when s.status in ('scheduled', 'active', 'past_due') then 'past_due' else s.status end, 'past_due_since', coalesce(s.past_due_since, v_today));
  end if;

  -- 성공: 정해진 결제일에 낸 것이면 그날부터, 처음·밀린 결제면 오늘부터 새 기간
  v_first := s.status in ('pending', 'canceled', 'scheduled');
  if s.status = 'active' and s.next_billing_on is not null then
    v_start := s.next_billing_on;
    v_anchor := coalesce(s.anchor_day, extract(day from v_start)::integer);
  elsif s.status = 'scheduled' and s.next_billing_on is not null then
    v_start := least(s.next_billing_on, v_today);
    v_anchor := extract(day from v_start)::integer;
  else
    v_start := v_today;
    v_anchor := extract(day from v_today)::integer;
  end if;
  v_next := private.billing_next_date(v_start, v_anchor);
  insert into public.billing_payments (company_id, order_id, payment_key, kind, plan_code, storage_gb, list_amount, discount, supply, vat, total, coupon, status, period_start, period_end, receipt_url, approved_at)
  values (p_company, p_order_id, p_payment_key, p_kind, p_plan, p_storage, p_list, p_discount, p_supply, p_vat, p_total, p_coupon, 'paid', v_start, v_next - 1, p_receipt_url, now());
  update public.billing_subscriptions
     set status = 'active', plan_code = p_plan, storage_gb = p_storage, pending_plan_code = null, pending_storage_gb = null,
         anchor_day = v_anchor, period_start = v_start, period_end = v_next - 1, next_billing_on = v_next,
         past_due_since = null, last_attempt_on = v_today, cancel_reason = null, canceled_at = null, updated_at = now()
   where company_id = p_company;
  update public.companies set first_purchase_at = coalesce(first_purchase_at, now()), extra_storage_gb = p_storage where id = p_company;
  -- 처음 결제(구독 시작·다시 시작): 이번 달 장수 = 쓴 장수 + 요금제 월 장수
  if v_first then
    select monthly_receipts into v_receipts from public.billing_plans where code = p_plan;
    update public.companies set receipt_credits_granted = receipt_credits_used + v_receipts where id = p_company;
    insert into public.credit_ledger (company_id, delta, reason) values (p_company, v_receipts, 'plan_grant');
    update public.billing_subscriptions set last_grant_month = to_char(v_today, 'YYYY-MM') where company_id = p_company;
  end if;
  return jsonb_build_object('status', 'active', 'next_billing_on', v_next, 'period_start', v_start, 'period_end', v_next - 1);
end;
$$;
revoke all on function public.billing_payment_result(uuid, text, text, boolean, text, integer, integer, integer, integer, integer, integer, boolean, text, text, text, text) from public, anon, authenticated;
grant execute on function public.billing_payment_result(uuid, text, text, boolean, text, integer, integer, integer, integer, integer, integer, boolean, text, text, text, text) to service_role;

-- 매일 아침 할 일 목록: charge(결제일) · retry(실패 1~3일, 하루 1번) · end(해지 예약한 결제일) · expire(실패 30일) · block(실패 8일째 안내)
create or replace function public.billing_due(p_today date)
returns table (company_id uuid, action text)
language sql stable security definer
set search_path = ''
as $$
  select s.company_id, case
      when s.status in ('active', 'scheduled') and s.cancel_at_period_end then 'end'
      when s.status in ('active', 'scheduled') then 'charge'
      when p_today - s.past_due_since >= 30 then 'expire'
      when p_today - s.past_due_since = 8 then 'block'
      else 'retry' end
    from public.billing_subscriptions s
   where (s.status in ('active', 'scheduled') and s.next_billing_on <= p_today)
      or (s.status = 'past_due' and (p_today - s.past_due_since >= 30 or p_today - s.past_due_since = 8
          or (p_today - s.past_due_since between 1 and 3 and coalesce(s.last_attempt_on, s.past_due_since) < p_today)))
$$;
revoke all on function public.billing_due(date) from public, anon, authenticated;
grant execute on function public.billing_due(date) to service_role;

-- 해지(예약한 결제일 도착 = user, 미납 30일 = unpaid)
create or replace function public.billing_close(p_company uuid, p_reason text)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if p_reason not in ('user', 'unpaid') then raise exception 'INVALID'; end if;
  update public.billing_subscriptions
     set status = 'canceled', cancel_reason = p_reason, canceled_at = now(), next_billing_on = null, cancel_at_period_end = false, updated_at = now()
   where company_id = p_company and status in ('active', 'scheduled', 'past_due');
end;
$$;
revoke all on function public.billing_close(uuid, text) from public, anon, authenticated;
grant execute on function public.billing_close(uuid, text) to service_role;

-- 매월 1일: 결제 중인 회사의 장수 = 쓴 장수 + 요금제 월 장수(이월 없음). 같은 달 두 번 하지 않음
create or replace function public.billing_monthly_grant(p_today date)
returns integer
language plpgsql security definer
set search_path = ''
as $$
declare
  v_month text := to_char(p_today, 'YYYY-MM');
  r record;
  n integer := 0;
begin
  if extract(day from p_today) <> 1 then return 0; end if;
  for r in
    select s.company_id, p.monthly_receipts
      from public.billing_subscriptions s join public.billing_plans p on p.code = s.plan_code
     where s.status in ('active', 'past_due') and coalesce(s.last_grant_month, '') <> v_month
     for update of s
  loop
    update public.companies set receipt_credits_granted = receipt_credits_used + r.monthly_receipts where id = r.company_id;
    insert into public.credit_ledger (company_id, delta, reason) values (r.company_id, r.monthly_receipts, 'plan_grant');
    update public.billing_subscriptions set last_grant_month = v_month where company_id = r.company_id;
    n := n + 1;
  end loop;
  return n;
end;
$$;
revoke all on function public.billing_monthly_grant(date) from public, anon, authenticated;
grant execute on function public.billing_monthly_grant(date) to service_role;
