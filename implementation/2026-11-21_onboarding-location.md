# 2026-11-21 회사 위치 온보딩 단계 + 회사정보 탭 합침 + [1:1 문의] 이름 — D-299

## 구현 대상
- 사용자 2026-11-21 요청: 회사 위치를 회사 등록 직후 온보딩에서, 설정의 회사 위치 탭을 회사정보 탭에 합침, 노란 버튼 이름 [1:1 문의]

## 변경 사항
- `src/app/onboarding/location/page.tsx`(새 단계) · `src/app/onboarding/actions.ts`(회사 등록 뒤 → /onboarding/location)
- `src/app/workspace/[id]/admin/settings/page.tsx`(회사정보 아래 위치 카드) · `section.tsx`(extra 자리) · `settings/location/page.tsx`(옛 주소 → /settings#location)
- `src/lib/admin/settings-groups.ts`(회사 위치 탭 뺌) · `company-location-card.tsx`(id=location)
- `src/components/admin/admin-shell.tsx`(관리자 피드백 → 1:1 문의) · `src/lib/help/seed.ts`(도움말 경로·문구)

## 검증
- tsc · 단위 테스트 503 · build · 로컬 E2E `e2e-onboarding-location` ALL_OK(390·1280: 회사 등록 → 위치 단계 → 저장/건너뛰기 → 추천 단계, 설정 탭·카드·옛 주소 이동), 캡처 확인

## 특이 사항
- 도움말 글(DB) 1단계 문구만 바꿈. 경로는 DB 규칙상 # 불가라 옛 주소 그대로(회사정보#location으로 이동됨)
