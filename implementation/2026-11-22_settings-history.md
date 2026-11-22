# 설정 › 변경 이력 — D-303 B-2 / todo 9-45b

- 구현 일시: 2026-11-22
- 변경 사항
  - DB: `supabase/migrations/172_settings_history.sql`(운영 적용, 사용자 승인) — settings_history 표 + 설정 표 12개 트리거 + companies 열 트리거 + save_approval_line 이전→이후 기록. 테스트 `supabase/tests/107_settings_history.sql`(test:db 체인 추가)
  - 화면: `src/app/workspace/[id]/admin/change-history/page.tsx`, 합치기 `src/lib/admin/change-history.ts`(+test), 설정 메뉴 그룹 history(`settings-groups.ts`, 아이콘 History)
- 특이 사항: 기존 attendance_history는 건드리지 않고 화면에서만 합침. 근태 정책 › 변경 이력 탭은 그대로. '지출결의서 양식 기본으로 되돌리기'는 아직 안 남음
- 검증: tsc · vitest 514 · build · test 107 · 로컬/운영 E2E(e2e-change-history) · leftovers []
