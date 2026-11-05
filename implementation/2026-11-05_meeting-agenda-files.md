# 회의 안건·자료 사전 등록 + 10분 전 알림 카드 (D-217) — 2026-11-05

- 대상: todo_improvement 개선사항 4
- 이미 있던 것: 예약 정보(시간·회의실·참석자, D-207), 참석자 일정 등록(D-206), 10분 전 [알림]방(D-206 — 시스템 방, 사람마다 하나). 이번에 안건·자료와 카드를 더함.

## 변경
- migration 116: `calendar_events.agenda`, `calendar_event_files` + 비공개 버킷 `meeting-files`(정책: 올리기 = 일정 만든 사람, 보기 = 같은 회사 등록 자료, 지우기 = 올린 본인), `chat_storage_used`에 회의 자료 합산, `calendar_event_file_add/delete`, `meeting_files_orphans`, 일정 JSON에 agenda·files, `calendar_save_event`에 agenda, 10분 전 글에 안건 첫 줄·자료 수
- migration 117: 올린 본인은 자기 파일을 볼 수 있게(줄을 먼저 지운 뒤에도 보관함 remove가 되도록 — E2E에서 발견)
- `src/components/calendar/meeting-files.tsx`(새): 고르기·검사·올리기·지우기·보기(서명 주소)
- `calendar-view.tsx`: 폼 [안건 및 자료] 칸(회의 또는 회의실), 저장 뒤 올리기·빼기, 상세 안건·자료, 삭제 시 파일 지우기·확인 문구. `EventEditor`에 `ws`
- `chat-room.tsx`: [알림]방 회의 글 → 카드(`meetingNoticeCard`, 단위 테스트)
- `purge.ts` `purgeMeetingOrphans` + 새벽 작업(`/api/cron/nightly`)
- 관리자 설정 › 채팅 저장 공간에 "채팅 사진·파일과 회의 자료를 함께 세요"

## 확인
- tsc, 단위 299, test:db 073(안건·자료 권한·확장자·경로·저장 한도·합산·다른 회사·취소 연쇄·정리 대상·알림 글), build
- `e2e-meeting`(PC: 회의실 예약 → 안건 + PDF(+ exe 안내) → 상세·새 창 열기, 직원 휴대폰: 상세 안건·자료·수정 없음, 알림 카드 → [안건·자료 보기], 자료 빼기·다시 올리기·회의 삭제 → 줄·파일 모두 지워짐) ALL_OK, `e2e-calendar`(알림 카드로 바뀐 확인)·`e2e-rooms` 회귀, 스크린샷 1280·390 확인
- 특이: 회의 자료는 채팅 보관 기간으로 지우지 않음(요구 사항에 보관 기간 언급 없음 — 회의가 있는 동안 남김). 오래된 회의 자료 정리 규칙이 필요하면 따로 정해야 함.
