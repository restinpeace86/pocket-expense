# 직원 홈 = 허브 개편 (D-235)

- 구현 일시: 2026-11-08
- 구현 대상: spec/screens/worker-dashboard.md §0·§3·§4·§5 (사용자 시안 확인: 캔버스 "WORKON 직원 홈 시안")

## 변경 사항
- `src/components/employee/employee-hub.tsx`(새로): 메뉴 칸(`hubTiles` — 지출결의·정산·결재함(사전 검토자)·회의실(캘린더+회의실)), "오늘 · 내 현황"(오늘 내 일정 최대 3개·사비 정산 대기금·반려), 공지(있을 때만). PC는 왼쪽 메뉴 칸+공지 / 오른쪽 현황.
- `src/app/workspace/[id]/employee/page.tsx`: 허브 데이터(요약·공지·결재함 배지·캘린더 스위치·회의실·오늘 일정). 예전 `?month=`/`?status=` → `/employee/claims`로 redirect.
- `src/app/workspace/[id]/employee/claims/page.tsx`(새로) + `claims-list-view.tsx`(예전 `employee-home-view.tsx`를 옮김): 제목 "지출결의"·← 홈, 월 이동·상태 필터·목록·하단 [영수증 찍고 지출 올리기]. 사비 정산 대기금 카드는 홈으로.
- 하단 바(`employee-shell.tsx` `EmployeeTabBar`): 홈·캘린더·[+ 결의서 쓰기]·채팅·내 정보. 정산·결재함 탭 제거(→ 홈 메뉴 칸). `inbox` 배지는 홈에서만 읽어 레이아웃 4곳의 결재함 조회를 없앰.
- `createDraftClaimAction`: 무료 사용량 소진 + 이벤트 꺼짐이면 만들지 않고 안내(가운데 버튼이 어느 화면에서든 눌리므로 서버에서 확인).
- 헤더 회사명 = 지금 모드의 홈 링크.
- 링크 경로 정리: 도우미(내 결의서·새 결의서·반려/작성 중 목록), 독촉 알림톡·정기결제(개인카드)·마감 알림 → `/employee/claims`.
- dev 미리보기: `employee-home` = 허브, `employee-claims`·`employee-home-empty/blocked/rejected` = 목록.

## 검증
- tsc / `npm run test` 61 files 322 tests / build 통과
- 로컬 E2E `e2e-hub.mjs` ALL_OK(꺼짐·켬 메뉴 칸, 오늘 일정, 공지 숨김/표시, 가운데 버튼 → 새 결의서, 예전 주소 넘김, 회의실 칸 → 예약 창, PC 2단, 관리자 직원 모드 결재함 칸 없음, 넘침 없음), 스크린샷 확인(390 기본·켬·목록, 1280)
- 기존 `e2e-assistant`·`e2e-rooms` ALL_OK, `e2e-calendar`는 탭 순서 기대값을 D-235에 맞게 고친 뒤 ALL_OK

## 특이 사항
- 근태 켠 회사의 가운데 [QR 출퇴근]·근태/휴가 칸·남은 연차 줄은 근태 구현 때(attendance-draft §7).
- 메뉴 칸은 3열 고정이라 칸이 2개면 오른쪽 한 칸이 빔(시안과 같음).
