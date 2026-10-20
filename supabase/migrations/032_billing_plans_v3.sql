-- =============================================================================
-- 032_billing_plans_v3.sql — 요금제 3단 개편 + 연간 선결제가 (D-081, D-077 대체)
--   스타터 150장 / 월 30,000원 (연 324,000원) · 스탠다드(주력) 400장 / 월 60,000원 (연 648,000원)
--   프로 800장 / 월 110,000원 (연 1,188,000원). 모두 공급가액, 부가세 10% 별도. 엔터프라이즈 폐지.
--   월간 연속 결제 보너스는 단계 규칙이 정해질 때까지(O-09) 데이터로 두지 않는다. 결제 연동 전이므로 is_purchasable = false 유지.
-- =============================================================================

alter table public.billing_plans
  add column annual_price integer check (annual_price is null or annual_price > 0);

delete from public.billing_plans where code = 'enterprise';

insert into public.billing_plans (code, name, monthly_price, annual_price, monthly_receipts, recommended_size, sort_order, is_purchasable, is_unlimited, is_featured)
values
  ('starter', '스타터', 30000, 324000, 150, '5인 미만', 1, false, false, false),
  ('standard', '스탠다드', 60000, 648000, 400, '5~15인', 2, false, false, true),
  ('pro', '프로', 110000, 1188000, 800, '영업·현장직이 많은 팀', 3, false, false, false)
on conflict (code) do update set
  name = excluded.name,
  monthly_price = excluded.monthly_price,
  annual_price = excluded.annual_price,
  monthly_receipts = excluded.monthly_receipts,
  recommended_size = excluded.recommended_size,
  sort_order = excluded.sort_order,
  is_purchasable = excluded.is_purchasable,
  is_unlimited = excluded.is_unlimited,
  is_featured = excluded.is_featured,
  updated_at = now();
