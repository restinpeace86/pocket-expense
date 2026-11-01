# 세무용 엑셀 회계 프로그램 시트 설정 (D-189)

- 구현 일시: 2026-11-01
- 대상: `supabase/migrations/099_export_main_sheet.sql`, `supabase/tests/061_export_main_sheet.sql`, `src/lib/tax/main-sheet.ts`(새로), `src/lib/tax/export-options.ts`(새로), `src/lib/tax/workbook.ts`, `src/app/tax-office/[companyId]/export-options-actions.ts`(새로), `src/components/tax-office/export-settings.tsx`(새로), `src/components/tax-office/tax-office-month-view.tsx`, `src/components/tax-office/default-workbook-info.tsx`, `src/components/tax-office/office-workbook-preview.tsx`, `src/app/tax-office/templates/page.tsx`, `src/app/tax-office/[companyId]/page.tsx`, 두 엑셀 route, 회사 세무 마감 화면(`tax-closing-view.tsx`, `accounting-format-request.tsx`, export page)

## 변경
- DB: `company_tax_offices.card_via_hometax`(기본 true), `tax_offices.main_template_id`(양식 삭제 시 null). 함수 `set_company_card_via_hometax`(그 고객사를 볼 수 있는 사무소 구성원), `set_tax_office_main_template`·`tax_office_main_template_id`(사무소 관리자 / 구성원), `tax_export_options`(회사 관리자·볼 수 있는 사무소 구성원, 연결 없으면 기본값).
- 엑셀: `buildTaxWorkbook({ main })` — `{ kind: "wehago", includeCorporate }` 또는 `{ kind: "template", name, target, columns }`. 위하고: 시트 "위하고 일반전표(사비)" / "(법인카드·사비)". 법인카드 줄은 대변 253 미지급금·거래처 = 카드 별칭·끝 4자리, 금액 = 회사지원금, 개인부담이 있으면 적요 끝 "(개인부담 N원 별도)"(적요 50바이트 안에서). 양식: 양식 이름(31자, 금지 문자 제거) 시트에 머리글 + 양식의 넣을 지출(전체/법인카드/사비).
- 회사 관리자 엑셀(세무 마감·ZIP 장부)과 사무소 엑셀이 같은 설정(`getExportOptions`)을 쓴다. 읽기 실패 시 기본값(받기를 막지 않음).
- 화면: 세무 자료(위하고일 때 체크 + 안내, 양식일 때 안내), 결산 양식(사무소 관리자 고르기 + 안내 + 미리보기가 고른 양식을 따름), 회사 세무 마감 안내·다른 프로그램 안내 문구. 미리보기는 회계 프로그램 시트 탭부터 연다.

## 특이 사항
- 법인카드 개인부담분(직원에게 받을 돈)의 분개는 만들지 않음 — 적요에 금액만 표시(사무소가 처리). 사비와 같은 금액 규칙(회사지원금).
- 양식 시트는 원본 양식 파일의 서식 없이 머리글 + 데이터. 서식까지 필요하면 기존 양식 받기 버튼.
- 다른 프로그램용 양식을 미리 만들지 않는 원칙(8-27·8-28 보류)은 그대로.
