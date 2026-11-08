# 근태 ⑧ 오늘 출근 현황 (D-242)

- 구현 일시: 2026-11-09
- Spec: `spec/features/attendance.md` §9 (승인) · 시안 캔버스 ⑧ 줄

## 변경 사항
- DB(migration 131_attendance_today.sql): 월 근태 본문을 `private.attendance_month_json`으로 묶고 직원 `my_attendance_month`·관리자 `attendance_member_month`(읽기 전용, 같은 회사 멤버만)가 함께 씀. `attendance_day_admin(날짜)`: 관리자만, 멤버 전원·그날 기록·승인 휴가(종류)·근무일 여부·정규 시각
- 계산 `src/lib/attendance/today.ts`: 근무 중·퇴근·출근 전·기록 없음(지난 날)·휴가·쉬는 날·가입/근태 전 — 지각·조퇴 판단 없음, 요약·걸러 보기
- 화면
  - 관리자 메뉴 [근태 승인] → **[근태]**, 설정 쪽 메뉴는 **[근태 설정]**
  - `/admin/attendance` 탭: 오늘 출근 · 승인 대기 · 처리 끝(주소 `?tab=`), 탭 없이 오면 처리할 승인이 있으면 승인 대기·없으면 오늘 출근
  - 오늘 출근: 날짜 이동(지난 3개월 ~ 앞으로 한 달), 정규 시각(참고), 1분마다 새로고침, 요약 칸(전체·근무 중·퇴근·출근 전·휴가) 누르면 걸러 봄, 줄 누르면 그 직원 월 근태
  - 직원 월 근태 `/admin/attendance/member/[memberId]`: 직원 화면과 같은 목록, 보기만(신청·취소 버튼 없음)
  - 관리자 홈 "오늘 출근" 카드 + 승인 대기 바로 가기
- 월 근태 상세: 단말 이름이 없을 때 남던 "·" 제거

## 검증
- tsc / npm run test 67파일 369개 / DB test 083_attendance_today(+079·080·082) / build
- E2E: e2e-today(신규) ALL_OK, e2e-vacation·e2e-leave·e2e-hub ALL_OK, leftovers []
- e2e-attendance는 한국 시간 06시 전이라 스스로 건너뜀(QR 운영 시간) — 승인 탭 흐름은 e2e-vacation으로 확인
- 2026-11-09 07시대 KST 운영에서 e2e-attendance 다시 실행(처음 기록한 '21:44'는 PC 시계를 잘못 읽은 것 — 화면 기준 07:2x): 탭이 링크로 바뀐 것(처리 끝 이동 대기)·처리할 건이 없으면 오늘 출근부터 열리는 것(승인 대기 탭 직접 열기)에 맞게 테스트를 고친 뒤 ALL_OK, leftovers []
- 스크린숏: home-1280, today-1280, today-390, member-1280

## 특이 사항
- 엑셀 내보내기는 하지 않음(결정)
