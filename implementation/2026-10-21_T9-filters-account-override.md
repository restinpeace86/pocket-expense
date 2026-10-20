# 지출 승인 관리 필터 + 항목별 계정과목 조정

- 구현 일시: 2026-10-21
- 기준: `spec/screens/admin-expense-approvals.md` §4.A·§4.C, `spec/features/account-titles.md` §4, `spec/data/expense-lifecycle.md` §7·§8, D-036·D-045

## 변경 사항
- DB `035_account_title_override.sql`: `override_item_account_title(항목, 계정과목 또는 null)` — 관리자 이상, 같은 회사 항목·계정과목만, 세무 마감 항목 불가(ITEM_CLOSED), 계정과목 외 값은 그대로, null이면 분류 기준(매핑)으로 되돌리고 조정 표시 해제
- 테스트 `019_account_title_override.sql`: 직원 불가, 다른 회사 불가(항목·계정과목 모두), 마감 항목 불가, 조정(금액 그대로) → 되돌리기
- 관리자 승인 상세: 영수증 행마다 계정과목 고르기(+ "자동(분류 기준)으로 되돌리기"), "계정 조정됨" 배지, 마감 항목은 비활성
- **고침**: 직원 소명서 상세·검토자 결재 화면·영수증 패널에서 계정과목을 보이지 않게 함(account-titles.md §4 "직원과 결재자 화면에는 보여 주지 않는다" — 앞 단계에서 보이고 있었음)
- 지출 승인 관리 필터: 검색(제목·가맹점명), 월(영수증 사용일자 기준), 카테고리, 부서, 직원(퇴사자 포함) — 주소에 남아 탭·목록·상세 이동 때 유지, 적용 중이면 건수 배지·펼침. 서버에서 거르고(같은 회사, RLS), 검색어의 특수 문자는 제거
- `src/lib/claims/filters.ts`(필터 해석, 단위 테스트), `filter-options.ts`

## 검증
- tsc·test 83·lint·build, 035 db:dry → migrate → test:db 19종 → db:types, 검색 필터 문법을 실제 DB로 확인, 반응형 전 화면 4폭 + 승인 상세 PC(계정과목·필터)·직원 상세 휴대폰(계정과목 없음) 스크린샷
