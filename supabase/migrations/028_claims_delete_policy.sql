-- =============================================================================
-- 028_claims_delete_policy.sql — 작성 중 소명서 삭제 정책의 무한 재귀 수정 (T6 묶음 A, test 014에서 발견)
-- 문제: claims_delete가 expense_items를 직접 조회 → expense_items의 열람 정책이 다시 expense_claims를 조회
--       → "infinite recursion detected in policy for relation expense_claims". 직원이 임시저장 소명서를 지울 수 없었다.
-- 수정: 마감된 항목이 있는지는 RLS를 거치지 않는 private 함수로 확인한다(조건은 그대로).
-- =============================================================================

create or replace function private.claim_has_closed_items(p_claim_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.expense_items i where i.claim_id = p_claim_id and i.closed_month is not null)
$$;
revoke all on function private.claim_has_closed_items(uuid) from public, anon;
grant execute on function private.claim_has_closed_items(uuid) to authenticated;

drop policy claims_delete on public.expense_claims;
create policy claims_delete on public.expense_claims for delete to authenticated
  using (company_id = (select private.current_company_id()) and member_id = (select private.current_member_id()) and status = 'draft'
         and not private.claim_has_closed_items(id));
