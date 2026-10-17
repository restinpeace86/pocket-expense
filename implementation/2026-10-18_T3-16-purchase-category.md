# T3-16 경비 종류 "회사 물품 구매" 추가

- 구현 일시: 2026-10-18
- 기준: D-076 (D-008 보완), `spec/features/account-titles.md`

## 변경 사항
- DB `024`(enum `expense_category`에 `purchase`, 새 enum `purchase_type`), `025`: `expense_items.purchase_type`·`account_title_mappings.purchase_type`, 분류 제약(출장 ↔ trip_type, 물품 구매 ↔ purchase_type), 매핑 유일 조건을 세부 유형 포함으로 교체, `private.seed_account_defaults`(기본 계정과목 4개 + 매핑 12개, 있으면 건너뜀) — 기존 회사에 적용, `create_company`가 이 함수를 사용
- 테스트: 002(회사 생성 시 계정과목 4·매핑 12, 탕비실→복리후생비, 사무용품·소액 비품→소모품비), 011(물품 구매 매핑은 세부 유형 필수, 출장 세부 유형과 섞기 불가, 중복 불가)
- 화면: 계정과목 매핑 표 12행(회사 물품 구매 3행 추가), 도움말에 물품 구매·고가 비품 안내. `src/lib/expense/categories.ts`에 `purchase`·`PURCHASE_TYPE_LABEL`·`Classification` (+ 단위 테스트)
- 세무사무소 질문 12(외부 미팅비 구분), 13(물품 구매 계정과목·자산 기준) 추가
- 도구: `npm run db:dry -- <마이그레이션> <테스트...>` 추가, CLAUDE.md 2-1단계 절차 보강

## 특이 사항
- `db:migrate`가 024·025를 함께 적용해 025의 드라이런을 건너뜀(같은 실수 2번째). 적용 직후 test:db 11종·기존 회사 매핑을 확인해 문제 없음. 재발 방지로 `db:dry` 명령과 CLAUDE.md 절차(대기 중인 파일이 모두 드라이런을 통과한 뒤에만 migrate, 두 파일로 나눈 경우 순서)를 추가

## 검증
- tsc·test 52·lint·build, test:db 11종, db:types, 반응형 전 화면 4폭
