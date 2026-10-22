# 개선사항(2차) 9 — 추가 카테고리·계정과목 (D-102)

- 구현 일시: 2026-10-22
- DB (운영 DB 적용)
  - `050_extra_categories_enum.sql`: `expense_category`에 team_dinner·condolence·seminar·books·training·company_car·saas 추가(enum 값은 같은 트랜잭션에서 못 써서 파일 분리).
  - `051_extra_categories.sql`: `private.seed_account_defaults`에 도서인쇄비·차량유지비·지급수수료와 추가 카테고리 매핑 7개를 더하고 기존 회사에도 실행(있으면 건너뜀). 금액은 기존 `private.item_amounts` 규칙 그대로 → 1식 한도 없이 전액 지원.
  - 테스트 `supabase/tests/033_extra_categories.sql`(매핑 9개·이미 있는 도서인쇄비 재사용·두 번 실행해도 그대로·회식비 25만 원 5명 전액 지원·식대로 바꾸면 한도 다시·추가 필수 칸 없음), `002_onboarding_isolation.sql` 기본 개수 4→7 / 12→19 갱신. test:db 33 통과.
  - 참고: `npm run db:migrate`는 인자와 상관없이 남은 마이그레이션을 모두 적용해 050·051이 함께 적용됐다(051은 다시 실행해도 같은 결과).
- 화면·코드: `categories.ts`(라벨·`MAIN_CATEGORIES`·`EXTRA_CATEGORIES`·매핑 표 19행), 결의서 맨 위 4칸 아래 접힌 [그 밖의 경비] 칩 7개, 아이콘, 지출 사유 표준 문구 7개, 필터·저장 액션 허용 목록.
- 검증
  - tsc / test 138 / lint / build 통과, check:responsive(결의서 3종·계정과목·직원 홈·결재 상세 × 4폭) 넘침 없음.
  - 로그인 E2E(`.responsive/live/e2e-extra-categories.mjs`, 360·390): [그 밖의 경비]에서 회식비·세미나·SaaS·회사차량 선택 → 영수증 카테고리 반영, 25만 원 5명도 회사 지원 250,000/개인 0 → 상신 → 계정과목 복리후생비·도서인쇄비·지급수수료·차량유지비. 관리자 계정과목 화면에 추가 분류 7개, 가로 넘침 0. 임시 회사 정리 확인.
- 특이 사항: 가정 3가지는 D-102에 "확인 필요"로 남김.
