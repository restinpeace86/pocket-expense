# 캘린더 켜기·끄기(관리자) + 관리자 채팅 머리글 아이콘 (D-208)

- 구현 대상: 관리자가 앱에서 캘린더를 켜고 끄기, 관리자 왼쪽 메뉴의 [채팅]을 머리글 아이콘으로
- 구현 일시: 2026-11-04
- 근거: 사용자 결정 2026-11-04("꺼져 있으면 켜는 곳이 앱 안에 있어야", "메뉴에서 빼고 위쪽 아이콘으로"), `spec/features/calendar.md` §10, `spec/features/messenger.md` §9, decision-log D-208

## 변경 사항
- DB `supabase/migrations/111_calendar_admin_switch.sql`: `calendar_set_enabled(boolean)`(관리자·자기 회사, company_features calendar 줄 upsert)
- 화면
  - 설정 메뉴 [회의실] → **[캘린더·회의실]**(`/admin/calendar-settings`, 늘 보임): 맨 위 `CalendarSwitch`(끌 때 확인 창, [캘린더 열기]), 아래 회의실(꺼져 있으면 안내만)
  - `admin-shell.tsx`: 왼쪽 메뉴의 [채팅] 삭제, 머리글 말풍선 아이콘을 PC에도(오른쪽 끝, 안 읽은 수 배지)
- 테스트: `supabase/tests/068_calendar_admin_switch.sql`(test:db 추가), E2E `e2e-rooms`(꺼짐에도 메뉴 → 스위치 켜기 → 메뉴·직원 홈 카드 생김 → 끄기 → 다시 켜기 회의실 그대로), e2e-chat·calendar·viewmode·tabbar 머리글 아이콘으로 고침, 모두 ALL_OK

## 특이 사항
- 운영 회사(페이퍼컴퍼니)의 스위치는 켜지 않았다 — 관리자가 설정 › 캘린더·회의실에서 직접 켠다.

## 추가 (D-209): 직원 캘린더 진입을 하단 탭으로
- `EmployeeTabBar`에 [캘린더] 탭(채팅과 내 정보 사이, 캘린더 스위치가 켜졌을 때만, 공통 레이아웃이 `calendarEnabled()`를 넘김). 직원 홈 [캘린더] 카드와 `calendar-home-card.tsx`·`nextUpcoming` 삭제.
- E2E e2e-calendar(탭으로 진입·탭 선택 표시·홈 카드 없음), e2e-rooms(켜면 탭 생김) ALL_OK.
