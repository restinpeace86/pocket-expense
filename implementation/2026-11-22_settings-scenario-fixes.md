# 관리자 설정 시나리오 점검 고침 — D-306

- 구현 일시: 2026-11-22
- 점검: 실제 지출(1,200,000원)이 있는 smoke 회사에서 예산 입력·저장(떠나기 확인 포함) → 결재라인 저장 → 파일 보관 90→60일 → 근무 기준(근로시간만/연차 기준) 저장 → 캘린더 처음 끄기 → 변경 이력(1280·390, 거르기). 스크립트 .responsive/live/e2e-settings-scenario.mjs(로컬 전용)
- 변경 사항
  - `supabase/migrations/173_settings_history_defaults.sql`(운영 적용, 사용자 승인): settings_track()만 — 처음 바꿀 때 이전 값 = 기본값, 추가·삭제 때 금액·날짜(이름이 따로 없는 줄은 값)도 남김. 테스트 107에 확인 추가
  - `change-history/page.tsx`: 메뉴 이름이 그룹 이름과 같으면 한 번만
  - `attendance-admin.tsx`: 연차 영향 0명이면 '달라지는 직원은 없어요'
- 특이 사항: 이미 남은 '없음 → …' 기록은 고칠 수 없음(배포 후 1시간 남짓, 고치거나 지울 수 없는 표)
- 검증: test 107 · tsc · vitest 518 · build · 로컬/운영 E2E(settings-scenario·change-history·apply-preview·setup-wizard) · leftovers []
