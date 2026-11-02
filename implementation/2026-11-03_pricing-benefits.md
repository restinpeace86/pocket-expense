# 플랜 이름·직원 수·혜택 중심 요금 카드 (D-198)

- 구현 일시: 2026-11-03
- 출처: `implementation/todo_improvement.md` [개선사항 1] 가격정책 검토
- 대상: `supabase/migrations/103_billing_plans_v5.sql`, `src/lib/billing/plan-benefits.ts`(+ test), `src/components/landing/pricing.tsx`, `src/components/admin/billing-view.tsx`, `src/lib/admin/billing.ts`, dev preview 샘플, `spec/common/pricing-policy.md`, `spec/screens/admin-billing.md`, `spec/screens/landing-page.md`, `spec/data/schema.md`

## 변경
- DB: `billing_plans.max_members`(10 / 20 / null). 이름 스타터 / 프로 / 비즈니스, 대상 문구. 코드(starter/standard/pro)·가격 그대로.
- 요금 카드(랜딩·관리자): 가격 아래 "이 가격에 포함" — 직원 수(1인당 가격) / AI 영수증 읽기(장당 가격) / 모든 기능 포함. 카드 아래 "모든 플랜에 똑같이 포함" 7개(AI 영수증 자동 입력, 결재라인·사전 검토, 정산 지급, 법인카드 대조, 세무 마감 ZIP, 위하고 일반전표, 세무사무소 무료 연결).
- 랜딩 제목: "모든 기능은 같고, 팀 규모에 맞춰 고르세요" / "영수증부터 결재·정산·세무 마감까지 전부 포함된 고정 월 구독. 도입비 0원."

## 특이 사항
- 직원 수 제한은 표시만. 실제로 막는 것(새 초대만 막기 제안)은 결제 연동 때 확정.
- 법인카드 실시간 API 연동은 요금에 넣지 않음(별도 문의 유지) — 검토 내용은 decision-log D-198.
