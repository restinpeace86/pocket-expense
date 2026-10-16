-- =============================================================================
-- 005_seed.sql — 요금제 시드 (D-046). 결제 연동 전이므로 is_purchasable = false
-- =============================================================================
insert into public.billing_plans (code, name, monthly_price, monthly_receipts, recommended_size, sort_order, is_purchasable)
values
  ('basic', '베이직', 40000, 300, '5~10인', 1, false),
  ('standard', '스탠다드', 70000, 600, '10~20인', 2, false),
  ('pro', '프로', 100000, 1000, '20~30인', 3, false)
on conflict (code) do update set
  name = excluded.name,
  monthly_price = excluded.monthly_price,
  monthly_receipts = excluded.monthly_receipts,
  recommended_size = excluded.recommended_size,
  sort_order = excluded.sort_order,
  is_purchasable = excluded.is_purchasable;
