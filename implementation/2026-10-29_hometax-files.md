# 2026-10-29 홈택스 자료 — 회사가 올리고 세무사무소가 앱에서 보기 (D-158)

## 구현 대상 (사용자 지시)
- 회사가 홈택스에서 내려받아 올린 자료는 세무사무소가 앱에서 볼 수 있게 → 세무사가 홈택스에 다시 들어가지 않아도 되게
- 세무사무소가 따로 받아 보는 경우는 그대로 둠
- 1차 범위: 원본 보관 · 표 미리보기 · 원본 받기 · ZIP 포함. 결의서 대조는 실제 파일을 본 뒤

## 변경 사항
- migration 085: 비공개 보관함 `hometax-files`(10MB), `hometax_uploads`(달·종류·파일·머리글·미리보기 30줄·줄 수·메모·올린 사람, RLS 강제 — 회사 관리자 또는 그 회사를 볼 수 있는 세무사무소 구성원만 읽기), `add_hometax_upload`(관리자, 자기 회사 폴더만, 한 달 30개), `delete_hometax_upload`(경로 반환), 내려받기 기록 종류 `hometax`
- migration 086: 처리방침·약관 버전 2026-10-29(홈택스 자료 항목 추가, 다시 동의 받지 않음)
- `src/lib/hometax/` — kinds.ts(종류·이름표·ZIP 파일 이름), parse.ts(SheetJS로 .xlsx/.xls/CSV(UTF-8·EUC-KR) → 머리글·미리보기)(+test), server.ts(목록·원본 받기 응답·ZIP 링크 — RLS로 보이는 행만 운영 키로 읽음)
- 회사: `admin/export/hometax-actions.ts`(올리기·지우기·ZIP 목록), `admin/export/hometax/route.ts`(원본 받기 + 기록), 세무 마감 화면에 [홈택스 자료], 세무 마감 패키지 ZIP에 `홈택스자료/`
- 세무사무소: `tax-office/[companyId]/hometax/route.ts`, `officeHometaxFilesAction`, 세무 자료 화면에 [홈택스 자료](보기·받기만), 증빙 묶음 ZIP에 `홈택스자료/`
- 공용 화면 `src/components/tax-office/hometax-files.tsx`, `zip-client.ts`에 `attachments`(못 받은 파일은 따로 안내)
- 내려받기 기록에 "홈택스 원본 ‘파일 이름’"
- 처리방침 수집 항목에 "홈택스 자료(관리자가 올릴 때)"
- spec: tax-closing §3d, tax-office §3f / decision-log D-158 / todo 8-11, 8-12(대조 — 견본 대기)

## 특이 사항
- 결의서와의 대조(8-12)는 실제 홈택스 파일 견본을 받은 뒤 진행(파일마다 머리글 이름·위치가 달라 견본 없이 만들면 추측이 됨)
- 미리보기는 앞 30줄·30칸·칸당 100자까지만 저장, 전체는 원본으로
- 회사가 파일을 지우면 보관함 파일도 지우고 세무사무소 화면에서도 사라진다

## 확인
- `npx tsc --noEmit` 통과, `npm run test` 225개 통과(홈택스 해석 7개 추가)
- DB 테스트 054(직원 막힘·다른 회사 폴더·잘못된 종류·달·직접 쓰기 막힘·회사 격리·사무소 읽기만·받기 기록·지우기 경로) + 전체 `test:db` 통과
- `npm run build` 통과
- 화면 E2E `.responsive/live/e2e-hometax.mjs` 18/18: 엑셀 아닌 파일 막힘, xlsx(제목 줄 건너뛰고 머리글 찾음)·csv 올리기, 표 보기, 회사·사무소 원본 받기(같은 바이트), 직원 받기 막힘, 사무소 지우기 없음, 사무소 ZIP에 홈택스자료/ 2개, 기록, 지우기 → 보관함·사무소 화면에서 사라짐, 390·1280 넘침 없음. 스크린샷 확인
- 회귀: e2e-batch-d153 14/14, e2e-tax-office 34/34, e2e-tax(회사 패키지 ZIP·PDF·해제) 정상. 테스트 회사·사무소 0개 남음
