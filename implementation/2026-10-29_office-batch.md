# 2026-10-29 세무사무소·정기 결제·증빙 대체 묶음 (D-167~D-173)

## 구현 대상 (사용자 결정)
- 4번: 사무소 기본 계정과목 모든 고객사 자동 + 개별 예외(추천안)
- 6번: 마감하면 세무사무소에 알림톡 + 웹푸시
- 7번: 세무사 → 회사 자료 요청
- 5번: 증빙 없음 → 카드 내역으로 대체 + "영수증 원본 대조 없음" 표시
- 1번: 정기 결제는 카드 내역과 맞을 때만 결의서
- 사무소도 홈택스 자료 올리기
- 2번: 메일 대신 알림톡(솔라피 예정) + 연결 코드 링크 + 세무사무소 소개 페이지
- 3번(계정과목 잠금 기준)은 지금 기준(사무소가 가입해 연결된 순간) 유지 — 변경 없음

## 변경 사항
- migration 091: `company_tax_offices.custom_titles`, `private.apply_office_default_titles`, 기록 트리거가 사무소 직접 수정이면 개별 설정, 연결 트리거, 저장 = 전체 적용, 되돌리기, 기본값 정보에 개별 설정 목록. UI `default-titles.tsx` 다시 씀, 이력 요약 줄
- migration 092: `tax_office_push_subscriptions`, 알림톡 종류 TAX_CLOSED·TAX_REQUEST·TAX_OFFICE_INVITE, `tax_office_requests` + 만들기·답변·상태 함수, `tax_office_notice_targets`. `pushToOfficeMembers`, 사무소 웹푸시 액션·`PushToggle office`, `notifyOfficeClosed`(마감 액션 after), `notifyCompanyRequest`·`notifyOfficeAnswered`, `tax-requests.tsx`(사무소·회사), 관리자 홈 배너
- migration 093: `expense_items.evidence_substitute`, `substitute_card_evidence`, 세무 자료 행에 칸 추가(084 함수 복사 + 한 칸). 대조 화면 [카드 내역으로 증빙 대체], 확인 필요 문구, 결재 화면 배지
- migration 094·095: `recurring_payments.merchant_keyword`, `create_recurring_claim_from_card`(같은 달(연) 판단은 예전 방식 포함), `recurring_personal_due`(결제일 당일만). `lib/cards/reconcile.ts` `matchRecurring`·`recurringReport`(+test), 대조 화면 [정기 결제로 처리]·못 찾은 정기 결제, cron은 자동 생성 대신 개인카드 결제일 알림, 정기 결제 설정 칸·설명
- migration 095: `hometax_uploads.uploaded_by_kind`, 사무소 올리기·지우기 함수, 회사 지우기는 회사가 올린 것만. `lib/hometax/upload.ts` 공통, `HometaxFiles` viewer·액션 props
- migration 095: `company_tax_offices.connect_code`(사무소 바뀌면 새 코드), `tax_office_connect_info`(로그인 전), `connect_tax_office_by_code`, `my_company_tax_office_code`. `/for-tax-office`·`/for-tax-office/[code]`(소개), `/tax-connect/[code]`(연결), 등록 액션이 연결 코드 처리, 로그인 next 허용, 회사 화면 링크·안내 문구, 저장 때 초대 알림톡, 랜딩 푸터 [세무사무소]
- DB 테스트 055(다시 씀)·058·059 추가, spec tax-office §3g·3i, tax-closing §3g, notification-rule §2-y / decision-log D-167~D-173 / todo 8-20

## 특이 사항
- 알림톡은 모두 발송 대행사(솔라피) 연결 전이라 기록·콘솔만(O-01). 웹푸시는 실제 발송
- 사무소 구성원 휴대폰은 등록 때 선택이라, 없으면 마감 알림톡은 "번호 없음"으로 기록만 남고 웹푸시만 간다
- 정기 결제로 만든 결의서는 그 카드 결제와 짝이 맞으므로 다시 대조하면 "결의서 없음"에서 빠진다
- 세무 자료 함수(084)를 093에서 다시 정의했다 — 이후 그 함수를 고칠 때는 093을 기준으로

## 확인
- `npx tsc --noEmit`·eslint 통과, `npm run test` 237개 통과(정기 결제 매칭 3개·마감 알림 문구 등)
- DB 테스트 055·058·059 + 전체 `test:db` 통과
- `npm run build` 통과
- 화면 E2E `.responsive/live/e2e-office-batch.mjs` 34/34: 기본값 저장=B 즉시 적용·기본값 사용 표시·개별 설정 목록·되돌리기 / 대조: 증빙 대체·정기 결제 표시·못 찾은 정기 결제·정기 결제 결의서·알림 기록·다시 대조하면 짝 맞음(390 넘침 없음) / 결재 화면 배지 / 사무소 홈택스 올리기·회사 화면 표시·회사 못 지움 / 자료 요청→알림 기록→회사 홈 배너→답변(390)→사무소 해결 / 마감→TAX_CLOSED 기록 / 연결 코드·초대 알림톡 기록·소개 페이지(로그인 전, 390)·잘못된 링크·다른 이메일 계정으로 등록과 함께 연결. 스크린샷 확인
- 회귀: e2e-tax-office 34/34(안내 문구 기대값을 연결 링크로 갱신), e2e-improve3 24/24(일괄 적용 단계를 자동 적용으로 갱신), e2e-batch4 30/30(푸터 링크 갱신), e2e-hometax 18/18, e2e-card-reconcile 12/12, e2e-tax-governance 20/20, e2e-tax 정상. 테스트 회사·사무소 0개
