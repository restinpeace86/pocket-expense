# 결산 양식 화면 — 지금 고객사에 나가는 양식 (D-185)

- 구현 일시: 2026-11-01
- 대상: `src/lib/tax/workbook.ts`(`taxWorkbookLayout`, `CARD_HEAD`), `src/components/tax-office/default-workbook-info.tsx`(새로), `src/app/tax-office/templates/page.tsx`, `src/components/tax-office/tax-office-shell.tsx`, `src/lib/tax/workbook.test.ts`

## 변경
- [결산 양식] 맨 위 "지금 고객사에 나가는 양식": 우리 사무소 양식 수·이름(없으면 기본 엑셀로만 받는다는 안내) + 기본 세무용 엑셀 시트 6개, 시트마다 설명과 접어 둔 칸 이름(번호순).
- 칸 이름은 엑셀 정의에서 그대로 읽는 `taxWorkbookLayout()` — 카드 대조 시트 머리글을 `CARD_HEAD` 상수로 뺌(동작 같음).
- 왼쪽 메뉴 묶음 이름 "사무소" → "사무소 설정".

## 검증
- 단위 테스트: 실제로 만든 엑셀의 시트 순서·각 시트 1행 머리글 = `taxWorkbookLayout()`(카드 대조 시트는 머리글이 아래쪽이라 시트 이름만).

## D-186 보완 (같은 날)
- 사용자: "엑셀 파일 포맷대로 보여주길 바랬다(차변·대변 2줄 형태)" → 칸 이름 목록을 **엑셀 모양 미리보기**로 바꿈.
- `src/lib/tax/sample-rows.ts`: 예시 지출 3건(법인카드 식대 33,000 / 사비 택시 12,500 / 사비 사무용품 22,000). 실제 회사 데이터 아님.
- `taxWorkbookPreview(rows)`: `buildTaxWorkbook`으로 실제 파일을 만든 뒤 ExcelJS로 다시 읽어 시트마다 위쪽 12줄을 글자로. 금액 서식(#,##0) 칸만 쉼표, 날짜는 YYYY-MM-DD.
- 화면: 시트 탭 + 열 문자(A·B·C) + 줄 번호 + 첫 줄 머리글 강조, 표 안에서만 가로·세로 스크롤.
- 단위 테스트: 위하고 일반전표(사비) 미리보기 = 여비교통비 차변 / 미지급금 대변 / 소모품비 차변 / 미지급금 대변, 연도 "2026".

## D-187 세무 자료 화면 미리보기 (같은 날)
- `taxWorkbookPreview(opts, maxRows)`가 `buildTaxWorkbook`과 같은 옵션을 받게 바꿈(예시·실제 자료 공용).
- `WorkbookViewer`(엑셀 모양 표)를 `default-workbook-info.tsx`에서 분리해 두 화면이 같이 씀.
- `src/components/tax-office/office-workbook-preview.tsx`: 그 회사·그 달 자료(다운로드와 같은 회사명·마감 여부·카드 대조)로 위쪽 20줄, 접힌 상태로 시작. 페이지에서 Suspense로 감싸 나머지 화면을 늦추지 않음. 승인된 지출이 없으면 안 보임.

## D-188 접힌 상태 눈에 띄게 (같은 날)
- 접힌 [세무용 엑셀 미리보기]: 초록 테두리·배경, 초록 아이콘, "YYYY년 M월 세무용 엑셀 미리보기", "받기 전에 확인 · 지출 N건 · 시트 N개", 초록 [펼쳐 보기] 버튼. 펼치면 흰 배경 + [접기].
