# 2026-11-20 정기결제 연동(토스페이먼츠 자동결제, 테스트 키) — D-298

## 구현 대상
- B-4 결제 연동(보류 해제, 사용자 2026-11-20). 실제 계약·가입비는 첫 유료 고객 전으로 미룸

## 변경 사항
- DB(migration 170, test 105): `billing_subscriptions`(관리자만 읽음) · `billing_keys`(서버만) · `billing_payments`(관리자만 읽음) · `credit_ledger` 이유 `plan_grant`
  - 관리자: `billing_state` · `billing_prepare` · `billing_change` · `billing_set_cancel`
  - 서버: `billing_card_saved` · `billing_charge_info` · `billing_payment_result` · `billing_due` · `billing_close` · `billing_monthly_grant` · `billing_upload_blocked`
  - `effective_plan`·`storage_total_limit` = 결제 중이면 구독 요금제
  - 결제 열기: `app_settings.billing_mode`(기본 test) + `billing_test_companies`(쉼표 구분 회사 id)
- 서버: `src/lib/billing/server.ts`(토스 API·결제·매일 처리) · `toss-format.ts` · `checkout.ts subscriptionCharge` · `state.ts`
- 카드 등록 성공 경로: `/workspace/[id]/admin/billing/card`(GET, 그 회사 관리자만)
- 화면: 요금제 [내 구독] 카드·결제 버튼·구성 바꾸기·해지·미납 안내·결제 내역, 관리자 홈 미납 배너
- 업로드 멈춤: 영수증 올리기 시작·서류 변환 전에 `billing_upload_blocked`
- cron morning(07:00 KST): `runBilling`
- 패키지: `@tosspayments/tosspayments-sdk` 2.10.0(카드 등록창)

## 검증
- tsc · 단위 테스트 · DB 테스트 105(미리 실행·운영) · build
- 로컬 E2E `e2e-billing` ALL_OK — 토스 테스트 카드 등록창으로 결제·예약·카드 바꾸고 결제, 390·1280 넘침 없음, 화면 캡처 확인

## 특이 사항
- 운영 사이트에서 결제가 보이려면 Vercel에 `NEXT_PUBLIC_TOSS_CLIENT_KEY`·`TOSS_SECRET_KEY`(·`TOSS_SECURITY_KEY`) + 결제 열 회사 id를 `billing_test_companies`에 넣어야 함(운영자 SQL)
- 웹훅은 아직 안 씀(자동결제 승인은 바로 응답). 보안 키는 웹훅 붙일 때 사용
- 남은 결정: 운영 키 전환 시 무료 기간이 끝났는데 결제하지 않은 회사 처리, 카드 결제분 세금계산서(매출전표로 갈음 여부)
