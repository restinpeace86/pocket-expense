# 랜딩·요금 표시 정리 (9-25, D-270)

- 구현 일시: 2026-11-13 (DB 변경 없음)

## 변경 사항
- `src/components/landing/section-nav.tsx`(새) + `src/app/page.tsx`: 상단 바로 가기 지금 구역 표시
- `src/lib/billing/plan-benefits.ts`(+test): 인원 줄 → "직원 수 제한 없음", `perMember` 삭제, 서류 변환 보조 문구, 요금 기준 7줄
- `src/components/billing/plan-storage.tsx`: 공용 선택(한 영역 `StorageAddonPicker`) · `PlanStoragePrice(base)` · `PlanStorageTotal(base)` · `PlanPayButton` · `StorageRequestButton`
- `src/components/landing/pricing.tsx`, `src/components/admin/billing-view.tsx`: 저장 공간 영역 카드 아래 하나, 문구
- `src/components/landing/faq.tsx`: 직원 수 질문 답
- E2E: `e2e-storage.mjs`(한 영역·다른 카드 합계), `shot-pricing.mjs`(인원 문구 없음), `shot-landing-color.mjs`(바로 가기 표시)

## 확인
- tsc · test 82/455 · lint · build, `shot-pricing`·`e2e-storage`·`shot-landing-color` 로컬 OK, 스크린샷 확인, leftovers []
