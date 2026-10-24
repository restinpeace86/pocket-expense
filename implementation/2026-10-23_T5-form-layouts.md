# 구현 기록 — 지출결의서 양식 고르기 + 종이 양식 촬영(AI) (D-118, T5-R)

- 구현 일시: 2026-10-23
- 근거: 사용자 지시(받은 양식 reference/지출결의서_포맷1.hwp·지출결의서_양식.xls·지출결의서 양식.pdf를 보고 기본 포맷을 만들어 고르게, 직접 찍어서 양식 세팅, "우리 데이터가 커버할 수 있는 한도 내에서"), `project/decision-log.md` D-118
- Spec: `spec/features/form-template.md` §0, `spec/screens/template-configuration.md` 상단 현재 구현

## 구현 대상
1. 양식 틀(FormLayout)과 채울 수 있는 항목 목록, 기본 포맷 5종
   - 기본 양식(기존 PDF 그대로)
   - 품목 표형(PDF 1쪽): 문서번호·지출일자·지출건명·발의/결재일자·작성부서·작성자·합계(VAT 포함) + 번호·사용일·사용처·적요·금액·비고 + 특이사항
   - 단건 요약형(PDF 2쪽): 금액 "일금 ○○원정 (₩)" + 적요 표 + 비고 + 맺음말 + 날짜 + 작성자 (인)
   - 월 청구형(xls): 일자·계정 과목·품목·금액·지출 증빙·비고 + 소계 + "상기와 같이 {기간} 지출한 경비를 청구합니다" + 청구인 (인)
   - 내역·입금형(hwp): 지출 제목·작성/결재 일자·부서/담당·지출 금액 + 항목·금액·비고 + 입금 정보(직원 계좌) + 회사 이름
   - 받은 양식의 수량·단가 칸은 우리 데이터에 없어 넣지 않음. 관리대장(PDF 3쪽)은 결의서가 아니라 목록이라 제외(세무 마감 엑셀이 같은 역할)
2. 관리자 [설정 › 지출결의서 양식] 화면: 고르기 → 꾸미기 → 미리보기 → 저장 / 기본으로 되돌리기
3. 종이 양식 찍기·올리기 → Gemini가 칸을 읽어 항목과 짝짓기 → 안내(채울 수 없어 뺀 칸, 결재란 자동)
4. 같은 문서 모델로 PDF: 관리자 결의서 상세 [지출결의서 PDF](새), 세무 마감 ZIP의 지출결의서 PDF(회사 양식 적용)

## 변경 사항
- `src/lib/forms/layout.ts`: FIELD_CATALOG(21)·COLUMN_CATALOG(16), PRESETS, `normalizeLayout`(저장값·AI값 검사), `buildDocModel`, `amountInWords`, SAMPLE_DOC
- `src/lib/forms/ai-layout.ts`(AI 결과 → 틀), `src/lib/forms/gemini-form.ts`(JSON 스키마 강제, 30초, 다른 모델로 1회 재시도), `src/lib/forms/active.ts`
- `src/lib/tax/claim-docs.ts`: `evidence_type`, 직원 계좌(member.bank), `getClaimDocsByIds`
- `src/lib/tax/pdf-client.ts`: 문서 모델을 그리도록 다시 작성(라벨–값 칸 2개씩/넓은 칸 1줄, 표 열 비율, 합계 줄, 표 아래 칸, 가운데 맺음말·날짜·서명·회사), 월 없이 결의서 한 건도
- `supabase/migrations/060_form_layouts.sql`: `save_form_template`, `clear_form_template`(관리자, advisory lock, 자기 회사 경로만)
- `supabase/tests/040_form_layouts.sql`(직원 불가·잘못된 틀·남의 경로·버전·되돌리기·기록 보존·회사 격리 읽기/쓰기), `039_oil_prices.sql`은 실제 유가가 쌓여도 되게 트랜잭션 안에서만 비움
- 화면: `src/app/workspace/[id]/admin/form-template/{page,actions}.ts(x)`, `src/components/admin/form-template-view.tsx`, `src/components/forms/claim-document.tsx`, `src/components/claims/claim-pdf-button.tsx`, 메뉴 "지출결의서 양식" 켬
- 오류 문구: INVALID_FORM_LAYOUT, INVALID_FORM_SOURCE
- 미리보기 `/dev/preview/admin-form-template(-monthly)` + check:responsive 목록

