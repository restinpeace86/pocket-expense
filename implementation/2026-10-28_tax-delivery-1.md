# 2026-10-28 세무사 전달 1차 (D-153, todo 8-6)

## 구현 대상 (사용자 지시: 정해 둔 순서대로)
1. 세무사무소 증빙 묶음(ZIP)
2. 증빙 없음 가산세 안내 정확히
3. 외부 미팅비(접대비) 거래처·참석자 필수
4. 세무 자료 내려받기 기록
(5. 카드 대조 보완, 6. 영수증별 계정과목은 다음 — todo 8-7·8-8)

## 변경 사항
- ① `src/app/tax-office/[companyId]/zip-actions.ts`(영수증 10분 링크·지출결의서 데이터, 열람 확인 뒤 그 회사 자료만 운영 키), `office-zip-button.tsx`(회사 ZIP과 같은 `buildTaxZip`·`buildClaimsPdf`), 세무 자료 화면에 버튼. `getClaimDocs`·`getActiveForm`이 클라이언트를 받고 `withBank:false`면 정산 계좌를 빼게. `/api/fonts/kr`을 사무소 구성원에게도 허용
- ② `src/lib/expense/evidence-penalty.ts`(+test): 금액별 안내·적용 기준·세무 엑셀 확인 표시. 직원 항목 화면(증빙 없음)에서 사용, `checks()`에 반영
- ③ migration 080: `private.claim_problems`에 외부 미팅비 `client_name`·`attendees`. 결의서 화면 거래처·참석자 필수 표시 + 이유 안내, 빠진 칸 이름 "참석자" 추가. DB 테스트 050
- ④ migration 081: `tax_export_downloads` + `log_tax_export`. 회사 엑셀(미리보기/패키지)·회사 결산 양식·사무소 엑셀(그냥/ZIP 안, `?zip=1`)·사무소 결산 양식에서 기록. 회사 세무 마감 화면 `tax-download-log.tsx`. DB 테스트 051
- spec: tax-office §3c, tax-closing §3b, schema 2.1a8 / decision-log D-153, todo 8-6~8-8

## 특이 사항
- 가산세 안내는 세무 판단이 아니라 기준 안내(3만 원·2%)이며 "최종 판단은 세무사"를 항상 함께 보여 줌
- 외부 미팅비 필수 칸은 결의서 카테고리가 외부 미팅비인 결의서에만(영수증 화면에는 이 칸이 없음). 이미 상신된 결의서는 그대로
- 결산 양식 기록의 건수는 그 달 승인 지출 전체 건수(양식의 "넣을 지출" 필터 전)
- 테스트 중 발견: 사무소 ZIP의 지출결의서 PDF가 글꼴 API 권한(회사 멤버만) 때문에 빠짐 → 사무소 구성원 허용. PC에서 "세무용 엑셀 다운로드" 글자 꺾임 → 한 줄

## 확인
- `npx tsc --noEmit` 통과, `npm run test` 214개 통과(가산세 안내 4개 추가)
- DB 테스트 050·051 통과 + 017·027·031·034·036·043·045 회귀 통과
- `npm run build` 통과
- 화면 E2E `.responsive/live/e2e-batch-d153.mjs` 14/14: ZIP 이름·구성(장부·영수증 2·지출결의서 PDF)·완료 안내, 가산세 5만 원(약 1,000원)/2만 원(대상 아님)+기준, 미팅비 필수 표시·상신 막힘(거래처명·참석자)·채우면 저장, 회사 화면에 사무소 ZIP·엑셀 미리보기 기록. 390·1280 넘침 0, 스크린샷 확인
- 회귀: e2e-tax-office 34/34, e2e-tax-template 22/22, e2e-tax-governance 20/20, e2e-flow 17 OK, e2e-double-submit ALL_OK. 테스트 회사·사무소 0개 남음
