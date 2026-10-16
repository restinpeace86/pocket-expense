-- =============================================================================
-- 003_storage.sql — 비공개 버킷 + 회사 폴더 격리 (기준: spec/data/schema.md §4)
--   receipts:       {company_id}/{member_id}/{claim_id}/{item_id}.{ext}
--   form-templates: {company_id}/{uuid}.{ext}
--   경로 첫 폴더가 자기 회사가 아니면 읽기·쓰기 모두 불가. 화면 표시는 서버가 만든 signed URL로만.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('receipts', 'receipts', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  ('form-templates', 'form-templates', false, 10485760, array['image/jpeg', 'image/png', 'application/pdf'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 기존(폐기 스키마 시절) 정책이 있으면 제거
drop policy if exists receipts_select on storage.objects;
drop policy if exists receipts_insert on storage.objects;
drop policy if exists receipts_update on storage.objects;
drop policy if exists receipts_delete on storage.objects;
drop policy if exists form_templates_select on storage.objects;
drop policy if exists form_templates_insert on storage.objects;
drop policy if exists form_templates_update on storage.objects;
drop policy if exists form_templates_delete on storage.objects;

-- receipts 열람: 자기 회사 폴더 + 해당 영수증 항목을 볼 수 있는 사람
create policy receipts_select on storage.objects for select to authenticated
using (
  bucket_id = 'receipts'
  and (storage.foldername(name))[1] = private.current_company_id()::text
  and exists (
    select 1 from public.expense_items i
    where i.receipt_path = storage.objects.name
      and i.company_id = private.current_company_id()
      and private.can_view_claim(i.claim_id)
  )
);

-- receipts 업로드·교체·삭제: 자기 회사 / 자기 멤버 폴더 / 자기가 편집 중인 소명서 폴더만
create policy receipts_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'receipts'
  and (storage.foldername(name))[1] = private.current_company_id()::text
  and (storage.foldername(name))[2] = private.current_member_id()::text
  and private.can_edit_claim(((storage.foldername(name))[3])::uuid)
);
create policy receipts_update on storage.objects for update to authenticated
using (
  bucket_id = 'receipts'
  and (storage.foldername(name))[1] = private.current_company_id()::text
  and (storage.foldername(name))[2] = private.current_member_id()::text
  and private.can_edit_claim(((storage.foldername(name))[3])::uuid)
)
with check (
  bucket_id = 'receipts'
  and (storage.foldername(name))[1] = private.current_company_id()::text
  and (storage.foldername(name))[2] = private.current_member_id()::text
  and private.can_edit_claim(((storage.foldername(name))[3])::uuid)
);
create policy receipts_delete on storage.objects for delete to authenticated
using (
  bucket_id = 'receipts'
  and (storage.foldername(name))[1] = private.current_company_id()::text
  and (storage.foldername(name))[2] = private.current_member_id()::text
  and private.can_edit_claim(((storage.foldername(name))[3])::uuid)
);

-- form-templates: 자기 회사 관리자 이상만
create policy form_templates_select on storage.objects for select to authenticated
using (bucket_id = 'form-templates' and (storage.foldername(name))[1] = private.current_company_id()::text and private.is_admin());
create policy form_templates_insert on storage.objects for insert to authenticated
with check (bucket_id = 'form-templates' and (storage.foldername(name))[1] = private.current_company_id()::text and private.is_admin());
create policy form_templates_update on storage.objects for update to authenticated
using (bucket_id = 'form-templates' and (storage.foldername(name))[1] = private.current_company_id()::text and private.is_admin())
with check (bucket_id = 'form-templates' and (storage.foldername(name))[1] = private.current_company_id()::text and private.is_admin());
create policy form_templates_delete on storage.objects for delete to authenticated
using (bucket_id = 'form-templates' and (storage.foldername(name))[1] = private.current_company_id()::text and private.is_admin());
