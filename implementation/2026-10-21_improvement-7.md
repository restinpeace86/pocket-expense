# 개선사항 7 — 지출 사유 AI 초안 (D-086)

- 구현 대상: `implementation/todo_improvement.md` [개선사항 7]
- 구현 일시: 2026-10-21

## 변경 사항
- `src/lib/receipts/gemini.ts`: 같은 인식 요청에 `suggested_purpose`(정중한 업무용 한 줄, 사실만, 예시 3개) 추가. `parse-result.ts`가 한 줄·40자·끝 마침표 제거.
- `src/lib/expense/purpose.ts`(+테스트 6): 영수증별 AI 사유 모으기 → 없으면 분류별 표준 문구 → 출장 결의서는 "{출장 목적} 관련 출장 경비".
- `claim-editor.tsx`: 직원이 쓰기 전까지 [지출 사유]에 초안 + "✨ AI 초안" 표시. 그대로 저장·상신하거나 눌러서 고쳐 쓰기(제목 자동 제안과 같은 방식).
- DB 변경 없음(AI 응답은 기존처럼 `ai_parsed_payload`에 저장).
- 스펙: `worker-tax-processing.md`, `receipt-parser.md`. 결정 D-086.

## 검증
- 로그인 E2E(360폭, 실제 Gemini, 임시 회사 삭제 확인): 영수증 1장 업로드 → 7.8초 뒤(화면 체감, 업로드·AI 인식 포함 — 추가 AI 호출 없음) 지출 사유에 "부서 정기 점심 식사 진행" + AI 초안 표시 → 임시저장 시 그대로 저장, 배지 사라짐 → 고쳐 쓰기 "A사 미팅 준비 다과 구입" 저장 확인.
- 단위 테스트 108, check:responsive 전 화면 넘침 없음, tsc / lint / build 통과.
