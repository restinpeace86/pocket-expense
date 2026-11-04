# 회의실 설정·예약 + 직원 모드 채팅 하단 메뉴 + 알림 받는 조건 (D-207)

- 구현 대상: 관리자 회의실 설정, 캘린더 회의실 예약(현황·겹침 막기), 관리자 [직원 모드]에서 채팅·캘린더 틀, 알림 받는 조건 안내(ⓘ)
- 구현 일시: 2026-11-04
- 근거: 사용자 지시 2026-11-04, `spec/features/calendar.md` §9, decision-log D-207

## 변경 사항
- DB `supabase/migrations/110_meeting_rooms.sql`: `meeting_rooms`(RLS 강제·표 권한 없음), `calendar_events.room_id` + exclusion(btree_gist), 함수 `calendar_rooms`·`calendar_room_bookings`·`calendar_room_save`·`calendar_room_reorder`·`calendar_room_delete`, `calendar_save_event`(room_id, ROOM_TAKEN·ROOM_ALL_DAY·ROOM_NOT_FOUND), `calendar_event_json`에 room, 10분 전 안내 장소 = 회의실 이름
- 화면
  - 관리자 설정 › 회의실 `src/app/workspace/[id]/admin/meeting-rooms/*`, `src/components/admin/meeting-rooms-view.tsx`(부서 화면과 같은 틀), 메뉴는 캘린더 켜진 회사만
  - `calendar-view.tsx`: [회의실 현황] 시트(하루 단위, 방별 [예약]), 만들기에 회의실 칸("예약됨" 막기, 겹치면 안내 + 저장 꺼짐), 상세·목록에 회의실 이름
  - `src/lib/calendar/calendar.ts`: `placeLabel`, `roomConflict`, `nextUpcoming`(+테스트)
  - 모드: `src/lib/auth/view-mode.ts` + `ViewModeMark`(헤더) → `chat/layout.tsx`·`calendar/layout.tsx`가 모드로 틀 선택
  - `PushHelp`(push-toggle.tsx): 내 정보·관리자 설정·세무사무소 알림 칸, 채팅 목록 안내 줄
- 테스트: `supabase/tests/067_meeting_rooms.sql`(test:db 추가), E2E `.responsive/live/e2e-rooms.mjs` ALL_OK, e2e-calendar·e2e-chat ALL_OK

## 특이 사항
- PC 채팅 하단 메뉴가 사라진 원인: 채팅 틀이 계정 역할(관리자)만 보고 하단 메뉴를 뺐음 — 관리자 계정이 [직원 모드로 전환] 후 들어간 경우. 일반 직원 계정은 원래 정상.
- 홈 캘린더 카드의 `Date.now()` lint 오류(react-hooks/purity)를 `nextUpcoming`으로 옮겨 정리.

## 추가 수정 (같은 날, 사용자 재보고: "직원 모드 → 하단 [채팅] 누르면 하단 메뉴 사라짐")
- 1차 수정(f72f460)은 서버에서만 모드를 골라, 화면 전환 캐시에 남은 앞 모드의 채팅 틀이 그대로 쓰일 수 있었다. 게다가 f72f460은 Vercel 자동 배포가 시작되지 않아 운영에는 반영되지 않았다(GitHub에는 올라감, Vercel 배포 기록 없음).
- 이제 모드는 브라우저에서 고른다: `useViewMode`(view-mode-mark.tsx) → `ChatApp`·`CalendarShell`(캘린더 틀). 서버 값은 처음 그릴 때만.
- 쿠키는 화면이 실제로 열릴 때만(헤더의 ViewModeMark) 남긴다 — proxy에서 남기면 [직원 모드로 전환] 링크 미리 불러오기 요청이 모드를 바꿔 버려서 뺐다.
- 확인: `.responsive/live/e2e-viewmode.mjs`(관리자 → [직원 모드로 전환] → 하단 [채팅] 클릭 → 하단 메뉴 있음 / 관리자 모드로 돌아가 채팅 → 없음), Chrome·Edge × 1280·390 ALL_OK.
- 보강: [직원 모드로 전환]·[관리자 모드로 전환]을 누르는 순간 바로 모드 기록(ModeSwitchLink) — 전환 직후 바로 [채팅]을 눌러도 맞는 틀(e2e-viewmode에서 대기 없이 클릭, Chrome·Edge ALL_OK).
