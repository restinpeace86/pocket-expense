# 확인 요청 하나로 (D-196, 8-45)

- 구현 일시: 2026-11-01
- 대상: `supabase/migrations/102_tax_requests_unified.sql`, `supabase/tests/063_tax_requests_unified.sql`, `src/lib/tax-office/requests.ts`, `src/components/tax-office/tax-requests.tsx`(다시 씀), `src/app/tax-office/[companyId]/request-actions.ts`, `src/app/workspace/[id]/admin/export/actions.ts`, `src/lib/claims/actions.ts`, `src/lib/notify/dispatch.ts`, `src/lib/tax/export-rows.ts`, 사무소 세무 자료·고객사 현황, 회사 세무 마감·관리자 홈

## 변경
- DB: `tax_office_requests.origin`(office/company), `unread_for`(office/company/null). 기존 회사 영수증 요청(tax_review_*)을 표로 옮김. 트리거 두 개로 영수증 칸 ↔ 요청 표를 맞춤(쓰기·지우기·처리됨·다시 열기). 함수: `create_company_tax_request`, `office_answer_tax_request`, `company_set_tax_request_status`, `mark_tax_requests_seen`, 기존 `create_tax_office_request`·`answer_tax_office_request`·`set_tax_office_request_status`에 안 읽음 처리, `tax_office_client_status`에 `unread`.
- 알림: 회사 시작(새 화면·결재 화면 메모) → 사무소 웹푸시(`notifyOfficeRequest`), 사무소 답 → 회사 웹푸시(`notifyCompanyAnswered`). 기존 사무소 시작·회사 답 알림은 그대로.
- 화면: 공용 `TaxRequests`(양쪽 만들기·받은 쪽 답·[확인함]/[다시 열기], "새"·상태·보낸 쪽). 열면 읽음(`markTaxRequestsSeen`, 목록을 받은 뒤라 이번 화면은 "새"를 보여 줌). 칩 "확인 요청 중"은 열린 요청 영수증 포함(`issueKinds(r, hasFile, openRequest)`). 고객사 카드 "새 확인 요청 N". 회사 관리자 홈 배너는 안 읽음 또는 답할 차례.

## 특이 사항
- 채팅(여러 번 주고받기)은 만들지 않음 — 질문 한 줄·답 한 줄(고치기 가능)·확인함.
- 회사 영수증 요청 본문은 결재 화면 메모와 같은 칸이라 200자.
