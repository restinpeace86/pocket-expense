# 무료 이용 = 첫 월말 마감까지 + 후기 = 첫 결제 50% 쿠폰 (D-201)

- 구현 일시: 2026-11-03
- 대상: `supabase/migrations/104_trial_until_first_close.sql`, `supabase/tests/064_trial_until_first_close.sql`(새로)·001·002·044 기대값, `src/lib/billing/checkout.ts`(+ test), `src/lib/admin/billing.ts`, `src/components/admin/billing-view.tsx`, `src/components/admin/survey-dialog.tsx`, `src/lib/feedback-survey.ts`, `src/lib/errors.ts`, `src/components/admin/admin-home-view.tsx`, `src/app/workspace/[id]/admin/page.tsx`, 랜딩(`page.tsx`·`pricing.tsx`·`faq.tsx`·`testimonials.tsx`·`ai-simulator.tsx`), `src/app/onboarding/create-company/page.tsx`, `src/lib/billing/plan-benefits.ts`, `src/components/employee/use-receipt-upload.ts`

## 변경
- DB: `companies.trial_ends_on`(새 회사 트리거로 자동, 기존 회사는 가입일 기준), `companies.review_coupon_at`. `private.trial_end_for(시작일)` = 시작일이 25일 이후면 한 달 미뤄, 기준 달의 다음 달 5일(쉬는 날이면 앞 영업일). 가입 지급 줄(`free_trial_grant`)은 트리거가 안전 상한(`trial_receipt_cap`=800)으로 맞춤(create_company 함수는 그대로), 기본값 800. `submit_feedback_survey`: 조건 그대로, +100장 대신 쿠폰.
- 결제 금액: `checkoutPrice(가격, coupon)` — 쿠폰(후기 남김 + 결제 전)일 때만 50%.
- 화면: 요금제 "무료 이용 중 · M월 D일까지 무료"(지났으면 결제 준비 중이라 계속 무료), 올린 영수증·안전 상한, 쿠폰 버튼(3일 안이면 강조), 플랜 카드 쿠폰 표시/안내. 관리자 홈 "무료 이용" 카드, 후기 요청 배너(첫 마감 뒤 또는 무료 3일 전, 후기 안 남긴 회사). 후기 설문 문구 쿠폰으로. 랜딩·FAQ·요금 기준 첫 줄·후기 섹션·회사 만들기 문구.

## 특이 사항
- 결제 연동 전이라 무료 종료일이 지나도 업로드를 막지 않는다. 이벤트 추가 지급(D-054)은 안전장치로 유지.
- 실제 회사(페이퍼컴퍼니)는 종료일 2026-11-05로 채워짐(막지 않음).
- 무료 기간 안전 상한 800장은 지금 누적 지급 방식(월별 초기화는 결제 연동 때, pricing-policy §1).

- migration 105: 무료 종료일 트리거·계산 함수를 security definer로(서비스 키로 회사를 직접 넣을 때 permission denied for schema private — 화면 검증 중 발견, 가입 경로는 영향 없었음). DB 테스트 064에 서비스 키 삽입 확인 추가.
