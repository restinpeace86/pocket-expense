# 사내 메신저 (D-203)

- 구현 일시: 2026-11-03
- 기준: `spec/features/messenger.md`
- 대상: `supabase/migrations/106_messenger.sql`, `107_chat_claim_owner.sql`, `supabase/tests/065_messenger.sql`(새로, test:db 등록), `src/lib/chat/format.ts`(+ test), `src/lib/chat/server.ts`, `src/app/workspace/[id]/chat/*`(layout·page·[roomId]·actions), `src/components/chat/*`(chat-app·hub·room-list·chat-room·member-picker·avatar·claim-chat-button·use-chat-unread), `src/components/employee/employee-shell.tsx`, `src/components/admin/admin-shell.tsx`, 직원·결재·관리자 layout, 소명서 상세 3곳(직원·관리자·결재자) + `employee-claim-detail.tsx`·`admin-claim-detail.tsx`, `public/sw.js`

## 변경
- DB: 회사별 기능 스위치 `company_features`, 대화방·참여자·메시지 표, 쓰기 전부 definer 함수, 참여자별 비공개 실시간 주제, 첨부 버킷 `chat-files`.
- 화면: 카톡형 목록·대화방(PC 두 칸, 휴대폰 한 화면), 1:1·그룹·소명서 대화, 사진·파일, 읽음 숫자, 안 읽은 수·메뉴 배지(실시간), 삭제·복사, 초대·이름·나가기, 실패 시 다시 보내기.
- 웹푸시: 보낸 뒤 서버 동작이 한 번만, 보고 있는 대화방은 알림 생략(서비스 워커).

## 특이 사항
- Supabase 빌더(`supabase.rpc`)는 then을 불러야 요청이 나간다 — 읽음 처리가 안 나가던 것을 E2E에서 발견해 고침.
- 작성자 본인이 소명서 대화를 열면 같은 사람이 두 번 들어가 실패 → migration 107(distinct), DB 테스트에 추가.
- 이 프로젝트에서 Realtime을 처음 써서 `realtime.messages` 날짜 파티션이 없었음 → 실시간 연결 한 번으로 Supabase가 만듦(운영에서도 연결이 생기면 자동).
- 스위치가 꺼진 주소는 스트리밍 중 notFound라 응답 코드는 200, 화면은 "찾는 화면이 없어요"(다른 워크스페이스 화면과 같음).
- E2E: `.responsive/live/e2e-chat.mjs` 31항목(대표 PC 1280 ↔ 직원 휴대폰 390), 스크린샷 `.responsive/e2e/chat/`.
- 페이퍼컴퍼니만 스위치를 켜 둠(사용자 확인용).
