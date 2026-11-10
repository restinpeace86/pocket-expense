# PC 무소음 시각 알림(토스트 + 가장자리 빛) — 8-99, D-246

- 구현 일시: 2026-11-10
- Spec: `spec/features/improvement-2026-11.md` §B (출처 `implementation/todo_improvement.md` 기능 2)

## 변경 사항
- DB `supabase/migrations/136_chat_visual_alert.sql` — `members.chat_visual_alert`(기본 켜짐, 본인만 바꿈 — 컬럼 권한), `my_membership`에 함께 실음
- `src/lib/chat/visual-alert.ts`(+ 테스트) — 띄울지(켜짐·PC 폭 768px 이상·화면 보임·내 글 아님·안내 줄 아님·그 방을 보고 있지 않음), 내용 한 줄(사진·파일은 웹푸시와 같은 말, 알림방은 카드 제목), 같은 방 합치기(+n)·최대 3장
- `src/components/chat/visual-alert.tsx` — 워크스페이스 공통 레이아웃(메신저 켜진 회사, 관리자·직원 모두)에 하나. 기존 실시간 연결(`subscribeChat`)을 같이 씀(연결 추가 없음). 방 이름은 처음 한 번 `chat_room_list`로 받아 둠
  - 오른쪽 아래 토스트: 3초 뒤 사라짐, 마우스 올리면 멈춤, 같은 방 새 글이면 한 장에서 내용·숫자만 바뀜, 누르면 그 대화방, [×] 닫기, `role="status"`
  - 가장자리 파란빛: 0.25초 켜짐·꺼짐 2번(약 1초), 클릭 막지 않음, 1.5초 안에 또 오면 다시 안 켬, 움직임 줄이기 설정이면 안 그림(`globals.css`)
  - 결재 고정 버튼 줄·카카오톡 문의 버튼(D-127, `data-kakao-fab`)이 있으면 그 위로
  - 채팅 새 창(PC 팝업)에서는 안 띄움
- 설정 `src/components/chat/visual-alert-toggle.tsx` — 직원 [내 정보] 'PC 화면 알림' 카드, 채팅 목록 위 팔레트(채팅 색감) 안 아래쪽(관리자도). 바꾸면 계정 저장 + 열린 화면에 바로 반영(`workon:visual-alert` 이벤트). 저장 `saveVisualAlertAction`

## 검증
- 단위 `src/lib/chat/visual-alert.test.ts`
- 화면 `.responsive/live/e2e-visual-alert.mjs` — PC 토스트·빛·1초 뒤 빛 사라짐·3초 뒤 토스트 사라짐·마우스 올리면 유지·같은 방 +1·누르면 그 방·그 방 보는 중엔 안 뜸·휴대폰 안 뜸·끄기 저장 후 안 뜸·직원 [내 정보] 카드. 회귀 `e2e-chattheme`·`e2e-chat-read`

## 특이 사항
- 창이 가려졌거나 최소화돼 있으면 띄우지 않음(그때는 웹푸시)
- 서브 대화(8-98) 글도 만들면 같은 규칙으로 뜨게 연결할 것(서브 대화 패널을 보고 있으면 안 뜸)
