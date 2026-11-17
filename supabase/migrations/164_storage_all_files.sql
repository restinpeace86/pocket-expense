-- 164: 회사 저장 공간 = 회사의 모든 파일 합계(D-286, 사용자 2026-11-17 "10G씩 통합으로 주는 대신 모든 문서에 대하여 저장되는 거 합계로")
-- 지금까지 합계 = 채팅 사진·파일(회의 자료 포함) + 파일 보관함(휴지통 포함). 여기에 나머지 회사 파일을 모두 더한다:
--   영수증(receipts·receipt-archive) · 결재·증빙(leave-proofs·approval-files) · 서류·양식(doc-files·form-files·form-templates)
--   · 세무(accounting-format-files·hometax-files·payout-proofs)
-- 꽉 차면(사용자 결정: 전부 막기) 영수증·휴가 증빙을 포함해 모든 올리기를 막는다 — 저장소 올리기 규칙 하나(restrictive)로
-- 채팅·보관함 한도는 '전체 − 다른 것 모두'로 바뀐다(예전: 전체 − 서로)
-- 회사 경로는 모두 '{회사 id}/…'로 시작한다(운영자용 help-images·app-downloads·tax-office-templates·feedback-files는 회사 공간이 아님)

create or replace function private.docs_storage_parts(p_company uuid)
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'receipts', coalesce(sum(sz) filter (where bucket_id in ('receipts', 'receipt-archive')), 0),
    'approvals', coalesce(sum(sz) filter (where bucket_id in ('leave-proofs', 'approval-files')), 0),
    'forms', coalesce(sum(sz) filter (where bucket_id in ('doc-files', 'form-files', 'form-templates')), 0),
    'tax', coalesce(sum(sz) filter (where bucket_id in ('accounting-format-files', 'hometax-files', 'payout-proofs')), 0))
  from (
    select o.bucket_id, coalesce((o.metadata ->> 'size')::bigint, 0) as sz
    from storage.objects o
    where o.bucket_id in ('receipts', 'receipt-archive', 'leave-proofs', 'approval-files', 'doc-files', 'form-files', 'form-templates', 'accounting-format-files', 'hometax-files', 'payout-proofs')
      and o.name like p_company::text || '/%'
  ) t
$$;

create or replace function private.docs_storage_used(p_company uuid)
returns bigint
language sql stable security definer
set search_path = ''
as $$
  select (p->>'receipts')::bigint + (p->>'approvals')::bigint + (p->>'forms')::bigint + (p->>'tax')::bigint
  from (select private.docs_storage_parts(p_company) as p) x
$$;

create or replace function private.storage_total_used(p_company uuid)
returns bigint
language sql stable security definer
set search_path = ''
as $$
  select private.chat_storage_used(p_company) + private.vault_used(p_company) + private.docs_storage_used(p_company)
$$;

-- 채팅·보관함 한도 = 전체 − 나머지 모두
create or replace function private.chat_storage_limit(p_company uuid)
returns bigint
language sql stable security definer
set search_path = ''
as $$
  select greatest(0, private.storage_total_limit(p_company) - private.vault_used(p_company) - private.docs_storage_used(p_company))
$$;
create or replace function private.vault_limit(p_company uuid)
returns bigint
language sql stable security definer
set search_path = ''
as $$
  select greatest(0, private.storage_total_limit(p_company) - private.chat_storage_used(p_company) - private.docs_storage_used(p_company))
$$;

-- 꽉 찼나(저장소 경로 첫 폴더 글자로 — uuid 모양일 때만, 다른 모양이면 false)
create or replace function private.storage_full_folder(p_folder text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select case when p_folder ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
              then private.storage_total_used(p_folder::uuid) >= private.storage_total_limit(p_folder::uuid) else false end
$$;
revoke all on function private.docs_storage_parts(uuid), private.docs_storage_used(uuid), private.storage_total_used(uuid) from public, anon, authenticated;
revoke all on function private.storage_full_folder(text) from public, anon;
grant execute on function private.storage_full_folder(text) to authenticated;

-- 꽉 차면 회사 파일 올리기를 모두 막는다(다른 올리기 규칙과 AND). 회사 파일 버킷만, 경로 첫 폴더 = 회사
drop policy if exists storage_room_check on storage.objects;
create policy storage_room_check on storage.objects as restrictive for insert to authenticated
with check (
  case when bucket_id in ('receipts', 'leave-proofs', 'approval-files', 'doc-files', 'form-files', 'form-templates', 'chat-files', 'meeting-files', 'vault-files')
       then not private.storage_full_folder((storage.foldername(name))[1])
       else true end
);

-- 화면 안내용: 우리 회사 공간이 꽉 찼나(직원도 — 숫자는 안 줌)
create or replace function public.storage_is_full()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select private.storage_total_used(m.company_id) >= private.storage_total_limit(m.company_id)
  from public.members m where m.auth_user_id = (select auth.uid()) and m.status = 'approved' limit 1
$$;
revoke all on function public.storage_is_full() from public, anon;
grant execute on function public.storage_is_full() to authenticated;

-- 서버가 직접 올리는 곳(홈택스·지급 증빙·회계 양식)용: 서버 키만
create or replace function public.storage_is_full_for(p_company uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select private.storage_total_used(p_company) >= private.storage_total_limit(p_company)
$$;
revoke all on function public.storage_is_full_for(uuid) from public, anon, authenticated;
grant execute on function public.storage_is_full_for(uuid) to service_role;

-- 요금제 화면: 전체 사용량 = 모든 파일, 나머지 파일 나눠 보기
create or replace function public.storage_addon_status()
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare v_admin public.members := private.require_admin(); r public.storage_requests; v_parts jsonb := private.docs_storage_parts(v_admin.company_id);
begin
  select * into r from public.storage_requests where company_id = v_admin.company_id and status = 'received';
  return jsonb_build_object(
    'extra_gb', (select extra_storage_gb from public.companies where id = v_admin.company_id),
    'pending', case when r.id is null then null else jsonb_build_object('id', r.id, 'kind', r.kind, 'storage_gb', r.storage_gb, 'monthly_price', r.monthly_price, 'created_at', r.created_at, 'by', r.requested_by_name) end,
    'last', (select jsonb_build_object('status', s.status, 'storage_gb', s.storage_gb, 'reject_reason', s.reject_reason, 'done_at', s.done_at)
             from public.storage_requests s where s.company_id = v_admin.company_id and s.status in ('done', 'rejected') order by s.done_at desc nulls last limit 1),
    'chat_used', private.chat_storage_used(v_admin.company_id), 'chat_limit', private.chat_storage_limit(v_admin.company_id),
    'vault_used', private.vault_used(v_admin.company_id), 'vault_limit', private.vault_limit(v_admin.company_id),
    'docs', v_parts,
    'total_used', private.storage_total_used(v_admin.company_id),
    'total_limit', private.storage_total_limit(v_admin.company_id));
end;
$$;
