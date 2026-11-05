# 결의서 쓰기에서 캘린더 출장·외근 불러오기 (D-216) — 2026-11-05

- 대상: todo_improvement 개선사항 3 (이중 입력 방지, 정산 작성 시 캘린더 일정 원클릭 채우기, 캘린더 등록 필수 여부 검토)
- 검토 결론: 캘린더 등록은 필수로 하지 않는다. 캘린더에 먼저 적었으면 결의서에서 눌러 채우고(이번), 캘린더 일정에서 바로 결의서를 만들 수도 있다(D-210). 어느 쪽이든 한 번만 적는다.

## 변경
- migration 115: `calendar_my_trip_events()`(내 출장·외근, 60일 전~30일 뒤, 가까운 순 20개), `claim_link_calendar_event()`(연결·끊기 + 채울 값)
- `src/components/calendar/trip-event-picker.tsx`(새): 목록·누르면 채우기·연결 끊기·캘린더 꺼지면 안 그림
- `claim-editor.tsx`: 출장 정보 칸 위에 picker(작성 중·반려만), 채우면 기존 자동 저장
- `getMyClaimForEdit`·`EditorClaim`에 `calendar_event_id`
- 테스트 072(목록 범위·순서·장소, 채울 값, 시간 외근 하루, 끊기, 회의·참석자 아님·상신·남의 결의서·다른 회사·캘린더 꺼짐)

## 확인
- tsc, 단위 297, test:db 072, build, `e2e-tripfill`(휴대폰 390: 목록·채우기·저장·연결 줄·외근 바꾸기·끊기, PC 1280, 캘린더 꺼짐) ALL_OK, `e2e-eventclaims` 회귀, 스크린샷 확인.
- 특이: 외근 전용 경비 카테고리는 없음(기획 변경이 필요해 만들지 않음) — [출장비]에서 불러옴.
