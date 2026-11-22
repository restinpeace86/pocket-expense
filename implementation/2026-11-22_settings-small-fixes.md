# 설정 작은 개선 — D-307 (U-4·U-5·U-8·U-17)

- 구현 일시: 2026-11-22
- 변경 사항: `company-settings-form.tsx`(저장 옆·저장 완료 문구를 회사정보/경비 정책에 맞게) · `settings-tabs.tsx`(잘린 끝 흐림·› 표시·지금 탭 보이게, 스크롤바 숨김) · `corporate-cards/page.tsx`(대조 링크는 카드 1장 이상일 때 목록 아래) · `billing-view.tsx`(결제 수단 안내 한 줄)
- 특이 사항: U-17은 Spec §4(비활성 폼 모양 보여 주기)를 지키려고 숨기지 않고 안내만. DB 변경 없음
- 검증: tsc · vitest 518 · build · 로컬/운영 E2E(e2e-settings-small: 회사 이름 저장 → 변경 이력, 카드 0장/1장, 탭 첫·마지막, 1280·390) · leftovers []
