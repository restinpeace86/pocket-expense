# 영수증 문제 한눈에 — 칩 줄 (D-195)

- 구현 일시: 2026-11-01
- 대상: `src/lib/tax/export-rows.ts`(`IssueKind`·`issueKinds`·`ISSUE_LABEL`·`rowHasFile`), `src/components/tax/issue-chips.tsx`(새로), `src/components/tax-office/tax-office-month-view.tsx`, `src/app/tax-office/[companyId]/page.tsx`, `src/components/admin/tax-closing-view.tsx`, `src/components/tax-office/office-workbook-preview.tsx`, `src/components/tax-office/default-workbook-info.tsx`, `src/lib/tax/issue-kinds.test.ts`

## 변경
- 문제 종류 = 기존 `checks()` 규칙(회사 확인 요청 처리 전, 경조사비 초과, 사업자번호 없음, 부가세 미구분, 증빙 없음 / 파일 없음 — 카드 내역 증빙 대체는 제외, 자차).
- 칩 줄: 주황 테두리 "확인할 영수증 N건 · 누르면 그 영수증만" + 종류별 칩(빨강: 회사 확인 요청·증빙 없음). 사무소는 링크(`?month=&issue=#expenses`), 회사는 버튼(바로). 없으면 초록 안내.
- 지출 표·카드: 문제 줄 주황 배경, 고르면 그 영수증만 + 제목 옆 "고른 문제만 N건".
- 엑셀 미리보기: 문제 영수증의 줄은 ⚠(title에 문제 설명) + 주황.

## 다음
- 8-45 영수증 대화(공유 메모) — 사용자 승인, 칩 다음 순서.
