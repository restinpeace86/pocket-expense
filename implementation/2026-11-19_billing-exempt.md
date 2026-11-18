# 운영사 결제 면제 (D-294)

- 구현 일시: 2026-11-19
- 구현 대상: 다모은랩(사업자번호 548-23-02343)으로 가입하는 회사를 결제 대상에서 뺌

## 변경 사항
- migration 167: `companies.billing_exempt` · `private.billing_exempt_business_numbers`(면제 번호) · 회사 만들 때 트리거(면제 번호 + 그 번호의 첫 회사 → 면제, 무료 기간 없음, 영수증 상한 100만) · `effective_plan` 면제 = pro(비즈니스) · `storage_total_limit` 면제 = 비즈니스 용량
- migration 168: 167에서 다시 만든 `company_trial_defaults`에 빠진 security definer 되돌림(운영 키로 회사 넣는 자동 점검이 막혔음, 실제 가입은 정상이었음)
- DB 테스트 `103_billing_exempt.sql`(test:db 끝에 붙임) — 첫 회사만 면제·두 번째·일반 회사 아님·요금제/저장 공간/양식 칸·권한·트리거 definer
- 화면: 요금제(운영사 카드만, 남은 크레딧 '제한 없음', 저장 공간 추가 안내 뺌) · 관리자 홈 '운영사 계정' · 운영자 회사 화면 배지

## 검증
- tsc · 단위 테스트 491 · build · DB 테스트 통과
- E2E `e2e-billing-exempt`(테스트 회사에 면제를 켜서 확인, 1280·390 넘침 없음) 로컬·운영 통과, leftovers []

## 특이 사항
- 실제 다모은랩 회사는 사용자가 직접 가입하면 그때 자동으로 면제된다(가입·온보딩은 다른 회사와 같음)
