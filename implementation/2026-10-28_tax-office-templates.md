# 2026-10-28 세무사무소 월말 결산 양식 (D-150, todo 8-4 · T10-4)

## 구현 대상
- 사용자 지시(2026-10-28): 회계 프로그램 양식도 일단 현재 기준으로 최대한. 세무사무소가 양식을 올리면, 그 사무소를 쓰는 회사들의 월말 결산 자료를 그 양식 기준으로 채워서 주기
- 그동안 "양식 파일 입수 후"로 보류였던 O-02·T10-4를 이 방식으로 해결

## 변경 사항
- DB(migration 077): 비공개 보관함 `tax-office-templates`, `tax_office_templates`(RLS 강제), 칸 검사 `private.valid_template_columns`, 함수 `save_tax_office_template`·`delete_tax_office_template`(사무소 관리자)·`tax_office_template_list`(구성원)·`my_company_tax_templates`(회사 관리자)·`tax_template_for_export`(내려받기 권한)
- 항목 규칙 `src/lib/tax-office/template-fields.ts`(+test): 항목 28개(비워 두기·고정값 포함), 머리글 자동 추정(같은 이름 > 시작 > 포함, 두 글자 이하는 정확히 같을 때만, 한 항목은 한 칸만), 넣을 지출 고르기, 초안 2종
- 엑셀 `src/lib/tax-office/template-workbook.ts`(+test): 머리글 줄 찾기, 올린 파일에 채우기(머리글 위 줄·서식 유지, 예시 줄 지움), 초안은 새 파일, 내려받기 응답
- 사무소: `/tax-office/templates`(`template-manager.tsx` — 올리기·초안·칸 연결·고치기·지우기), 머리글 메뉴 [결산 양식], 고객사 세무 자료 화면에 [결산 양식으로 받기](`template-downloads.tsx`), `/tax-office/[companyId]/template`
- 회사: 세무 마감 화면에 "[사무소] 결산 양식으로 받기", `/workspace/[id]/admin/export/template`
- spec: tax-office §3a·§4, tax-closing §3a, schema 2.1a6, routes / decision-log D-150, O-02 갱신, todo T10-4·8-4

## 특이 사항
- 초안 2종은 reference.md에서 확인된 칸만 쓴 것이라 실제 프로그램 양식과 다를 수 있음(화면에 안내). 프로그램 코드 칸(유형·공제여부·거래구분)은 비워 두고 고정값으로 넣을 수 있게 함. 일반전표 차변·대변 나누기는 하지 않음(회계 규칙을 임의로 만들지 않음)
- (보완, D-151) .xls(예전 엑셀)도 지원: SheetJS 0.20.3(공식 배포처)으로 .xls → .xlsx로 바꿔 보관·칸 연결, 원본이 .xls인 양식은 받을 때 .xls(BIFF8)로. 서식은 값 위주. migration 078
- 올린 뒤 [취소]하면 보관함에 파일이 남을 수 있음(저장하지 않은 양식, 사무소 폴더 안). 지운 양식의 파일은 함께 지움
- 회사 관리자가 직접 결산 양식을 올리는 기능은 요청 범위 밖이라 넣지 않음
- 세무사무소 내려받기 기록은 여전히 범위 밖(제안 4-1 ①)

## 확인
- `npx tsc --noEmit` 통과, `npm run test` 208개 통과(양식 항목·엑셀 테스트 10개 추가)
- DB 테스트 `048_tax_office_templates.sql` 통과(세무사 저장 불가·이름/칸/중복/대상/다른 폴더 검사·고치기·10개 제한·테이블 직접 접근 불가·사무소 = 고객사만·세무사 = 배정 뒤에만·다른 사무소 불가·회사 관리자 = 연결된 사무소 양식만·직원 불가·연결 끊으면 불가·지우기)
- `npm run build` 통과
- 화면 진입 E2E `.responsive/live/e2e-tax-template.mjs` 19/19: 결산 양식 화면·.xls 안내·양식 올리기 → 칸 자동 연결(구분코드는 비워 두기) → 고정값·법인카드만 → 저장·초안 저장 → 사무소 세무 자료에서 받기(제목 줄 유지·법인카드만·고정값·파일명) → 초안 양식(머리글 + 2건) → 회사 세무 마감에서 받기 → 직원·다른 회사·연결 안 된 회사 404 → 지우면 파일·버튼 사라짐. 390·1280 넘침 0, 스크린샷 확인. 테스트 회사·사무소 0개 남음(중간에 한 번 멈춰 남은 테스트 데이터는 `cleanup-tax-template.mjs`로 지움)
- 회귀: e2e-tax-office 34/34, e2e-referral 20/20, e2e-flow 17 OK
- (보완 D-151) 단위 테스트 210개(.xls 왕복·엑셀 아닌 파일 2개 추가), DB 테스트 048 통과, 빌드 통과, 화면 E2E 22/22(엑셀 아닌 .xls 안내·진짜 .xls 올리기 → 칸 자동 연결·저장 → .xls로 받기: 형식(OLE)·제목 줄·채운 값·파일명 "_마감전.xls")
