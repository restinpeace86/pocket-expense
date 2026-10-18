-- =============================================================================
-- 026_billing_plans_v2.sql — 요금제 개편 (D-077, D-046 보완)
--   스타터 150장/25,000원 · 스탠다드(주력) 400장/50,000원 · 프로 1,000장/100,000원 · 엔터프라이즈 무제한(공정 사용 월 3,000장)/200,000원
--   가격은 부가세 별도. 결제 연동 전이므로 is_purchasable = false 유지.
--   is_unlimited: 무제한 요금제(monthly_receipts는 공정 사용 기준 장수) / is_featured: 화면에서 "추천" 표시
-- =============================================================================

alter table public.billing_plans
  add column is_unlimited boolean not null default false,
  add column is_featured boolean not null default false;

delete from public.billing_plans where code = 'basic';

insert into public.billing_plans (code, name, monthly_price, monthly_receipts, recommended_size, sort_order, is_purchasable, is_unlimited, is_featured)
values
  ('starter', '스타터', 25000, 150, '5~10인', 1, false, false, false),
  ('standard', '스탠다드', 50000, 400, '10~25인', 2, false, false, true),
  ('pro', '프로', 100000, 1000, '25~50인', 3, false, false, false),
  ('enterprise', '엔터프라이즈', 200000, 3000, '50인 이상', 4, false, true, false)
on conflict (code) do update set
  name = excluded.name,
  monthly_price = excluded.monthly_price,
  monthly_receipts = excluded.monthly_receipts,
  recommended_size = excluded.recommended_size,
  sort_order = excluded.sort_order,
  is_purchasable = excluded.is_purchasable,
  is_unlimited = excluded.is_unlimited,
  is_featured = excluded.is_featured,
  updated_at = now();
