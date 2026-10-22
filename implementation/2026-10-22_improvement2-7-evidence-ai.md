# 개선사항(2차) 7 — 증빙 구분 AI 자동 판별 + 이유 문구 (D-100)

- 구현 일시: 2026-10-22
- DB: `supabase/migrations/049_evidence_default.sql`(운영 DB 적용) — `apply_receipt_parse`(038 정의 그대로)에 기본값만: AI 판별값 → 없으면 `card_slip`, 읽기 실패도 `card_slip`. 직원이 고른 값은 유지. 테스트 `supabase/tests/032_evidence_default.sql`(기본값·AI 값·실패·직접 고른 값 유지), test:db 32 통과.
- 화면: `src/lib/receipts/evidence-reason.ts`(+ 테스트 3개) — 판별값·승인번호·카드번호로 이유 한 줄. 영수증 카드에는 칩 대신 "증빙 구분 카드매출전표 [바꾸기]" + "└ ✨ 카드 승인번호를 확인했어요"(연한 회색). [바꾸기] → 칩 5개, 다른 값을 고르면 이유를 숨김. `EditorItem.aiEvidence` 추가(읽기 성공·실패 항목만).
- 검증
  - tsc / test 138 / lint / build 통과.
  - 로그인 E2E(`.responsive/live/e2e-evidence.mjs`, 360·390, 실제 사진 업로드 → Gemini 인식): 업로드→목록 6.3초/5.8초(화면 기준) · DB 증빙 card_slip(AI card_slip, 승인번호 읽음) → 화면 "증빙 구분 카드매출전표 [바꾸기]" + "└ ✨ 카드 승인번호를 확인했어요", 칩 접힘 → [바꾸기]→현금영수증 → DB cash_receipt, 이유 숨김. 임시 회사 정리 확인.
  - check:responsive(편집 미리보기 4종 × 4폭) 넘침 없음, 360 스크린샷 확인.
