# 퇴근 누락 알림 문구 (D-238)

- 구현 일시: 2026-11-08
- Spec: `spec/features/attendance.md` §3-4 알림

## 변경 사항
- DB(migration 126_attendance_alert_text.sql): `private.attendance_tick()` 알림 글을
  "퇴근을 아직 안 찍었어요 / 자정까지 안 찍으면 정규 퇴근 시각(18:00)으로 자동 기록돼요. / 더 일하고 있다면 자정 전에 회사 QR로 퇴근을 찍어 주세요. / 출근: 08:57"로, 링크를 `/employee/attendance`로
- 휴대폰 알림(`/api/cron/reminder-push`): 첫 줄이 "퇴근"으로 시작하면 ⏰ — 본문 맨 앞이 자동 기록 안내
- 알림 카드 버튼: `/employee/attendance` → [내 근태 보기] (`assistantLinkLabel`)
- 관리자 안내 그림 `public/guide/attendance/notice.png` 새 문구로 다시 그림

## 검증
- tsc / npm run test / DB test 078(알림 문구 확인 추가) / build
- 알림 카드 해석 단위 테스트: 시각의 ":"를 "이름: 값"으로 잘못 나누지 않음

## 특이 사항
- 전에는 "안 찍으면 18:00(정규 퇴근)…" 줄이 카드에서 "안 찍으면 18 | 00(정규…"로 나뉘고, 버튼이 "내 결의서 보기"로 나왔다 — 함께 고침
