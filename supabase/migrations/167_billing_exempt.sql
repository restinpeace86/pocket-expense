-- 167: 운영사 회사 결제 면제(D-294, 사용자 2026-11-19 "548-23-02343 다모은랩 — 우리 회사니 따로 서비스 결제 하지 않도록")
-- - 면제 사업자번호 목록(private, 화면·API로 못 바꿈)에 있는 번호로 "처음" 만든 회사 1곳만 billing_exempt = true
--   (사업자번호는 중복 가입을 막지 않으므로, 같은 번호로 나중에 만든 회사는 면제 안 됨)
-- - 면제 회사: 무료 기간 끝 없음(trial_ends_on null) · 영수증 안전 상한 없음(크게) · 요금제 = 가장 높은 비즈니스 플랜 기준
--   (저장 공간·양식 칸·서류 변환·휴지통·예산 알림) · 결제·플랜 고르기 화면은 앱에서 숨김
-- - 회사 관리자는 companies를 직접 고칠 수 없다(UPDATE 권한은 event_bonus_acknowledged_at만) → 스스로 면제를 켤 수 없음
-- - 결제가 붙을 때(B-4) private.effective_plan의 면제 분기는 그대로 둔다

alter table public.companies add column billing_exempt boolean not null default false;

create table private.billing_exempt_business_numbers (
  business_number text primary key check (business_number ~ '^\d{10}$'),
  note text not null,
  created_at timestamptz not null default now()
);
revoke all on private.billing_exempt_business_numbers from public, anon, authenticated;
insert into private.billing_exempt_business_numbers (business_number, note) values ('5482302343', '다모은랩(운영사)');

-- 회사 만들 때: 면제 번호 + 그 번호로 만든 첫 회사면 면제
create or replace function private.company_billing_exempt()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if exists (select 1 from private.billing_exempt_business_numbers b where b.business_number = new.business_number)
     and not exists (select 1 from public.companies c where c.business_number = new.business_number) then
    new.billing_exempt := true;
    new.trial_ends_on := null;
    new.receipt_credits_granted := 1000000;
  end if;
  return new;
end;
$$;
revoke all on function private.company_billing_exempt() from public, anon, authenticated;
-- 이름순으로 companies_trial_defaults보다 먼저 돈다 → 면제 회사는 trial_ends_on을 다시 채우지 않게 아래 함수도 고친다
create trigger companies_billing_exempt before insert on public.companies
  for each row execute function private.company_billing_exempt();

create or replace function private.company_trial_defaults()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.trial_ends_on is null and not new.billing_exempt then new.trial_ends_on := private.trial_end_for((now() at time zone 'Asia/Seoul')::date); end if;
  return new;
end;
$$;

-- 회사에 적용되는 요금제: 면제 회사 = 비즈니스(pro), 그 밖 = 지금처럼 프로(standard)
create or replace function private.effective_plan(p_company uuid)
returns public.billing_plans
language sql stable security definer
set search_path = ''
as $$
  select * from public.billing_plans
  where code = case when coalesce((select billing_exempt from public.companies where id = p_company), false) then 'pro' else 'standard' end
$$;

-- 회사 공용 저장 공간: 면제 회사 = 비즈니스 플랜 용량, 그 밖 = 지금처럼 스타터 기준
create or replace function private.storage_total_limit(p_company uuid)
returns bigint
language sql stable security definer
set search_path = ''
as $$
  select coalesce(
           (select storage_mb from public.billing_plans
             where code = case when coalesce((select billing_exempt from public.companies where id = p_company), false) then 'pro' else 'starter' end),
           10240)::bigint * 1024 * 1024
         + private.storage_extra_bytes(p_company)
$$;
