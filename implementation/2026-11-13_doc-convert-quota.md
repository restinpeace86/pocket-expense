# 서류 → 엑셀 변환 플랜별 월 무료 횟수 (9-21, D-265)

- 구현 일시: 2026-11-13 (migration 154 운영 적용: 사용자 승인 "migration 153~157 운영 DB 적용 승인" 범위)
- Spec: `spec/features/company-forms.md` "서류 → 엑셀 변환 플랜별 월 무료 횟수", 시안 https://claude.ai/artifact/Ler67tzj8iWouxoFjo8jMg ③

## 변경 사항
- DB `154_doc_convert_quota.sql`: `billing_plans.monthly_doc_converts`(20·100·1,000)·`doc_converts_unlimited`, `private.effective_plan()`(지금 = 프로), `private.kst_month()`, `doc_convert_counts`(달별 횟수), `doc_conversions.free`, `doc_convert_begin`(무료 → 크레딧 → CONVERT_LIMIT)·`doc_convert_fail`(무료면 횟수 돌려줌) 다시 정의, 관리자 `doc_convert_quota()`
- DB 테스트: `093_doc_convert_quota.sql`(새), `088_doc_conversions.sql`(무료 다 쓴 상태에서 크레딧 경로, NO_CREDITS → CONVERT_LIMIT)
- `src/lib/doc-convert/model.ts`(+test) CONVERT_LIMIT 문구, `src/lib/billing/plan-benefits.ts`(+test) 카드 줄·요금 기준, `src/lib/billing/doc-quota.ts`, 관리자 요금제 `DocConvertQuotaCard`, 요금제 읽기 칸 추가(랜딩·관리자·미리보기), 크레딧 사용 내역 설명
- E2E `e2e-convert.mjs`(무료 변환 크레딧 0, 한도 넘으면 크레딧, 요금제 100/100건, 다 쓰면 안내), `shot-pricing.mjs`(카드 줄)

## 확인
- tsc · test 80/446 · lint · build · DB 088·093 · db:types, `e2e-convert.mjs`(실제 AI) ALL_OK, `shot-pricing.mjs` OK, 스크린샷 확인, leftovers []

## 특이 사항
- 결제 연동 전에는 회사에 요금제가 없어 새 기능의 플랜 값은 프로로 적용(effective_plan 하나만 바꾸면 됨)
