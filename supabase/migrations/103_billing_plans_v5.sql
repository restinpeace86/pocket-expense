-- =============================================================================
-- 103_billing_plans_v5.sql — 플랜 이름·직원 수 (D-198)
-- 사용자 결정(2026-11-03): 이름 스타터 / 프로(주력) / 비즈니스, 가격은 그대로(29,000 / 49,000 / 89,000원, VAT 별도).
-- 플랜을 "영수증 장수"가 아니라 "이 가격에 받는 혜택"으로 보여 준다 — 직원 수(10 / 20 / 제한 없음)와 AI 영수증 읽기 장수가 차등, 기능은 모든 플랜 같음.
-- 내부 코드(starter/standard/pro)는 그대로 둔다(참조 보호). 직원 수 제한을 실제로 막는 것은 결제 연동 때(지금은 표시만).
-- =============================================================================
alter table public.billing_plans add column max_members integer check (max_members is null or max_members > 0); -- null = 제한 없음

update public.billing_plans set name = '스타터', recommended_size = '1인 사업자·소규모 현장 팀', max_members = 10, updated_at = now() where code = 'starter';
update public.billing_plans set name = '프로', recommended_size = '본격적으로 현장을 뛰는 소기업', max_members = 20, updated_at = now() where code = 'standard';
update public.billing_plans set name = '비즈니스', recommended_size = '현장 여러 곳을 함께 운영하는 팀', max_members = null, updated_at = now() where code = 'pro';
