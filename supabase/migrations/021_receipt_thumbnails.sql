-- =============================================================================
-- 021_receipt_thumbnails.sql — 영수증 썸네일 경로 + 사진 접근 권한 (D-073, spec/common/performance.md §1)
--   보관본: receipt_path        = {company_id}/{member_id}/{claim_id}/{item_id}.jpg (긴 변 2000px)
--   썸네일: receipt_thumb_path  = {company_id}/{member_id}/{claim_id}/{item_id}_thumb.webp (긴 변 320px)
-- 격리: 썸네일도 보관본과 같은 규칙 — 자기 회사 폴더 + 그 영수증 항목을 볼 수 있는 사람만 열람.
-- =============================================================================

alter table public.expense_items
  add column receipt_thumb_path text,
  add constraint expense_items_receipt_thumb_path_in_company
    check (receipt_thumb_path is null or receipt_thumb_path like company_id::text || '/%');

create index if not exists expense_items_receipt_thumb_path_idx
  on public.expense_items (receipt_thumb_path) where receipt_thumb_path is not null;

-- 열람 정책: 보관본 또는 썸네일 경로가 항목에 등록된 파일만 (항목 열람 권한은 expense_items RLS가 다시 건다)
drop policy receipts_select on storage.objects;
create policy receipts_select on storage.objects for select to authenticated
using (
  bucket_id = 'receipts'
  and (storage.foldername(name))[1] = (select private.current_company_id())::text
  and (
    exists (
      select 1 from public.expense_items i
      where i.receipt_path = storage.objects.name
        and i.company_id = (select private.current_company_id())
    )
    or exists (
      select 1 from public.expense_items i
      where i.receipt_thumb_path = storage.objects.name
        and i.company_id = (select private.current_company_id())
    )
  )
);
