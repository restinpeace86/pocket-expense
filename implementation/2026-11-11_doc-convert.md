# 서류 → 엑셀 변환 + 관리자 크레딧 사용 내역 — 8-104 A, D-249

- 구현 일시: 2026-11-11
- 근거: `spec/features/company-forms.md` §A(승인 2026-11-11), 시안 캔버스 "서류 → 엑셀 · 회사 양식 등록 시안" A①~④·크레딧 사용 내역

## 변경 사항
- DB `supabase/migrations/139_doc_conversions.sql`
  - `doc_conversions`(초안·확정, 나만 보기/회사 공유, 표 모델 jsonb) — RLS 강제, 쓰기는 함수만
  - 비공개 버킷 `doc-files/{회사}/{멤버}/{id}` — 원본 사본(채팅 보관 기간과 따로), 읽기는 볼 수 있는 변환만, 올리기는 내 폴더만
  - 사용자 함수: `doc_convert_check`(채팅 파일: 방 참여자·사진/PDF·안 지워짐), `doc_convert_save`, `doc_convert_confirm`, `doc_convert_delete`, `credit_usage`(관리자)
  - 서버 함수: `doc_convert_begin`(쪽 수만큼 크레딧 차감, 5쪽까지), `doc_convert_ready`, `doc_convert_fail`(돌려줌), `doc_convert_due`(30일 초안·멈춘 변환 정리)
  - `credit_ledger` reason `doc_convert`·`doc_convert_refund` + `note`(파일 이름·쪽 수)
- `src/lib/doc-convert/`: `model.ts`(AI 표 → 격자+합친 칸, 글자·행 추가/삭제, 검사), `gemini.ts`(Gemini 비전, 쪽마다 표), `server.ts`(복사 → 차감 → AI → 저장/돌려줌), `xlsx.ts`(exceljs), `pdf-client.ts`(pdf-lib, 한글 글꼴은 /api/fonts/kr)
- 화면
  - 채팅 사진·PDF 메뉴 [엑셀로 변환] → 확인 창(크레딧 숫자 없음, 업무 서류 안내) → 변환 중 안내 → 결과 화면
  - `/employee/convert` 목록(사진·PDF 고르기, 내 변환/회사 공유), 직원 홈 칸 [서류 → 엑셀]
  - `/employee/convert/[cid]`: PC = 원본 ↔ 엑셀 같은 표(칸 눌러 바로 입력, Enter·Tab 이동, Alt+Enter 줄바꿈, 행 추가/삭제, 되돌리기, 자동 저장), 휴대폰 = 미리보기 + 받기 + 확정. [PDF 받기]·[엑셀 받기](`/convert/[cid]/xlsx`), 확정(회사 공유/나만 보기), 지우기
  - 관리자 요금제 아래 [크레딧 사용 내역](달 넘기기, 합계: 영수증 읽기/서류 → 엑셀/남은 크레딧, 줄: 날짜·사람·내용·크레딧). 요금제 카드 문구 "쓴 크레딧(영수증·서류 변환)"
- 새벽 작업 ⑨ 서류 변환 초안 정리

## 검증
- 단위 `src/lib/doc-convert/model.test.ts`, DB `supabase/tests/088_doc_conversions.sql`(격리·권한·차감/돌려줌·정리)
- 화면 `.responsive/live/e2e-convert.mjs` — 실제 Gemini로 휴가신청서 사진 변환, 휴대폰 390·PC 1440, PDF·엑셀 내용 확인, 크레딧 없음 안내, 관리자 내역

## 특이 사항
- 회사 양식 등록(B)은 아직 없어서 채팅 메뉴 [회사 양식으로 등록](관리자)은 B와 함께 넣는다
- 확정한 변환은 표 모델(jsonb)과 원본 사본만 — 회사 저장 공간 집계(용량 추가 상품 8-103)에 넣는 것은 그때
