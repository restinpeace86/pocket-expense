# 예산 계정과목 칸 접기 — D-311 (U-10)

- 구현 일시: 2026-11-22
- 변경 사항: `budget-form.tsx` byTitle(이미 계정과목 예산이 있으면 처음부터 펼침) · 접힌 안내 + [계정과목별로도 정하기]
- 특이 사항: DB 변경 없음. U-11(정기 결제 → 회사 자산)·U-12(마감 일정 탭 빼기)는 하지 않기로 함(D-311). 로컬 e2e-budget에 접힘·펼친 채 확인 추가
- 검증: tsc · vitest 519 · build · 로컬/운영 E2E(budget, apply-preview, settings-scenario) · leftovers []
