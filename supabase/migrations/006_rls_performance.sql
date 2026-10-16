-- =============================================================================
-- 006_rls_performance.sql — RLS 성능 최적화 (격리 조건은 그대로, 평가 방식만 변경)
--   문제(bench_rls.sql, 소명서 21,000건): 정책이 행마다 private.can_view_claim()을 호출해
--         관리자 목록 50건 조회에 2.2초. 회사 필터가 인덱스를 타지 못했다.
--   해결: 1) 헬퍼 호출을 (select ...)로 감싸 쿼리당 1회만 평가(initPlan) → company_id 인덱스 사용
--         2) 소명서 열람 판단을 행별 함수 대신 인라인 조건 + "내가 검토자인 소명서 id 집합"으로
--         3) 항목·결재 기록은 "볼 수 있는 소명서 id 집합"으로 판단 (expense_claims의 RLS를 그대로 상속)
--         4) 정책·정렬에 쓰는 컬럼 인덱스 보강
-- =============================================================================

-- 내가 사전 검토자로 지정된 소명서 id (승인된 멤버만, 같은 회사만)
create or replace function private.my_review_claim_ids()
returns setof uuid
language sql stable security definer
set search_path = ''
as $$
  select distinct a.claim_id
  from public.claim_approvals a
  where a.approver_member_id = private.current_member_id()
    and a.company_id = private.current_company_id()
$$;
revoke all on function private.my_review_claim_ids() from public, anon;
grant execute on function private.my_review_claim_ids() to authenticated;

-- 1. 인덱스 ----------------------------------------------------------------------
create index if not exists expense_claims_company_created_idx on public.expense_claims (company_id, created_at desc);
create index if not exists expense_claims_company_submitted_idx on public.expense_claims (company_id, submitted_at desc nulls last);
create index if not exists expense_claims_company_member_idx on public.expense_claims (company_id, member_id, created_at desc);
create index if not exists claim_approvals_approver_idx on public.claim_approvals (approver_member_id) where approver_member_id is not null;
create index if not exists claim_approvals_company_claim_idx on public.claim_approvals (company_id, claim_id);
create index if not exists expense_items_company_claim_idx on public.expense_items (company_id, claim_id);
create index if not exists member_invitations_company_idx on public.member_invitations (company_id);
create index if not exists corporate_cards_company_idx on public.corporate_cards (company_id);
create index if not exists approval_line_steps_company_idx on public.approval_line_steps (company_id);
create index if not exists member_bank_accounts_company_idx on public.member_bank_accounts (company_id);

-- 2. 정책 재작성 -------------------------------------------------------------------
-- companies
drop policy companies_select on public.companies;
drop policy companies_update on public.companies;
create policy companies_select on public.companies for select to authenticated
  using (id = (select private.current_company_id()));
create policy companies_update on public.companies for update to authenticated
  using (id = (select private.current_company_id()) and (select private.is_admin()))
  with check (id = (select private.current_company_id()) and (select private.is_admin()));

-- departments
drop policy departments_select on public.departments;
drop policy departments_insert on public.departments;
drop policy departments_update on public.departments;
drop policy departments_delete on public.departments;
create policy departments_select on public.departments for select to authenticated
  using (company_id = (select private.current_company_id()));
create policy departments_insert on public.departments for insert to authenticated
  with check (company_id = (select private.current_company_id()) and (select private.is_admin()));
create policy departments_update on public.departments for update to authenticated
  using (company_id = (select private.current_company_id()) and (select private.is_admin()))
  with check (company_id = (select private.current_company_id()) and (select private.is_admin()));
create policy departments_delete on public.departments for delete to authenticated
  using (company_id = (select private.current_company_id()) and (select private.is_admin()));

-- members
drop policy members_select on public.members;
drop policy members_update_self on public.members;
create policy members_select on public.members for select to authenticated
  using (company_id = (select private.current_company_id()) or auth_user_id = (select auth.uid()));
create policy members_update_self on public.members for update to authenticated
  using (auth_user_id = (select auth.uid()))
  with check (auth_user_id = (select auth.uid()));

-- member_invitations
drop policy invitations_select on public.member_invitations;
drop policy invitations_insert on public.member_invitations;
drop policy invitations_update on public.member_invitations;
drop policy invitations_delete on public.member_invitations;
create policy invitations_select on public.member_invitations for select to authenticated
  using (company_id = (select private.current_company_id()) and (select private.is_admin()));
create policy invitations_insert on public.member_invitations for insert to authenticated
  with check (company_id = (select private.current_company_id()) and (select private.is_admin())
              and invited_by_member_id = (select private.current_member_id()) and status = 'invited');
create policy invitations_update on public.member_invitations for update to authenticated
  using (company_id = (select private.current_company_id()) and (select private.is_admin()))
  with check (company_id = (select private.current_company_id()) and (select private.is_admin()) and status in ('invited', 'canceled'));
create policy invitations_delete on public.member_invitations for delete to authenticated
  using (company_id = (select private.current_company_id()) and (select private.is_admin()) and status <> 'accepted');

-- member_bank_accounts
drop policy bank_select on public.member_bank_accounts;
drop policy bank_insert on public.member_bank_accounts;
drop policy bank_update on public.member_bank_accounts;
drop policy bank_delete on public.member_bank_accounts;
create policy bank_select on public.member_bank_accounts for select to authenticated
  using (company_id = (select private.current_company_id())
         and (member_id = (select private.current_member_id()) or (select private.is_admin())));
