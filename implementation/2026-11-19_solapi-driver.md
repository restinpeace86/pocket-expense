# 솔라피 알림톡 연동 미리 만들기 (D-297, 2026-11-19)

## 구현 대상
- 사용자: 솔라피 가입·사업자 정보 등록(심사 중, 영업일 1~2일) — "지금 상태에서 솔라피 사전에 연동 로직 만들 수 있어?"
- todo T8-3(실제 발송 드라이버)·9-40(결재 알림 받는 곳 카드). 대행사 = 솔라피(O-01 선정)로 보류 해제, 실제 발송은 환경변수 뒤

## 변경 사항
- `src/lib/notify/solapi-format.ts`(+test): 인증 머리글(HMAC-SHA256 date+salt), 본문(`send-many/detail`, `kakaoOptions{pfId, templateId, variables{"#{이름}"}, disableSms:true}`), 응답 읽기(접수 실패·4xx 재시도 안 함, 5xx·429·연결 실패 1회 재시도)
- `src/lib/notify/sender.ts`: `solapi` 드라이버 · `alimtalkReady(codes)` — 키·pfId·템플릿 ID가 없으면 보내지 않고 실패 기록
- `src/lib/notify/channel.ts`: `KAKAO_CODES` = 결재 요청·반려·완료. 결재 완료 push → fallback. 독촉·세무 자료 요청은 켜 있어도 앱 안만
- `src/lib/notify/dispatch.ts`: 회사 확인을 `alimtalk_active` DB 함수로(요금제 포함 + 스위치)
- `supabase/migrations/169_alimtalk_plan_switch.sql`: `billing_plans.alimtalk_included`(프로·비즈니스), `alimtalk_status()`·`alimtalk_set_enabled()`(관리자, 스타터 거절 ALIMTALK_PLAN), `alimtalk_active(회사)`(service_role만)
- `supabase/tests/104_alimtalk_plan_switch.sql`(test:db 추가)
- 설정 › 기능 사용: `src/components/admin/alimtalk-switch.tsx` '결재 알림 받는 곳' 카드(앱 알림·채팅 늘 + 카카오톡 스위치 + 예시), `features/actions.ts`, `src/lib/notify/alimtalk-status.ts`

## 켜는 방법(사용자, 심사 통과 뒤)
Vercel 환경변수: `ALIMTALK_DRIVER=solapi`, `ALIMTALK_API_KEY`, `ALIMTALK_API_SECRET`(솔라피 콘솔 › API Key), `ALIMTALK_SENDER_KEY`(연동한 카카오 채널 pfId), `ALIMTALK_TEMPLATE_APPROVAL_REQUEST`·`ALIMTALK_TEMPLATE_APPROVAL_REJECTED`·`ALIMTALK_TEMPLATE_APPROVAL_COMPLETED`(템플릿 ID), 선택 `ALIMTALK_FROM` → 재배포 → 설정 › 기능 사용에서 켜기

## 특이 사항
- 결과는 "솔라피 접수"까지만 안다(카카오 도착 여부는 솔라피 콘솔 발송 내역). 웹훅으로 도착 결과 받기는 범위 밖
- 초대 2종(INVITE·TAX_OFFICE_INVITE)은 늘 알림톡 길이지만 템플릿 ID가 없으면 실패로 기록(링크 복사로 보냄). 심사 받으면 그대로 나감
- 검증: tsc · test 495 · DB 104 · build · 로컬/운영 E2E(e2e-alimtalk-card: 심사 전 잠김·켜짐이면 끄기·직원 못 봄·390/1280 넘침 없음)
