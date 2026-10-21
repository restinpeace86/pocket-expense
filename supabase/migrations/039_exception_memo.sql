-- =============================================================================
-- 039_exception_memo.sql — 지출결의서 [예외 소명 사유] (D-084, todo_improvement [개선사항 5])
-- 주말·심야 사용 같은 예외 건의 해명을 결의서 한 곳에 적는다. 선택 입력(상신을 막지 않음).
-- 쓰기 권한은 제목·지출 사유와 같다(claims_update 정책: 본인의 작성 중·반려 결의서만).
-- =============================================================================

alter table public.expense_claims
  add column exception_memo text check (length(exception_memo) <= 500);

grant insert (exception_memo), update (exception_memo) on public.expense_claims to authenticated;
