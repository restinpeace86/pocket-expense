# 핵심 알림도 앱 안으로 + 카카오 알림톡 회사 스위치 — 8-101, D-247

- 구현 일시: 2026-11-10
- 근거: 사용자 지시 2026-11-10, `spec/screens/notification-rule.md` §0·§0-3(D-247 반영)

## 변경 사항
- `src/lib/notify/dispatch.ts` `notifyMembers` — 회원에게 가는 알림은 모두(초대 제외) 웹푸시 + 채팅 [알림]방 카드. 결재 요청(→ 결재자)·반려(→ 신청자)·미제출 독촉·세무사무소 자료 요청이 새로 카드로 들어감
- `src/lib/notify/channel.ts` `needsAlimtalk(code, pushed, alimtalkOn)` — '앱 알림을 못 받으면 알림톡'은 회사가 카카오 알림톡 추가 서비스를 켰을 때만. 초대 2종은 그대로 알림톡
- DB `supabase/migrations/138_alimtalk_switch.sql` — `company_features`에 'alimtalk' 추가(줄 없으면 꺼짐, 운영자만 켬)
- 알림 이력: 앱 안으로 간 핵심 알림은 provider `webpush`(기기 알림 닿음) / `chat`([알림]방 카드만) — 관리자 [알림 이력] 문구 "앱 알림 + 채팅으로 보냄" / "채팅 [알림]방으로 보냄"
- 의견 보내기: 구분 '기능 요청' → '기능 개선'(설명 "이렇게 바뀌면 좋겠어요"), 안내 "개선 의견은 긍정적으로 검토해 …", 버그 "확인 후 최대한 빨리 처리할게요"

## 검증
- 단위 `src/lib/notify/channel.test.ts`(스위치 꺼짐 = 알림톡 없음, 켜짐 + 못 받음 = 알림톡)
- 화면 `.responsive/live/e2e-noticecards.mjs`(반려 카드 + 알림톡 기록 없음), `e2e-feedback.mjs`

## 특이 사항
- 카카오 알림톡 추가 서비스(49,000원·89,000원 요금제, 8-102)는 보류 — 켜는 화면·요금은 그때 Spec
- `.responsive/live/e2e-flow.mjs`는 홈 개편(D-235) 전 E2E라 '영수증 찍고 지출 올리기' 단계에서 멈춤(이번 변경과 무관)
