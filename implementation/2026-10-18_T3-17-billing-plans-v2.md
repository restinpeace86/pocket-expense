# T3-17 요금제 개편

- 구현 일시: 2026-10-18
- 기준: D-077 (D-046 가격 대체), `spec/common/pricing-policy.md` §2

## 변경 사항
- DB `026_billing_plans_v2.sql`: `billing_plans.is_unlimited`·`is_featured` 추가, 베이직 삭제, 스타터 150/25,000 · 스탠다드 400/50,000(추천) · 프로 1,000/100,000 · 엔터프라이즈 3,000(무제한 공정 사용)/200,000. 결제 비활성 유지
- 테스트 `012_billing_plans.sql`: 요금제 4종 값, 결제 불가, 로그인 사용자가 읽을 수 있고 바꿀 수 없음. 001의 비로그인 열람 검사를 "개수 = 3"에서 "읽을 수 있음"으로 바꿈(요금제 수가 바뀌어도 깨지지 않게)
- 랜딩 요금 섹션: 4장 카드(휴대폰 1열·태블릿 2열·넓은 화면 4열), 스탠다드 "추천", 장당 가격, 엔터프라이즈 "무제한 · 공정 사용 기준 월 3,000장", "부가세 별도"
- 문서: pricing-policy, admin-billing, schema, overview, landing-page

## 검증
- tsc·test 52·lint·build, db:dry → migrate → test:db 12종 → db:types, 반응형 전 화면 4폭 + 요금 섹션 360·768·1280 스크린샷
