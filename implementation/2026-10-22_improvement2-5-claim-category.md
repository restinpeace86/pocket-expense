# 개선사항(2차) 5 — 지출 카테고리를 결의서 단위로 (D-098)

- 구현 일시: 2026-10-22
- DB (`supabase/migrations/048_claim_category.sql`, 운영 DB 적용)
  - `expense_claims`: `category`, `purchase_type`, `meeting_purpose`, `client_name`, `attendees`, `purchase_purpose`, `purchase_items`, `headcount` 추가. 직원 update 권한 없음 → `set_claim_category()`(security definer, `lock_my_editable_claim`)로만 저장.
  - 트리거 `expense_items_follow_claim_category`(before insert/update): 결의서에 카테고리가 있으면 자차 외 영수증이 항상 결의서를 따름(업로드·AI 다시 읽기·직접 수정 모두).
  - `set_claim_category`: 출장비면 `is_business_trip=true`, 자차 이동이 있으면 출장비 밖으로 변경 거부(`OWN_CAR_ITEMS_EXIST`), 기본 인원이 바뀌면 식대·미팅 영수증 인원에 한 번 반영, 재계산.
  - `private.claim_problems` 재정의: 결의서 칸(`meeting_purpose`, `purchase_type`, `purchase_purpose`), 예전 결의서의 섞인 카테고리(`category`).
- 화면
  - 결의서 맨 위 [지출 카테고리] 4칸 → 고르면 바로 저장. 카테고리별 칸(식대: 기본 인원 / 미팅: 목적·거래처·참석자·기본 인원 / 구매: 세부 유형·목적·품목 / 출장비: 기존 출장 정보 — 출장 경비 스위치는 없앰).
  - 영수증 아코디언: 카테고리 칸 제거(이름만 한 줄), 출장은 세부 유형만, 증빙·결제수단·금액 등 영수증별 칸만. 결의서 카테고리를 아직 안 골랐으면 안내.
  - 제목 자동: `[카테고리] 가맹점 (외 N건)` (`src/lib/expense/title.ts`, 단위 테스트 3개 추가).
  - 예전 결의서 처음 값: 출장이면 출장비, 영수증 카테고리가 하나뿐이면 그것(섞이면 직원이 고름).
- 검증
  - DB 테스트 `supabase/tests/031_claim_category.sql`(예전 결의서 그대로·섞임 검증, 직접 update 차단, 미팅/구매/출장 반영, 영수증 개별 인원 유지, 영수증에서 바꿔도 결의서를 따름, 새 영수증 insert도 따름, 자차 보호, 입력 길이·인원 범위, 같은 회사 다른 직원·다른 회사 차단, 상신 뒤 변경 불가) + 기존 30개 전부 마이그레이션과 함께 통과(test:db 31).
  - tsc / test 131 / lint / build 통과.
  - 로그인 E2E(`.responsive/live/e2e-claim-category.mjs`, 360·390): 섞인 예전 결의서 미선택·안내 → [외부 미팅비] 클릭 → 미팅 칸 0.07초(화면) · 영수증 2장 DB 반영 0.5초(클릭→DB) → 제목 "[외부 미팅비] 메가커피 판교점 외 1건" → 영수증 안에 미팅 목적 칸 없음·인원 칸 있음 → 미팅 목적·거래처·기본 인원 3명 저장 → 영수증 DB 목적·거래처·인원 반영, 펼친 영수증 화면에도 3명 → [회사 물품 구매]로 바꾸고 유형·목적·품목 → 상신 성공(영수증 purchase/pantry, 적요 "탕비실 비품 보충 · 커피 원두") → 자차 있는 출장 결의서는 식대로 못 바꿈. 390 가로 넘침 0. 개선사항 3·4 E2E 재실행 통과. 임시 회사 정리 확인.
  - check:responsive(편집 미리보기 6종 × 4폭) 넘침 없음, 스크린샷 확인.
- 특이 사항: 해석이 들어간 부분 3가지는 D-098에 "확인 필요"로 남김(인원 기본값+영수증별, 품목 선택, 출장 제목 통일).
