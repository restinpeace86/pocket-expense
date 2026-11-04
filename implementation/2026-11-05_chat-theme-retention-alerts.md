# 채팅 색감·PC 새 창(D-211) / 보관 기간(D-212) / 알림 길 나누기(D-213)

- 구현 대상: 계정별 채팅 색감, PC 채팅 새 창, 회사별 채팅 사진·파일 보관 기간 30·60·90일, 앱 알림 먼저·알림톡 최소, 알림 기본 켜기 안내
- 구현 일시: 2026-11-05
- 근거: 사용자 결정 2026-11-05, `spec/features/messenger.md` §10, `spec/screens/notification-rule.md` §0, decision-log D-211~D-213

## 변경 사항
- DB `supabase/migrations/113_chat_theme_retention.sql`: `members.chat_theme`(+ `my_membership`), `company_chat_settings`, `private.chat_attachment_days`, `chat_storage_status`(회사 기간), `chat_retention_status`·`chat_set_attachment_days`(관리자), `chat_files_due`(회사마다 그 기간)
- 채팅 색감: `src/lib/chat/theme.ts`, `globals.css` `--chat-*` 변수(html[data-chat-theme]), `chat-room.tsx`·`claim-chat-button.tsx` 색을 변수로, `chat-theme.tsx`(내 정보 카드·목록 팔레트·계정 맞추기), `app/layout.tsx` 첫 화면 전 적용, `theme-actions.ts` `saveChatThemeAction`
- PC 새 창: `chat/popup.ts`(창 이름 pe-chat), `room-list.tsx` [새 창으로 열기](PC만), 새 창에서는 하단 메뉴·워크스페이스로 숨김(`employee-bottom-nav.tsx`, `chat-app.tsx`)
- 보관 기간: 관리자 설정 › [채팅] `admin/chat-settings`(메신저 켜진 회사만 메뉴), `chat-retention.tsx`(사용량 막대 + 30·60·90, 줄일 때 확인), 약관·처리방침·요금제 문구
- 알림: `src/lib/notify/channel.ts`(길 표·앱 알림 문구), `dispatch.ts` `notifyMembers`(앱 알림 먼저 → 못 받은 사람만 알림톡, 닿은 건 webpush 기록), 월말 마감·세무 마감 완료는 앱 알림만, `push/server.ts` 받은 멤버 목록, `push-auto-prompt.tsx`(워크스페이스 공통 레이아웃)
- 기타: 캘린더 설정 안내 문구 "직원 홈 카드" → "직원 하단 [캘린더] 탭"(D-209 반영 누락분)
- 테스트: `supabase/tests/070_chat_theme_retention.sql`(test:db 추가), 단위 `channel.test.ts`·`format.test.ts`, E2E `.responsive/live/e2e-chattheme.mjs` ALL_OK(색감 3종·다른 기기 동기화·팔레트·PC 새 창·알림 안내·관리자 보관 기간·직원 접근 막힘·메신저 꺼짐), e2e-chat·calendar·tabbar·viewmode·eventclaims ALL_OK

## 특이 사항
- 브라우저 정책상 알림을 사이트가 혼자 켤 수 없다 — "기본 켜짐"은 자동 등록(이미 허용) + 첫 진입 안내로 구현.
- 헤드리스 크롬은 알림 권한이 처음부터 '막힘'이라 E2E는 '아직 안 물어봄'으로 바꿔 안내를 확인했다. 기존 E2E는 안내를 '나중에' 누른 상태(쿠키)로 시작.
- 실제 알림톡 발송 드라이버(B-3)는 보류 그대로 — 지금은 기록만.
