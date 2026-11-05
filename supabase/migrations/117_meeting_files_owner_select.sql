-- =============================================================================
-- 117_meeting_files_owner_select.sql — 회의 자료 파일: 올린 사람은 자기 파일을 볼 수 있게(D-217 보완)
-- 보관함 지우기(remove)는 먼저 그 파일을 '볼 수' 있어야 한다. 자료 줄을 먼저 지우면(자료 빼기·회의 취소) 등록된 자료가 아니게 되어
-- 같은 회사 보기 규칙으로는 안 보이므로, 올린 사람(owner) 본인 것은 보이게 해 바로 지울 수 있게 한다.
-- =============================================================================
drop policy if exists meeting_files_select on storage.objects;
create policy meeting_files_select on storage.objects for select to authenticated
using (
  bucket_id = 'meeting-files'
  and (storage.foldername(name))[1] = (select private.current_company_id())::text
  and (private.meeting_file_visible(name) or owner_id = (select auth.uid())::text)
);
