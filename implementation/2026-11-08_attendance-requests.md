# 근태 ⑤ 정정 신청 · 휴일 근무 상신 → 근태 승인 (D-239)

- 구현 일시: 2026-11-08
- Spec: `spec/features/attendance.md` §6 (승인) · 시안 캔버스 "근태 1단계 시안" ⑤ 줄

## 변경 사항
- DB(migration 127_attendance_requests.sql)
  - `attendance_requests`(원래 기록 before·사유·처리자·반려 사유) — 하루 승인 대기 1건(부분 유일 인덱스), 대기→처리 한 번만, 처리 뒤 수정·삭제 불가(트리거), 강제 RLS(본인·관리자 읽기)
  - `attendance_days`: `in_method`(qr/correction), out_method에 correction, `holiday_approved_at`
  - `attendance_request_create`: 이번 달만(오늘까지, 근태 켠 날·가입 승인일 이후), 시각 검사(출근<퇴근, 23:59까지, 미래 불가), 사유 필수, QR 없는 휴일 불가, 바뀐 것 없으면 불가. 대표는 바로 본인 승인. 나머지는 승인할 수 있는 관리자 각자 [알림]방 + 휴대폰 알림(건마다)
  - `attendance_request_decide`: 직원 신청 → 관리자·대표 / 관리자 신청 → 대표만 / 본인 불가, 반려 사유 필수, 신청 뒤 기록이 바뀌면 RECORD_CHANGED(자정 자동 퇴근은 예외), 결과는 신청자 [알림]방 + 휴대폰 알림
  - `attendance_request_cancel`, `attendance_requests_admin`, `attendance_pending_count`, `my_attendance_month` 확장(신청·request_from·정정 표시)
- 직원: [근태] 목록 표시(정정 대기·정정됨·반려·휴일 상신 전/승인 대기/근무 인정), "내 신청" 줄, 마지막 3일 말일 안내, 그날 상세(바뀐 기록·대기 중 신청 취소·반려 사유·[정정 신청]/[휴일 근무 상신]), 신청 화면 `/employee/attendance/request`, QR 결과 화면 버튼(휴일 퇴근 → 상신, 이미 퇴근 → 정정)
- 요약: 승인 전 휴일 출근은 "출근한 날"·머문 시간에 넣지 않음("휴일 근무 n일 인정")
- 관리자: 메뉴 [근태 승인](근태 켠 회사, 처리할 수 있는 대기 수), 화면 `/admin/attendance`(승인 대기·처리 끝 3개월, 반려 사유 창), 접힌 안내 그림
- 안내 그림 4장 추가(fix-form·holiday-form·fixed·approve) — 근태 설정 안내 10장, "곧 열려요" 문구 제거
- 알림 링크 버튼 [근태 승인 열기]·[내 근태 보기], 근태 휴대폰 알림 ⏰

## 검증
- tsc / npm run test 64파일 350개 / DB test 080_attendance_requests(+078·079) / build
- E2E e2e-attendance(⑤-3 단계 추가) 로컬 ALL_OK, e2e-hub ALL_OK, leftovers []
- 스크린숏: holiday-form-390, fix-form-390, month-pending-390, fixed-390, approve-1280, approve-390

## 특이 사항
- 신청 화면 머문 시간 미리 보기는 분 단위(HH:MM) 계산이라 목록(초 포함)과 1분 차이가 날 수 있음
- 대표 본인 신청 즉시 승인은 DB 테스트로 확인(E2E 미포함)
