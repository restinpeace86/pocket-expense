-- =============================================================================
-- 037_receipt_records_company_delete.sql — 회사 삭제가 막히던 문제 수정 (030 트리거, E2E 정리 중 발견)
-- 문제: 회사를 지우면 연쇄 삭제 중 항목·소명서 삭제 트리거가 이미 지워진 회사의 영수증 기록을 고치려다
--       "receipt_usage_records_company_id_fkey" 위반으로 회사 삭제 전체가 실패했다.
-- 수정: 회사 자체가 지워지는 중이면(회사 행이 없으면) 기록을 고치지 않는다. 기록은 회사와 함께 지워진다.
-- =============================================================================

create or replace function private.on_claim_deleted()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.companies where id = old.company_id) then return old; end if;
  update public.receipt_usage_records set claim_title = old.title, claim_status = old.status::text where claim_id = old.id;
  return old;
end;
$$;

create or replace function private.on_item_deleted()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if not old.credit_charged then return old; end if;
  if not exists (select 1 from public.companies where id = old.company_id) then return old; end if;
  update public.receipt_usage_records r
     set item_deleted_at = now(),
         item_snapshot = to_jsonb(old),
         claim_title = coalesce((select c.title from public.expense_claims c where c.id = old.claim_id), r.claim_title),
         claim_status = coalesce((select c.status::text from public.expense_claims c where c.id = old.claim_id), r.claim_status)
   where r.item_id = old.id;
  return old;
end;
$$;

revoke all on function private.on_claim_deleted(), private.on_item_deleted() from public, anon, authenticated;
