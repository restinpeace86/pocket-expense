# 근태 정책 정리 — D-308 (U-13·U-14·U-15)

- 구현 일시: 2026-11-22
- 변경 사항
  - `settings-groups.ts` 근태 탭 순서
  - `attendance-admin.tsx` 근무 기준에서 연차 연도 기준·5인 미만 빼고 안내 한 줄, 근태 변경 이력 메뉴 이름(attendanceMenu)
  - `attendance-settings/part.tsx` 연차 자료 안 읽음(원래대로)
  - `leave/actions.ts` saveLeaveBasisAction(attendance_admin_view로 지금 값 → attendance_settings_save, DB 변경 없음)
  - `leave-admin.tsx` LeaveBasisCard(연차 기준·5인 미만·영향 직원 수·입사일 미리보기) · 입사일 묶음 안내 · HireBatchSheet · 입사일 없는 줄 휴대폰에서 빈 칸 숨김
  - `change-history.ts` attendanceMenu(+test)
- 특이 사항: 저장 직후 새로 고침 전 '저장하면…' 안내가 잠깐 남던 것 justSaved로 막음. 일괄 입사일 창은 data-unsaved-ignore(닫기 = 취소)
- 검증: tsc · vitest 519 · build · 로컬/운영 E2E(e2e-leave-basis 신규·settings-scenario·apply-preview·leave·setup-wizard) · leftovers []
