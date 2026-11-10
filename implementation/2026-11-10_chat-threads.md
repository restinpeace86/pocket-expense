# 서브 대화(스레드 · 이슈 카드) — 8-98, D-246

- 구현 일시: 2026-11-10
- Spec: `spec/features/improvement-2026-11.md` §A (출처 `implementation/todo_improvement.md` 기능 1)

## 변경 사항
- DB `supabase/migrations/137_chat_threads.sql`
  - `chat_threads`(원글 하나에 하나 — `root_message_id unique`, 제목 1~40자, open/closed, 요약 60자, 글 수·마지막 글), `chat_messages.thread_id`, `chat_thread_reads`(참여자·읽은 시각). 회사 복합 FK, RLS 강제, 표는 함수로만
  - 메인에서 서브 대화 글 빼기: `chat_messages_page`·`chat_room_list`(마지막 글·안 읽은 수)·`chat_unread_total`, 방 순서(last_message_at)도 안 바꿈
  - `chat_message_json`에 `thread_id` + 원글이면 `thread` 카드
  - `chat_send(…, p_thread)` — 종결이면 `THREAD_CLOSED`, 쓴 사람은 참여자
  - `chat_thread_open`(1:1·단체·결의서 방, 글·사진·파일만, 같은 원글이면 기존 것, 참여자 = 만든 사람 + 원글 쓴 사람), `chat_thread_close`/`chat_thread_reopen`(만든 사람·관리자), `chat_thread_detail`, `chat_thread_messages`, `chat_thread_list`, `chat_my_threads`, `chat_my_threads_new`, `chat_thread_mark_read`
  - 볼 수 있는 범위: 메인과 같음(초대받은 단체방은 들어온 뒤 만들어진 것만, `private.chat_can_see`)
  - 웹푸시(`chat_claim_push`): 서브 대화 글은 참여자만, 제목 "방 › 서브 대화 제목", 누르면 그 서브 대화가 열린 방
  - 실시간: `thread`(만들기·종결·다시 열기), `thread_message`(글 + 참여자 목록) — 메인 `message`와 따로라 예전 화면 코드(목록·배지)는 그대로
- 화면
  - `chat-room.tsx` — 서브 대화 모드(`thread` prop: 같은 대화창을 서브 대화 글만, 첨부·보내기·실패 처리 그대로) + 메인 모드: 메시지 메뉴 [서브 대화 만들기]/[서브 대화 보기], 원글 아래 카드(`thread-ui.tsx` `ThreadCard`), 머리글 [서브 대화 n](진행 중 수), 오른쪽 서랍(PC 380px, 메인과 함께 실시간) / 휴대폰 전체 화면 시트, 열리는 서브 대화는 한 번에 하나, `?thread=` 주소로 바로 열기
  - 서브 대화 머리글: [< 목록] · 제목 · 진행 중/종결·인원 · [종결하기](만든 사람·관리자) · [×]. 맨 위 원래 메시지. 종결이면 입력칸 대신 "종결된 대화예요" + 요약 + [다시 열기](권한 있을 때)
  - `thread-ui.tsx` — 만들기 시트(AI 제목 제안, 3.5초 안에 안 오면 원글 첫 줄, 고칠 수 있음), 종결 시트(AI 한 줄 요약, 비워도 됨), 서랍 목록(검색·진행 중/종결·새 글·요약, 실시간 다시 불러옴)
  - `my-threads.tsx` — 채팅 목록 맨 위 [내 서브 대화](새 글 배지) → 모아보기(방 이름·제목·새 글, 진행 중/종결) → 그 방 + 서브 대화
  - 좁은 PC(768~1179px)에서 서랍을 열면 왼쪽 채팅 목록 접음(`globals.css`, `data-chat-list`)
  - PC 시각 알림(8-99)에 서브 대화 글 연결: 참여자만, 그 서브 대화를 보고 있으면 안 뜸, 누르면 그 서브 대화
- AI `src/lib/chat/thread-ai.ts`, `src/app/workspace/[id]/chat/thread-actions.ts` — Gemini flash-lite, 만들 때 1번·종결할 때 1번(결의서 크레딧 아님), 키 없거나 실패하면 빈 값 → 화면이 대신 채움
- 공통 `src/lib/chat/threads.ts`(+ 테스트), `ChatThread` 타입(`format.ts`), 실시간 이벤트 타입(`hub.ts`)

## 검증
- DB `supabase/tests/087_chat_threads.sql`(test:db 전체 통과)
- 화면 `.responsive/live/e2e-threads.mjs` — PC 만들기(AI 제목)·서랍·메인에 안 보임·참여자 PC 알림·참여자 아니면 알림 없음·[내 서브 대화] 새 글 → 열기 → 읽으면 배지·카드 숫자 사라짐·종결(AI 요약) → 다른 사람 카드 실시간·권한 없는 사람 다시 열기 없음·휴대폰 목록 시트·종결 탭·관리자 다시 열기·보내기·[< 목록]·1:1 방 메뉴·1024px 목록 접힘. 회귀 `e2e-visual-alert`·`e2e-chat-read`·`e2e-vault`·`e2e-chat`

## 특이 사항
- 참여자 = 만든 사람 + 원글 쓴 사람 + 글을 한 번이라도 쓴 사람(그냥 열어 본 사람은 아님)
- 다시 열어도 요약은 남겨 두고, 다시 종결할 때 새로 만든다
- 개인정보처리방침(8-93): 메신저 항목에 서브 대화 포함(대화 내용 보관 방식 같음)
