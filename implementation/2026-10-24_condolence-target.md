# 구현 기록 — 경조사비 내부(임직원) / 외부(거래처) (D-123)

- 구현 일시: 2026-10-24
- 근거: 사용자 결정(경조사비 = 내부/외부 구분, 같이 만들기), `project/decision-log.md` D-123

## 변경 사항
- migration `062_condolence_target.sql`
  - `expense_claims`·`expense_items`·`account_title_mappings`에 `condolence_target`(internal/external), 매핑 유일 조건에 포함, 경조사비만 대상 필수(check)
  - 기존 경조사비 매핑·결의서·영수증 → external(계정과목 그대로), 모든 회사에 internal → 복리후생비 매핑 추가
  - 재정의: `seed_account_defaults`, `item_follow_claim_category`(영수증이 결의서 대상을 따름), `set_claim_category`(+ `p_condolence_target`), `submit_claim`·`override_item_account_title`(매핑 조인에 대상), `claim_problems`(대상 필수, 외부면 거래처명 필수)
- 테스트 `supabase/tests/042_condolence_target.sql`, `002`·`033` 기대값 갱신(매핑 22줄, 경조사비 2줄)
- 화면: 직원 결의서 경조사비 → [내부 · 임직원]/[외부 · 거래처] + 외부면 거래처명, 상신 막힘 문구, 관리자 결의서 상세에 대상·거래처, 관리자 계정과목 화면 2줄(`MAPPING_ROWS`, `setMappingAction`)

## 검증
- tsc·lint·unit 175·DB 42·build·check:responsive 통과
- E2E `.responsive/live/e2e-condolence.mjs`: 대상 안 고르면 상신 막힘 → 외부 + 거래처명 상신 → 영수증 계정과목 기업업무추진비 / 내부 상신 → 복리후생비
- 회귀: claim-category, round4, company-fields 통과

## 특이 사항
- 실제 회사의 기존 경조사비(있다면)는 외부로 표시되고 계정과목은 그대로다.