## 검증
- tsc / lint / unit 171 / DB 테스트 40 / build 통과, check:responsive 전 화면 가로 넘침 없음(새 화면 360·390·768·1280)
- E2E `.responsive/live/e2e-form-template.mjs`(로그인, 실제 Gemini):
  - 월 청구형 고르기 → 미리보기(최근 결의서) → 저장(DB base monthly)
  - 받은 PDF 1쪽을 올림 → 7~8초(올리기+분석 체감) 만에 칸 11~13개 짝지음, "채울 수 없어 뺀 칸: 수량, 단가", 결재란(담당) 자동 안내
  - 제목 바꿔 저장 → v2 custom, 원본 경로 자기 회사, AI 원본 기록
  - 결의서 상세 [지출결의서 PDF] → 1쪽 PDF에 맞춤 제목·칸·합계 86,800 확인(pdf.js 렌더)
  - 되돌리기 → 활성 없음, 기록 2개 보존 / 직원은 직원 홈으로 이동
- 회귀: `e2e-tax.mjs` 세무 ZIP의 지출결의서 PDF(기본 양식, 5쪽, 영수증·경로 요약 포함) 정상

## 특이 사항
- AI 결과는 매번 조금 다를 수 있다(예: "비고"를 비고 칸에 짝짓기도, 빼기도 함). 그래서 저장 전에 관리자가 꾸미기·미리보기로 확인하게 했다.
- 결재란은 종이 양식의 칸 이름(담당·이사·대표)을 쓰지 않고 실제 결재라인(검토/승인 + 이름·날짜)으로 그린다.
- 테스트 중 Supabase 연결이 한 번 끊겨 남아 있던 옛 테스트 계정(smoke-e2e-*) 6개를 지웠다. 실제 회사 데이터는 건드리지 않았다.

## 보완 (2026-10-24, D-119) — 품목·수량·단가 칸
- 사용자 지적: 수량·단가는 영수증 품목 데이터(D-079 `line_items`)로 채울 수 있음 → 처음 구현에서 '채울 수 없는 칸'으로 뺀 것을 바로잡음
- `layout.ts`: COLUMN_CATALOG에 `item.line_name`(품목)·`item.quantity`·`item.unit_price`·`item.receipt`(사용일 · 사용처), `linesOf`(품목 줄·할인/기타 줄·금액 모르면 영수증 한 줄), 품목 열이 있으면 품목마다 한 줄(A안)
- 기본 포맷: 품목 표형 = 번호·적요·수량·단가·금액·비고(받은 PDF 1쪽 그대로), 내역·입금형 = 항 목·금액(원)·비 고(hwp 그대로)
- AI 안내 문구: 품목명·항목·내역 → 품목, 수량·단가, 특이사항·비고 → 지출 사유
- `claim-docs.ts`: `line_items` 읽기, 예시 결의서에 품목(할인 줄 생기는 경우 포함)
- 검증: unit 174 / DB 40 / tsc·lint·build / check:responsive 통과. E2E(실제 Gemini): 받은 PDF 1쪽 → 칸 14개 짝지음(수량·단가 포함, 뺀 칸 없음), 저장 → 결의서 PDF에 '1 점심 정식 3 11,000 33,000 / 2 음료 2 1,400 2,800 / 3 사무용품 구입 1 51,000 51,000 / 합계 86,800', 특이사항 칸 표시
- 저장 전 확인 필수(2026-10-24 사용자 요청): 미리보기 아래 [미리보기를 확인했어요] 체크해야 저장 버튼이 켜지고, 칸을 바꾸면 다시 꺼짐. E2E로 확인 전·수정 후 저장 막힘 확인. 회귀 round4·claim-category·owncar-inline 통과(직원 작성 흐름 영향 없음)
