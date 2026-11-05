# 회의실 예약 전용 화면 (D-215) — 2026-11-05

- 대상: todo_improvement 개선사항 2 (회의실 예약 페이지, PC 타임라인·휴대폰 세로, 10분 칸 끌기, 캘린더 연동)
- 연동: 예약은 D-207부터 "회의실 붙은 캘린더 일정"이라 별도 동기화 로직 없이 저장 즉시 캘린더에 보임 — 점검만, 바꾼 것 없음.

## 변경
- 새 화면 `src/app/workspace/[id]/calendar/rooms/page.tsx` + `src/components/calendar/room-board.tsx`(Track: 가로/세로 한 컴포넌트, 포인터 이벤트로 누르기·끌기, 손가락은 0.28초 꾹 누른 뒤, 끄는 동안 touchmove preventDefault, 떼면서 창을 열면 뒤따르는 click을 touchend preventDefault로 막음 — 막 열린 창 배경을 눌러 닫히던 문제)
- 잡힌 막대는 pointer-events 없음 + 칸 계산으로 상세 열기(손가락 '가까운 버튼 잡기' 때문에 막대 바로 아래 빈 칸을 눌러도 막대가 열리던 문제)
- `calendar-view.tsx`: [회의실 현황] 창 → [회의실 예약] 링크, `EventEditor`(endTime 추가)·`EventDetail`·`Sheet` 내보내기
- `src/lib/calendar/calendar.ts`: 칸 계산 함수 + 단위 테스트 5개
- 관리자 회의실 설정 안내 문구

## 확인
- tsc, 단위 297, build, `e2e-rooms`(PC 마우스 끌기 10:00~11:00, 휴대폰 누르기 1시간, 잡힌 칸 → 상세, CDP 꾹 눌러 끌기 14:00~14:40, 캘린더에 보임, 넘침 없음) ALL_OK, `e2e-calendar`·`e2e-eventclaims` 회귀 ALL_OK, 스크린샷 1280·390 확인.
