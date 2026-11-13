# 세무사무소 현황판·일괄 처리 + 세무 알림방 (9-18·9-19, D-268·D-269)

- 구현 일시: 2026-11-13 (migration 157 운영 적용: 사용자 승인 "migration 153~157" 범위 — 현황판과 알림방을 157 하나로)
- Spec: `spec/screens/tax-office.md`, 시안 https://claude.ai/artifact/Ler67tzj8iWouxoFjo8jMg ④⑤⑥

## 변경 사항
- DB `157_office_dashboard_room.sql`: `office_client_checks`·`office_set_client_check`, `tax_office_requests.acked_at·acked_by_name`·`company_ack_tax_request`, `tax_office_client_status` 칸 추가(영수증 없는 지출·승인 대기·홈택스·마지막 올림·사무소 확인·회사 확인 수), `chat_rooms.office_id`(알림 방 고유 = 회사·사람·사무소), `chat_messages.office_request_id`, `chat_notice_room`(개인 방만)·`chat_office_room`·`office_room_post`(서버)·`tax_office_send_notice`·`tax_office_notice_list`, `chat_message_json`(요청 상태)·`chat_room_detail`(office_id)
- DB 테스트 `096_office_dashboard_room.sql` + 기존 062·065·076·058·063·087을 157과 함께 돌려 확인
- 세무사무소: `src/lib/tax-office/dashboard.ts`(+test), `office-dashboard.tsx`, `/tax-office` 화면, `bulk-actions.ts`, `src/lib/tax/office-bulk-zip.ts`, `zip-client.ts`(`ZipSink`·prefix — 기존 한 곳 ZIP은 그대로), 왼쪽 메뉴 고객사 목록(`tax-office-shell.tsx`·layout), 요청 목록 "회사 확인함"
- 알림: `dispatch.ts` 자료 요청·답변 → 세무 알림방(`office_room_post`), 요청 만들 때 사무소·요청 번호 전달
- 채팅: `office-request-actions.tsx`(카드 버튼), `chat/office-actions.ts`, `chat-room.tsx`(입력칸 안내·카드), `roomTitle`(알림 방 이름)
- E2E `.responsive/live/e2e-office-dashboard.mjs`

## 확인
- tsc · test 82/455 · lint · build · DB 096(+관련 6개) · db:types, `e2e-office-dashboard.mjs` 로컬 ALL_OK(1440·390, ZIP 폴더 확인), `e2e-threads.mjs` ALL_OK, 스크린샷 확인(휴대폰에서 마감 완료인데 빨강이던 것 → 회사 답을 기다리는 요청은 빨강에서 뺌), leftovers []

## 특이 사항
- 사무소 공지 기록 함수(`tax_office_notice_list`)는 만들었고 화면 표시는 아직(요청 시 고객사 화면에 붙임)
- 여러 곳 ZIP은 기존 한 곳 ZIP과 같은 내용을 따로 만드는 함수(`addOfficeCompany`)로 — 한 곳 ZIP의 [못 받은 영수증 다시 받기]는 고객사 화면에서