create policy bank_insert on public.member_bank_accounts for insert to authenticated
  with check (company_id = (select private.current_company_id()) and member_id = (select private.current_member_id()));
create policy bank_update on public.member_bank_accounts for update to authenticated
  using (company_id = (select private.current_company_id()) and member_id = (select private.current_member_id()))
  with check (company_id = (select private.current_company_id()) and member_id = (select private.current_member_id()));
create policy bank_delete on public.member_bank_accounts for delete to authenticated
  using (company_id = (select private.current_company_id()) and member_id = (select private.current_member_id()));

-- 회사 설정 테이블
do $$
declare t text; v_admin_read boolean;
begin
  foreach t in array array['form_templates', 'corporate_cards', 'approval_lines', 'approval_line_steps', 'account_titles', 'account_title_mappings'] loop
    v_admin_read := t in ('account_titles', 'account_title_mappings');
    execute format('drop policy %I on public.%I', t || '_select', t);
    execute format('drop policy %I on public.%I', t || '_insert', t);
    execute format('drop policy %I on public.%I', t || '_update', t);
    execute format('drop policy %I on public.%I', t || '_delete', t);
    execute format('create policy %I on public.%I for select to authenticated using (company_id = (select private.current_company_id())%s)',
                   t || '_select', t, case when v_admin_read then ' and (select private.is_admin())' else '' end);
    execute format('create policy %I on public.%I for insert to authenticated with check (company_id = (select private.current_company_id()) and (select private.is_admin()))', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (company_id = (select private.current_company_id()) and (select private.is_admin())) with check (company_id = (select private.current_company_id()) and (select private.is_admin()))', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (company_id = (select private.current_company_id()) and (select private.is_admin()))', t || '_delete', t);
  end loop;
end;
$$;

-- expense_claims: 같은 회사(인덱스) → 본인 | 관리자 이상 | 내가 검토자인 소명서
drop policy claims_select on public.expense_claims;
drop policy claims_insert on public.expense_claims;
drop policy claims_update on public.expense_claims;
drop policy claims_delete on public.expense_claims;
create policy claims_select on public.expense_claims for select to authenticated
  using (
    company_id = (select private.current_company_id())
    and (
      member_id = (select private.current_member_id())
      or (select private.is_admin())
      or id in (select private.my_review_claim_ids())
    )
  );
create policy claims_insert on public.expense_claims for insert to authenticated
  with check (company_id = (select private.current_company_id()) and member_id = (select private.current_member_id()) and status = 'draft');
create policy claims_update on public.expense_claims for update to authenticated
  using (company_id = (select private.current_company_id()) and member_id = (select private.current_member_id()) and status in ('draft', 'rejected'))
  with check (company_id = (select private.current_company_id()) and member_id = (select private.current_member_id()) and status in ('draft', 'rejected'));
create policy claims_delete on public.expense_claims for delete to authenticated
  using (company_id = (select private.current_company_id()) and member_id = (select private.current_member_id()) and status = 'draft'
         and not exists (select 1 from public.expense_items i where i.claim_id = expense_claims.id and i.closed_month is not null));

-- expense_items: 같은 회사 + 볼 수 있는 소명서(위 정책이 그대로 적용된 집합)의 항목
drop policy items_select on public.expense_items;
drop policy items_insert on public.expense_items;
drop policy items_update on public.expense_items;
drop policy items_delete on public.expense_items;
create policy items_select on public.expense_items for select to authenticated
  using (company_id = (select private.current_company_id()) and claim_id in (select c.id from public.expense_claims c));
create policy items_insert on public.expense_items for insert to authenticated
  with check (company_id = (select private.current_company_id()) and private.can_edit_claim(claim_id));
create policy items_update on public.expense_items for update to authenticated
  using (company_id = (select private.current_company_id()) and private.can_edit_claim(claim_id))
  with check (company_id = (select private.current_company_id()) and private.can_edit_claim(claim_id));
create policy items_delete on public.expense_items for delete to authenticated
  using (company_id = (select private.current_company_id()) and private.can_edit_claim(claim_id) and closed_month is null);

-- claim_approvals
drop policy approvals_select on public.claim_approvals;
create policy approvals_select on public.claim_approvals for select to authenticated
  using (company_id = (select private.current_company_id()) and claim_id in (select c.id from public.expense_claims c));

-- 관리자 전용 열람 테이블
do $$
declare t text;
begin
  foreach t in array array['credit_ledger', 'monthly_closings', 'notification_logs'] loop
    execute format('drop policy %I on public.%I', t || '_select', t);
    execute format('create policy %I on public.%I for select to authenticated using (company_id = (select private.current_company_id()) and (select private.is_admin()))', t || '_select', t);
  end loop;
end;
$$;

-- 3. 저장소: 회사 폴더 비교를 쿼리당 1회로
drop policy receipts_select on storage.objects;
create policy receipts_select on storage.objects for select to authenticated
using (
  bucket_id = 'receipts'
  and (storage.foldername(name))[1] = (select private.current_company_id())::text
  and exists (
    select 1 from public.expense_items i
    where i.receipt_path = storage.objects.name
      and i.company_id = (select private.current_company_id())
  )
);
create index if not exists expense_items_receipt_path_idx on public.expense_items (receipt_path) where receipt_path is not null;
