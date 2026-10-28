# 2026-10-29 사업자번호 국세청 확인 · 영수증별 계정과목(세무사무소) · 랜딩 애니메이션 (D-155·D-156·D-157)

## 구현 대상 (사용자 지시)
- 이제 진짜 사업자등록번호로만 등록, 지금 가짜로 등록된 것은 테스트용 예외
- 6번 A안: 사무소 연결 회사는 영수증별 계정과목 대신 세무사 확인 요청, 조정은 세무사무소
- 랜딩 히어로·미리보기 시연이 안 보이는데 시작해서 끝나 버리지 않게(PC·모바일)

## 변경 사항
- D-155: migration 083(모드 enforce, 기존 미확인 번호 예외 목록 + 상태 bypass — 번호는 DB에서 읽어 넣음). 회사·세무사무소 등록 액션이 오류 때 적은 값을 돌려주고 화면이 `defaultValue`로 유지. DB 테스트 7개(002·007·047~049·051·052)는 트랜잭션 안에서만 확인을 끔(003이 검증 담당). 화면 테스트는 공개 계속사업자 번호(124-81-00998)
- D-156: migration 084(`expense_items.tax_review_*`, `override_item_account_title`이 사무소 관리 회사면 `TAX_OFFICE_MANAGES_ACCOUNTS`, `request_item_tax_review`, `tax_office_override_item_account_title`(승인·지급만, 마감 불가, 요청 처리, 이력 entity item), 세무 자료 행에 `account_title_overridden`·`tax_review_request`·`tax_review_resolved_at`). 회사 결재 화면 `tax-review-cell.tsx`(사무소 관리 표시·요청/고치기/취소·처리 표시), 사무소 세무 자료 `office-item-account.tsx`(고르기·[이대로 확인]) + 요청 안내·노란 메모, 이력 문구, 세무 엑셀 확인 필요. DB 테스트 053
- D-157: `hero-mockup.tsx`(IntersectionObserver → `data-playing`, CSS `animation-play-state`), `ai-simulator.tsx`(가운데 띠에 들어오면 시작, 끝나기 전에 벗어나면 멈추고 처음 상태로, 끝까지 봤거나 직접 고르면 자동 재생 안 함)
- spec: business-verification §3-1, admin-expense-approvals, tax-office §3e, landing-page §3 / decision-log D-155~157, todo 8-8~8-10

## 특이 사항
- 운영(Vercel)에 국세청 조회 키(`NTS_SERVICE_KEY`)가 없으면 조회가 확인 대기로 끝나 형식 검사만 적용된다(로컬에는 있음, 조회 정상 확인: 실제 번호 계속사업자 / 임의 번호 미등록). Vercel 환경변수 확인 필요
- 예외 목록에 들어간 기존 가짜 번호로는 새 회사도 만들어진다(테스트용 예외의 성질). 실제 운영 전에 그 회사를 정리하면 예외 목록에서 빼면 됨
- 사무소의 영수증 계정과목은 세무 자료 행의 이름으로 현재 값을 맞춘다(같은 회사 안 계정과목 이름은 중복 불가)

## 확인
- `npx tsc --noEmit` 통과, `npm run test` 218개 통과
- DB 테스트 053 + 002·003·007·019·025·026·047~049·051·052 통과, 운영 모드 enforce 유지 확인
- `npm run build` 통과
- 화면 E2E `.responsive/live/e2e-d155-156.mjs` 21/21: 형식 틀린 번호 막힘·입력 유지, 국세청 미등록 번호 막힘, 실제 번호 통과(상태 active), 랜딩 390·1280 시연은 안 보일 때 시작 안 함·보일 때 시작, 히어로 보이면 재생, 회사 영수증 계정과목 못 고름·확인 요청, 사무소 안내·세무 엑셀 확인 필요·조정, 회사 화면 확인됨·세무사 조정·이력. 스크린샷 확인
- 회귀: e2e-referral 20/20, e2e-tax-office 34/34(사무소 표 넘침 → 선택 칸 폭 줄여 해결), e2e-batch-d153 14/14, e2e-card-reconcile 12/12, e2e-flow 17 OK. 테스트 회사·사무소 0개 남음(중간에 남은 테스트 회사 1곳은 정리 스크립트로 지움)
