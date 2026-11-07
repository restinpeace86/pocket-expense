# 회의실 예약을 캘린더 안 시트·창으로 (D-234)

- 구현 일시: 2026-11-07
- 구현 대상: 사용자 지시 — 캘린더 [회의실 예약]이 다른 화면으로 넘어가지 않고 캘린더 안 팝업·바텀시트로

## 변경 사항
- `src/components/calendar/rooms-panel.tsx`(새): 휴대폰 바텀시트(92dvh, 손잡이)·PC 큰 창(max-w-6xl). 열 때 기록 한 칸(pushState) → 뒤로 가기 = 닫기, X·바깥·Esc(위에 예약 폼·상세가 떠 있으면 그 창만 닫힘). 회의실 화면은 나중에 받기(dynamic) + 캘린더 열 때 미리 받기.
- `src/components/calendar/room-board.tsx`: `embedded`(닫기 버튼, 주소 안 바꿈, 휴대폰은 제목·X 한 줄 + 날짜 이동 한 줄), `onBooked`(예약·수정·삭제 뒤 캘린더 다시 불러오기).
- `src/components/calendar/calendar-view.tsx`: [회의실 예약] 링크 → 버튼(시트 열기), `initialRooms`(?rooms=날짜&room=).
- `src/app/workspace/[id]/calendar/page.tsx`: `?rooms=`·`room=` 받기.
- `src/app/workspace/[id]/calendar/rooms/page.tsx`: 회의실이 있으면 `/calendar?rooms=…`로 넘김(도우미 답·예전 채팅 링크 유지), 없으면 기존 안내.

## 검증
- tsc · eslint · `npm run test`(318개) · build 통과
- e2e-rooms(로컬·운영) ALL_OK: 캘린더 안 창(주소 그대로) · Esc 닫기 · 예전 주소 → 창 · PC 끌기 예약 · 창 닫으면 뒤 캘린더에 회의 · 휴대폰 뒤로 가기 = 시트만 닫힘 · 시트 안 누르기·꾹 눌러 끌기 예약 · 넘침 없음. e2e-meeting · e2e-assistant ALL_OK. 스크린샷(390·1280) 확인.
