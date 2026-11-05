# 사진·파일 보관 기간을 회사 파일 전체에 (D-218) — 2026-11-05

- 대상: 사용자 결정 "보관 기간은 채팅 한정이 아니고 회사가 올린 자료 전체(회의 예약 첨부·채팅)"
- 판단: 영수증·증빙은 세무 보관 대상이라 제외(사용자 예시가 채팅·회의 자료). 회의 자료 기준일은 회의 끝난 날(미리 올린 자료 보호).

## 변경
- migration 118: `calendar_event_files.purged_at`, `private.meeting_file_base`, `chat_storage_used`(지운 자료 제외), `chat_retention_status`(회의 자료 포함, 메신저 조건 없앰), `chat_set_attachment_days`(메신저 조건 없앰), `meeting_files_due`·`meeting_files_mark_purged`, 보기·10개 한도에서 지운 자료 제외, 일정 JSON `purged`
- `purge.ts` `purgeMeetingExpired` + 새벽 작업
- 회의 자료 보기·폼: 지운 자료는 흐리게 "보관 기간이 지나 지워졌어요"
- 관리자 설정 [채팅] → [파일 보관](늘 보임), 안내·확인 문구, 약관·처리방침 보관 항목
- 테스트 070(메신저 꺼져도 설정 가능으로 바뀜), 074 새로

## 확인
- tsc, 단위, test:db 070·073·074, build, E2E(`e2e-chattheme` 보관 화면, `e2e-meeting`) — 아래 커밋 기록 참고
