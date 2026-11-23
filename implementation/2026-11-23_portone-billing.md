# 정기결제 PG를 포트원 V2 + KG이니시스로 — D-312 (B-4f)

- 구현 일시: 2026-11-23
- 변경 사항
  - `src/lib/billing/portone-format.ts`(+ test): 인증 헤더, 카드 표시, 결제 번호·카드 등록 번호(영문·숫자), 빌링키 확인(구매자 ID 일치·ISSUED), 결제 요청 응답(카드사 거절 PG_PROVIDER는 재시도 안 함), 결제 조회(PAID·금액 일치)
  - `src/lib/billing/server.ts`: `portoneReady`, `verifyBillingKey`(GET /billing-keys), 빌링키 결제(POST /payments/{id}/billing-key + Idempotency-Key → GET /payments/{id}로 영수증·거래 번호). 이니시스는 결제 때 구매자 이름·이메일·전화가 필요해 카드 등록 때 넣은 값을 빌링키 조회에서 그대로 씀(DB 추가 없음)
  - `admin/billing/card/route.ts`: `?billingKey=`(PC는 화면이, 휴대폰은 포트원이 붙임) → 포트원에 다시 확인 → 저장·예약·결제. `?code=`면 실패 안내로
  - `actions.ts` prepareBillingAction: 상점 아이디·채널 키·구매자(회사 이름, 관리자 로그인 이메일, 내 정보 휴대폰)
  - `subscription-actions.tsx`: `@portone/browser-sdk@0.1.13` `requestIssueBillingKey`(CARD, issueId·issueName, 제공 기간 1개월, redirectUrl). 그만두면 조용히, 실패면 이유
  - `@tosspayments/tosspayments-sdk`·`toss-format.ts` 삭제, `.env.example` 키 3개로
- 특이 사항: DB·화면·결제 규칙(D-298) 그대로. 키가 없으면 모든 회사 '결제 준비 중'(운영 그대로). 이니시스 테스트 결제창 E2E는 사용자가 테스트 채널 키를 넣은 뒤(B-4h). 휴대폰 리디렉트 쿼리 이름은 문서에 명시가 없어 `billingKey`/`code`/`message`로 받고, 어떤 값이 와도 서버가 포트원에 다시 확인하므로 위조 빌링키는 저장되지 않음
- 검증: tsc · vitest 522 · build · 로컬 e2e-billing-prod(키 없음: 결제 준비 중, 실패 코드 → 돌아옴, 가짜 빌링키 저장 안 됨, 비로그인 → 로그인) ALL_OK · leftovers []
