# 근태 켤 때 할 일 — D-310 (U-9)

- 구현 일시: 2026-11-22
- 변경 사항: `attendance-admin.tsx` AttendanceSwitch(켜기 전 할 일·시간, 켠 뒤 남은 일 TodoLink 3개, 켠 직후 스크롤) · `features/page.tsx`(근태 켠 회사만 승인 멤버 수·입사일 없는 수·연결 단말 수 읽기)
- 특이 사항: 시간은 setup-wizard의 근태 단계 minutes 합(약 6분)을 그대로 씀. 근무 기준 문구는 회사 값과 어긋나지 않게 고정 시각을 넣지 않음. 기존 로컬 e2e-attendance의 [저장] 선택자가 '저장하지 않은 변경' 띠(D-301)와 겹쳐 폼 안 버튼으로 좁힘(테스트만)
- 검증: tsc · vitest 519 · build · 로컬/운영 E2E(e2e-att-todo 신규, attendance) · leftovers []
