# 근태 1단계 — 근태 설정 · 회사 QR · QR 출퇴근 (D-236)

- 구현 일시: 2026-11-08
- Spec: `spec/features/attendance.md` (승인) · 시안 캔버스 "근태 1단계 시안"

## 변경 사항
- DB(migration 124_attendance.sql)
  - 표: attendance_settings / attendance_history(고치기·지우기 막는 트리거, 회사 삭제 때만 함께 지워짐) / attendance_terminals / attendance_pair_codes / attendance_days(하루 1행, 출근 때 정규 퇴근·알림 시간 저장) / attendance_attempts(90일)
  - 관리자 함수: attendance_set_enabled · attendance_settings_save(바뀐 항목만 이력) · attendance_pair_code_create · attendance_terminal_rename/revoke · attendance_admin_view
  - 서버 전용(service_role): attendance_terminal_pair · attendance_terminal_auth · attendance_punch · attendance_log_attempt
  - 직원: my_attendance_today
  - 예약 작업 attendance-tick(10분마다): 자정 지난 날 자동 퇴근 · 누락 알림([알림]방 + 기존 웹푸시 경로) · 오래된 기록 정리
- 서버: `src/lib/attendance/` (token: HMAC 30초 칸 서명 — 비밀키는 service role 키에서 용도별로 뽑음, rules, server) · `/api/attend/pair` · `/api/attend/qr` · `src/app/attend/actions.ts`(punchAction: 서명·시간·로그인·소속 확인 후 기록, 실패 기록)
- 화면
  - 관리자 설정 → [근태] `/admin/attendance-settings`: 사용 안내(접힘, 처음 한 번 펼침, 예시 그림 6장 `public/guide/attendance/`) · 근태 사용 · 근무 기준 · 출근 단말(연결 코드·이름 바꾸기·해제) · 변경 이력
  - 출근 단말 `/attend/terminal`(로그인 없음): 연결 코드 입력 → 30초 QR·남은 시간·서버 시각·찍은 사람 표시 · 06~24시 밖 안내 · 연결 끊김 시 QR 숨김 · 화면 꺼짐 방지
  - 직원: 하단 가운데 [QR 출퇴근](근태 켠 회사) → 앱 안 스캐너 `/employee/attend`(BarcodeDetector, 없으면 jsQR) · 결과 `/attend/scan`(출근/퇴근 확인/퇴근/이미 퇴근/실패) · 홈 현황 카드 오늘 출퇴근 줄
- 의존성: jsqr 1.4.0 추가

## 검증
- tsc / npm run test 62파일 329개(근태 7개 포함) / DB test 078_attendance(권한·이력 잠금·연결 코드 1회·출퇴근 흐름·회사 격리·자동 퇴근) / build
- E2E `.responsive/live/e2e-attendance.mjs` 36항목 ALL_OK(로컬), e2e-hub ALL_OK, leftovers []
- 스크린숏 확인: 관리자 안내(1280·390), 단말(1180), 출근·퇴근 확인·퇴근·이미 퇴근·만료(390), 홈 전후

## 특이 사항
- 정정 신청·휴일 근무 상신은 다음 단계(8-89) — 결과 화면·안내에는 "곧 열려요"로 표시, 버튼은 아직 없음
- 누락 알림은 메신저 켠 회사만([알림]방이 메신저 기능). 메신저 꺼진 회사는 알림 없이 자동 퇴근만
- 개인정보처리방침 반영은 8-93(실사용 전)
