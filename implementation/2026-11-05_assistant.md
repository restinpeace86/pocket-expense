# WORKON 도우미 방 1단계 (D-222) + 로고 (D-221) — 2026-11-05

## 도우미
- migration 120: `chat_rooms.kind 'assistant'` + `assistant_member_id`, `chat_messages.kind 'bot'`, 방 종류별 글 막기 트리거, `chat_assistant_room()`
- `src/lib/assistant/intent.ts`(규칙 알아듣기·날짜·AI 값 거르기 + 테스트), `answer.ts`(Gemini 분류, 일정·회의실·결의서·승인 대기·화면 열기 답)
- `chat/actions.ts`: 도우미 방 글이면 웹푸시 대신 답(하루 30번, 같은 글 한 번), `openAssistantRoomAction`
- 화면: 목록 맨 위 고정 줄, 방 안내·예시 버튼, bot 말풍선 + [열기] 버튼, "확인하고 있어요…", 사진·파일 버튼 없음
- 확인: tsc, 단위 308, test:db 075, build, `e2e-assistant`(목록·예시 버튼·회의실 빈 시간·일정·결의서·직원 승인 대기 없음·못 하는 일(Gemini)·화면 열기·하루 30번·관리자 승인 대기·390/1280) ALL_OK

## 로고
- `src/components/brand/logo.tsx`(Wordmark·StackedLogo·LogoMark), 머리글·로그인·랜딩·앱/탭 아이콘·공유 이미지

## 8-60 ②
- 사용자가 Vercel·Vault 비밀값 등록 → 실제 pg_cron 작업이 smoke 회의를 처리, [알림]방 2건, pg_net → `/api/cron/reminder-push` 200 `{"ok":true,"messages":2}` 확인(테스트 계정은 기기 구독이 없어 sent 0)
