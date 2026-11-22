# '우리 회사에 적용하면' 미리보기 — D-304 B-3 / todo 9-45c

- 구현 일시: 2026-11-22
- 변경 사항
  - 공통: `src/components/admin/apply-preview.tsx`(한 칸·두 줄), 계산 `src/lib/admin/apply-preview.ts`(+test 6)
  - 예산 `budget-form.tsx`(+page: spent·today) · 결재라인 `approval-lines-view.tsx`(기존 '미리보기' 줄을 바꿈) · 근무 기준 `attendance-admin.tsx` SettingsForm(+part.tsx: 근무 기준 탭에서만 올해 연차 자료) · 직원별 연차 `leave-admin.tsx` HirePreview(접힘, data-unsaved-ignore) · 파일 보관 `chat-retention.tsx`(+page: today) · 기능 사용 `attendance-admin.tsx` AttendanceSwitch·`calendar-switch.tsx`(+page: 승인된 멤버 수)
- 특이 사항: DB 변경 없음. 기능 사용 카드의 설명 문구는 미리보기와 겹치지 않게 짧게 줄임. 알림톡 스위치는 요금제 조건이 있어 미리보기 안 붙임
- 검증: tsc · vitest 520 · build · 로컬/운영 E2E(e2e-apply-preview 1280·390) · leftovers []
