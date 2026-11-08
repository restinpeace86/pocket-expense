# 근태 ④ 월 근태 현황 (D-237)

- 구현 일시: 2026-11-08
- Spec: `spec/features/attendance.md` §5 (승인) · 시안 캔버스 "근태 1단계 시안" ④ 줄

## 변경 사항
- DB(migration 125_attendance_month.sql): `my_attendance_month(p_month)` — 본인·본인 회사 기록만, 근태 꺼지면 FEATURE_DISABLED, 근무 요일·그 달 공휴일·"기록 없음" 시작일(근태 처음 켠 날과 가입 승인일 중 늦은 날)·출퇴근 단말 이름
- `src/lib/attendance/month.ts`: buildMonth(목록·요약), monthLabel, shiftMonth, minutesLabel (테스트 8개)
- 화면 `/workspace/[id]/employee/attendance?month=`: 요약 카드 · 날짜 목록 · 날짜 상세 창(Esc·바깥 누르면 닫힘) · PC는 같은 목록을 넓게. 근태 꺼지면 404, 미래 달은 이번 달로
- 직원 홈 메뉴 칸 [근태](근태 켠 회사만)

## 검증
- tsc / npm run test 63파일 338개 / DB test 079_attendance_month / build
- E2E e2e-attendance(월 근태 단계 추가) ALL_OK, e2e-hub ALL_OK, leftovers []
- 스크린숏: month-390, month-day-390, month-1280

## 특이 사항
- [정정 신청] 버튼은 ⑤(8-89)까지 비활성("곧 열려요")
- 휴가 일수는 ⑦ 때 요약에 추가
