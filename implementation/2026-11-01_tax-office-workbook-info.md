# 결산 양식 화면 — 지금 고객사에 나가는 양식 (D-185)

- 구현 일시: 2026-11-01
- 대상: `src/lib/tax/workbook.ts`(`taxWorkbookLayout`, `CARD_HEAD`), `src/components/tax-office/default-workbook-info.tsx`(새로), `src/app/tax-office/templates/page.tsx`, `src/components/tax-office/tax-office-shell.tsx`, `src/lib/tax/workbook.test.ts`

## 변경
- [결산 양식] 맨 위 "지금 고객사에 나가는 양식": 우리 사무소 양식 수·이름(없으면 기본 엑셀로만 받는다는 안내) + 기본 세무용 엑셀 시트 6개, 시트마다 설명과 접어 둔 칸 이름(번호순).
- 칸 이름은 엑셀 정의에서 그대로 읽는 `taxWorkbookLayout()` — 카드 대조 시트 머리글을 `CARD_HEAD` 상수로 뺌(동작 같음).
- 왼쪽 메뉴 묶음 이름 "사무소" → "사무소 설정".

## 검증
- 단위 테스트: 실제로 만든 엑셀의 시트 순서·각 시트 1행 머리글 = `taxWorkbookLayout()`(카드 대조 시트는 머리글이 아래쪽이라 시트 이름만).
