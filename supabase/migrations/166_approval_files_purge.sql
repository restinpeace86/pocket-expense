-- 166: 결재 문서 첨부 일괄 정리(D-291, 사용자 2026-11-18 "일괄 정리 할 수 있는 거 만들어")
-- 관리자가 [파일 보관]에서 "승인된 지 n개월 지난 결재 문서의 첨부"를 한 번에 지운다(저장 공간 확보)
-- - 승인된 문서만(작성 중·결재 중·반려 = 아직 쓰는 문서라 손대지 않음). 문서 내용·결재 기록·첨부 칸에 적힌 파일 이름은 그대로
-- - 순서: 목록(경로) → 앱이 저장소 API로 지움 → 저장소에서 정말 없어진 것만 기록 지움(공간이 실제로 비워진 만큼만 '정리됨')
-- - 문서에 몇 개를 언제 정리했는지 남겨 보는 사람이 헷갈리지 않게(files_purged·files_purged_at). updated_at은 그대로(목록 순서 안 바뀜)
alter table public.approval_documents
  add column files_purged smallint not null default 0,
  add column files_purged_at timestamptz;

-- 기간: 0 = 승인된 문서 전부, 3·6·12개월
create or replace function private.approval_purge_months(p_months integer)
returns integer
language plpgsql immutable
set search_path = ''
as $$
begin
  if p_months is null or p_months not in (0, 3, 6, 12) then raise exception 'INVALID_MONTHS'; end if;
  return p_months;
end;
$$;
revoke all on function private.approval_purge_months(integer) from public, anon, authenticated;

-- 기간별로 지울 수 있는 첨부(문서 수·파일 수·크기) — 화면에서 고르기 전에 보여 준다
create or replace function public.approval_doc_purge_status()
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare v_me public.members := private.require_admin(); v jsonb;
begin
  select jsonb_object_agg(m::text, jsonb_build_object('docs', coalesce(x.docs, 0), 'files', coalesce(x.files, 0), 'bytes', coalesce(x.bytes, 0)))
  into v
  from unnest(array[3, 6, 12, 0]) m
  left join lateral (
    select count(distinct f.document_id) docs, count(*) files, sum(f.size)::bigint bytes
    from public.approval_document_files f
    join public.approval_documents d on d.id = f.document_id and d.company_id = f.company_id
    where f.company_id = v_me.company_id and d.status = 'approved' and d.decided_at < now() - make_interval(months => m)
  ) x on true;
  return v;
end;
$$;

-- 지울 첨부 경로(한 번에 최대 500개). 앱이 저장소에서 지운 뒤 approval_doc_purge_done
create or replace function public.approval_doc_purge_list(p_months integer)
returns text[]
language plpgsql stable security definer
set search_path = ''
as $$
declare v_me public.members := private.require_admin(); v_m integer := private.approval_purge_months(p_months); v text[];
begin
  select coalesce(array_agg(path), '{}') into v from (
    select f.path from public.approval_document_files f
    join public.approval_documents d on d.id = f.document_id and d.company_id = f.company_id
    where f.company_id = v_me.company_id and d.status = 'approved' and d.decided_at < now() - make_interval(months => v_m)
    order by d.decided_at, f.created_at
    limit 500
  ) s;
  return v;
end;
$$;

-- 저장소에서 정말 없어진 첨부만 기록을 지우고 문서에 '정리됨'을 남긴다. 돌려주는 값 = 정리한 파일 수
create or replace function public.approval_doc_purge_done(p_paths text[])
returns integer
language plpgsql security definer
set search_path = ''
as $$
declare v_me public.members := private.require_admin(); v_n integer;
begin
  if p_paths is null or cardinality(p_paths) = 0 then return 0; end if;
  if cardinality(p_paths) > 500 then raise exception 'TOO_MANY'; end if;
  with gone as (
    delete from public.approval_document_files f
    using public.approval_documents d
    where f.path = any(p_paths)
      and f.company_id = v_me.company_id
      and d.id = f.document_id and d.company_id = f.company_id and d.status = 'approved'
      and not exists (select 1 from storage.objects o where o.bucket_id = 'approval-files' and o.name = f.path)
    returning f.document_id
  ), per as (
    select document_id, count(*)::integer n from gone group by document_id
  ), upd as (
    update public.approval_documents d set files_purged = least(d.files_purged + per.n, 32000), files_purged_at = now()
    from per where d.id = per.document_id and d.company_id = v_me.company_id
    returning per.n
  )
  select coalesce(sum(n), 0)::integer into v_n from upd;
  return v_n;
end;
$$;

revoke all on function public.approval_doc_purge_status(), public.approval_doc_purge_list(integer), public.approval_doc_purge_done(text[]) from public, anon;
grant execute on function public.approval_doc_purge_status(), public.approval_doc_purge_list(integer), public.approval_doc_purge_done(text[]) to authenticated;
