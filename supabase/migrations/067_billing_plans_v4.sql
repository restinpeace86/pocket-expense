-- =============================================================================
-- 067_billing_plans_v4.sql — 요금제 가격 개편 + 연간 선결제 제외 + 추가 크레딧 상품 (7차 개선사항 8, D-133, D-081 가격 대체)
--   스타터 150장 / 월 29,000원 · 스탠다드(주력) 400장 / 월 49,000원 · 프로 800장 / 월 89,000원 (공급가액, 부가세 10% 별도)
--   연간 선결제는 월간 결제로 먼저 선보인 뒤 다시 정한다 → annual_price 비움(칸은 남겨 둠, 화면에 표시하지 않음)
--   추가 크레딧(애드온): 50장 8,000원 — 남은 장수가 0일 때만 요금제 화면에 보인다. 결제 연동 전이므로 is_purchasable = false
-- =============================================================================

update public.billing_plans set monthly_price = 29000, annual_price = null, updated_at = now() where code = 'starter';
update public.billing_plans set monthly_price = 49000, annual_price = null, updated_at = now() where code = 'standard';
update public.billing_plans set monthly_price = 89000, annual_price = null, updated_at = now() where code = 'pro';

-- 추가 크레딧 상품: 회사와 무관한 공용 데이터(요금제와 같음). 로그인 사용자 읽기만, 쓰기는 마이그레이션으로만
create table public.billing_addons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  receipts integer not null check (receipts > 0),
  price integer not null check (price > 0),
  sort_order integer not null default 0,
  is_purchasable boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.billing_addons enable row level security;
alter table public.billing_addons force row level security;
revoke all on public.billing_addons from anon, authenticated;
grant select on public.billing_addons to authenticated;
create policy billing_addons_read on public.billing_addons for select to authenticated using (true);

insert into public.billing_addons (code, name, receipts, price, sort_order, is_purchasable)
values ('receipts_50', '추가 크레딧 50장', 50, 8000, 1, false);
