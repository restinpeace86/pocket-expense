# 웹푸시 다듬기 (D-214) — 2026-11-05

- 대상: todo_improvement 개선사항 1 (메신저 푸시·진동, 누르면 대화방, 기기별 켜고 끄기)
- 조사: 운영 DB에서 채팅 메시지마다 `pushed_at`이 찍히고 구독 `last_sent_at`이 갱신됨 → 서버 발송은 성공. 늦게/안 뜨는 원인은 urgency normal(안드로이드 절전 시 미뤄짐), 누르면 못 들어가는 원인은 열린 창 주소가 다르면 새 창만 열던 클릭 처리.

## 변경
- `public/sw.js`: 진동 패턴(120·80·120) / 꺼짐이면 silent, 같은 방 한 장 묶기 + 다시 울림, timestamp. 클릭: 같은 주소 창 → focus, 우리 창 → focus + navigate, 없으면 openWindow.
- `src/lib/push/server.ts`: `PushPayload.urgency`, 구독별 `vibrate`를 실어 보냄.
- 채팅(`chat/actions.ts`)·회의 10분 전(`api/cron/reminder-push`) = urgency high. 채팅 내용 `oneLine`(60자 …, `src/lib/chat/format.ts` + 테스트).
- `push-toggle.tsx`: 켜져 있으면 [알림 올 때 소리·진동] 스위치(`getPushVibrateAction`/`setPushVibrateAction`), 서비스 워커 `update()`로 새 버전 받기, ⓘ 안내에 PC 백그라운드 실행·바로가기 불필요·소리·진동 줄.
- `chat-room.tsx`: 방에 들어가면 그 방 알림 닫기.
- migration 114 `push_subscriptions.vibrate` + 본인 update 정책, 테스트 071.

## 확인
- tsc, 단위 292, test:db 071, build, E2E `e2e-push`(새 headless — 옛 headless는 알림을 띄우지 않음) ALL_OK, `e2e-chat`·`e2e-chattheme` 회귀 ALL_OK, 스크린샷 390 확인.
- 특이: 알림 클릭 자체는 자동화로 누를 수 없어 코드로만 확인 — 실제 휴대폰에서 눌러 확인 필요. 안드로이드 8+는 진동 모양을 OS 채널 설정이 덮을 수 있음.
