-- =============================================================================
-- 024_purchase_category_enum.sql — 경비 종류 "회사 물품 구매"(purchase) 추가 (D-076)
-- enum 값 추가는 같은 트랜잭션에서 바로 쓸 수 없어 별도 파일로 둔다. 사용은 025에서.
-- =============================================================================
alter type public.expense_category add value if not exists 'purchase';
create type public.purchase_type as enum ('pantry', 'office_supplies', 'small_equipment');
