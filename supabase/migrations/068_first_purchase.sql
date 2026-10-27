-- =============================================================================
-- 068_first_purchase.sql — 생애 첫 결제 50% 할인 판정용 (7차 개선사항 9, D-134)
-- - companies.first_purchase_at: 첫 유료 결제가 끝난 시각. 비어 있으면 "첫 결제" → 월간 요금 50% 할인가를 보여 준다
-- - 사용자(관리자 포함)는 바꿀 수 없다(companies는 칸별 수정 권한만 주며 이 칸은 넣지 않는다) — 다시 비워 할인을 또 받는 일 방지.
--   PG 연동 때 결제 승인 서버 처리(service role)만 채운다. 결제 연동 전이라 지금은 모든 회사가 비어 있다
-- =============================================================================

alter table public.companies add column first_purchase_at timestamptz;
comment on column public.companies.first_purchase_at is '첫 유료 결제 시각(D-134). null이면 첫 결제 할인 대상. 결제 승인 서버 처리만 채운다';
