# 저장 공간 추가 (8-103, D-262)

- 구현 일시: 2026-11-12 ~ 2026-11-13 (migration 153 운영 적용: 2026-11-13 사용자 승인)
- Spec: `spec/screens/admin-billing.md` "저장 공간 추가", `spec/screens/landing-page.md` §0-3

## 변경 사항
- DB `153_storage_addons.sql`: `storage_addons`(10/25/50/100GB, 공개 읽기), `companies.extra_storage_gb`, `storage_requests`(add/change/cancel, 회사당 열린 신청 하나), `chat_storage_limit`·`vault_limit` 함께 쓰기 계산, RPC `storage_addon_status/request/withdraw`(관리자), `storage_addon_grant/reject`(service role), 스타터 대상 문구
- DB 테스트 `supabase/tests/092_storage_addons.sql`(익명 상품 읽기, 직원 막힘, 신청·취소, 회사 격리, 켜기, 함께 쓰기 한도, 반려 사유 필수)
- `src/lib/billing/storage.ts`(+test), `src/components/billing/plan-storage.tsx`(체크·합계·결제 준비 중·신청), `storage-status.tsx`(사용량·신청 상태)
- 관리자 요금제 `billing-view.tsx`·`page.tsx`·`actions.ts`, 랜딩 `pricing.tsx`, 파일 보관 설정 [저장 공간 늘리기], 운영자 `/app-admin/storage`

## 확인
- tsc · test 80/446 · lint · build · test:db(092 포함) · db:types
- `.responsive/live/e2e-storage.mjs` 로컬 ALL_OK(랜딩 체크 합계, 관리자 신청·취소·켜기·한도 11GB, 390 넘침 없음), 스크린샷 확인, leftovers []

## 특이 사항
- 결제가 붙을 때까지 [결제하기]는 막혀 있고 신청분은 무료(운영자가 켜 줌)
