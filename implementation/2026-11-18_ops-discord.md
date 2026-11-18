# 운영자 디스코드 실시간 알림 (D-293)

- 구현 일시: 2026-11-18
- 구현 대상: 신규 회사 가입·의견·저장 공간 추가 신청·회계 양식 맞춤 요청·후기 → 운영 디스코드 채널 카드

## 변경 사항
- 새 `src/lib/ops-notify/format.ts`: 알림 카드 만들기(종류별 제목·색·링크, 요약 100자·개인정보 모양 가림, smoke-e2e 회사 '🧪 테스트') + 테스트 5개
- 새 `src/lib/ops-notify/server.ts`: 웹훅 주소(DISCORD_OPS_WEBHOOK_URL → DISCORD_WEBHOOK_URL), `notifyOps`는 응답 뒤(after)에 보냄
- 연결: `onboarding/actions.ts`(회사 만들기 성공 직후) · `feedback/actions.ts` · `admin/billing/actions.ts`(저장 공간 신청·후기 설문) · `admin/export/format-actions.ts`
- 정리: 예전 `notifyFeedback`·`notifyFormatRequest`·`feedbackNotifyText`(보낸 사람 이름 포함) 지움, 저장 용량 70% 경고도 운영 채널로

## 검증
- tsc · 단위 테스트 491 · build 통과
- 로컬 E2E: e2e-feedback(오래된 문구·머리글 검사 2개 현재 화면에 맞게 고침) · e2e-survey · e2e-format-request 모두 통과, leftovers []

## 특이 사항
- 웹훅 주소는 사용자가 Vercel에 넣음(코드·저장소에 없음)
- 회사 만들기 E2E는 사업자번호 확인이 있어 따로 돌리지 않음 — 카드 모양은 단위 테스트로 확인
