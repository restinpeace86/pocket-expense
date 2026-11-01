# 고객사 현황 마감 상태 + 엑셀 미리보기 줄별 영수증 (D-193)

- 구현 일시: 2026-11-01
- 대상: `supabase/migrations/101_office_client_status.sql`, `supabase/tests/062_office_client_status.sql`, `src/app/tax-office/page.tsx`, `src/lib/tax/workbook.ts`(+ test), `src/components/tax-office/default-workbook-info.tsx`, `src/components/tax-office/office-workbook-preview.tsx`, `src/app/tax-office/[companyId]/page.tsx`

## 변경
- DB `tax_office_client_status(month)`: 볼 수 있는 고객사(관리자 전체·세무사 배정)마다 그 달 마감 여부·시각, 자료 요청 open(회사 답변 대기)·answered(회사 답변 옴) 수. 회사 사람·잘못된 달은 빈 결과·INVALID_MONTH.
- 고객사 현황: 지난달 기준 요약 한 줄 + 카드별 배지, 카드 링크에 `?month=`.
- 미리보기: `taxWorkbookPreview`가 시트 줄마다 항목 id(`items`)를 함께 — 엑셀을 만드는 순서(지출내역 = rows, 업로드 = 법인/사비 필터, 위하고 = 두 줄 같은 항목, 양식 = 넣을 지출). `WorkbookViewer`는 `links`가 있으면 줄 번호 옆 돋보기(새 창). 사무소는 페이지가 이미 만든 서명 주소, 회사는 미리보기 안에서 보이는 줄의 영수증만 서명.

## 특이 사항
- 서명 주소는 10분. 자차 경로 캡처(route_card_path)는 돋보기에 넣지 않음(영수증 사진만).

## D-194 영수증 팝업 (같은 날)
- 돋보기 = 버튼 → `ReceiptModal`(어두운 전체 화면). 이전·다음은 같은 영수증이 이어지는 줄을 한 번만 거침. Esc·바깥·←/→. PDF는 iframe. [새 창] 링크는 선택.
