-- =============================================================================
-- 155_vault_trash.sql — 파일 보관함 휴지통(삭제 파일 복구) (9-22, D-266)
-- 사용자 결정(2026-11-13, 문서 값 그대로): 스타터 30일 · 프로 90일 · 비즈니스 1년. 결제 연동 전에는 private.effective_plan()(= 프로)
-- - 지우면 휴지통으로(deleted_at). 파일은 그대로 두고 용량에도 계속 들어감(영구 삭제 전까지)
-- - 복구·영구 삭제는 지울 수 있는 사람과 같음: 나만 보기 = 보관한 사람, 회사 공유 = 보관한 사람 + 관리자
-- - 기간이 지나면 밤 작업이 파일까지 영구 삭제(vault_trash_due → 서버가 저장소에서 지움 → vault_files_remove)
-- - 채팅 메시지 삭제는 그대로 바로 지워진다(이 표는 보관함만)
-- =============================================================================

alter table public.billing_plans add column trash_days integer check (trash_days is null or trash_days between 1 and 3650);
update public.billing_plans set trash_days = case code when 'starter' then 30 when 'standard' then 90 when 'pro' then 365 end, updated_at = now()
where code in ('starter', 'standard', 'pro');

alter table public.vault_files
  add column deleted_at timestamptz,
  add column deleted_by uuid;
create index vault_files_trash_idx on public.vault_files (company_id, deleted_at) where deleted_at is not null;

-- 회사 휴지통 보관 일수
create or replace function private.vault_trash_days(p_company uuid)
returns integer
language sql stable security definer
set search_path = ''
as $$
  select coalesce((private.effective_plan(p_company)).trash_days, 30)
$$;
revoke all on function private.vault_trash_days(uuid) from public, anon, authenticated;

-- 읽기: 보관함 = 지우지 않은 것(회사 공유 모두 / 나만 보기 본인), 휴지통 = 복구할 수 있는 사람만
drop policy vault_files_select on public.vault_files;
create policy vault_files_select on public.vault_files for select to authenticated
using (
  company_id = (select private.current_company_id())
  and (
    (deleted_at is null and (scope = 'company' or owner_member_id = (select private.current_member_id())))
    or (deleted_at is not null and (
      owner_member_id = (select private.current_member_id())
      or (scope = 'company' and (select private.is_admin()))
    ))
  )
);

-- 휴지통 파일은 열 수 없음(복구한 뒤 열기)
create or replace function private.vault_can_read(p_name text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.vault_files v
    join public.members m on m.id = (select private.current_member_id()) and m.status = 'approved'
    where (v.path = p_name or v.thumb_path = p_name)
      and v.company_id = m.company_id
      and v.deleted_at is null
      and (v.scope = 'company' or v.owner_member_id = m.id)
  )
$$;

-- 상태: 보관함 개수는 휴지통 빼고, 휴지통은 내가 복구할 수 있는 것만. 용량(used)은 휴지통 포함
create or replace function public.vault_status()
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_me public.members := private.require_member();
  v_admin boolean := v_me.role in ('admin', 'super_admin');
begin
  return jsonb_build_object(
    'used', private.vault_used(v_me.company_id),
    'limit', private.vault_limit(v_me.company_id),
    'company_count', (select count(*) from public.vault_files where company_id = v_me.company_id and scope = 'company' and deleted_at is null),
    'mine_private', (select count(*) from public.vault_files where owner_member_id = v_me.id and scope = 'private' and deleted_at is null),
    'trash_days', private.vault_trash_days(v_me.company_id),
    'trash_count', (select count(*) from public.vault_files where company_id = v_me.company_id and deleted_at is not null and (owner_member_id = v_me.id or (scope = 'company' and v_admin))),
    'trash_bytes', (select coalesce(sum(size::bigint + thumb_size), 0) from public.vault_files where company_id = v_me.company_id and deleted_at is not null and (owner_member_id = v_me.id or (scope = 'company' and v_admin)))
  );
end;
$$;

-- 보관 전 확인: 휴지통에 있으면 IN_TRASH(복구하면 됨)
create or replace function public.vault_keep_check(p_message uuid)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_me public.members := private.require_chat();
  v_msg public.chat_messages;
  v_need bigint;
begin
  select * into v_msg from public.chat_messages where id = p_message and company_id = v_me.company_id;
  if v_msg.id is null or not private.is_chat_member(v_msg.room_id) then raise exception 'NOT_FOUND'; end if;
  if v_msg.kind not in ('image', 'file') or v_msg.attachment_path is null then raise exception 'NOT_FILE'; end if;
  if v_msg.deleted_at is not null or v_msg.attachment_purged_at is not null then raise exception 'EXPIRED'; end if;
  if exists (select 1 from public.vault_files where owner_member_id = v_me.id and source_message_id = p_message and deleted_at is not null) then raise exception 'IN_TRASH'; end if;
  if exists (select 1 from public.vault_files where owner_member_id = v_me.id and source_message_id = p_message) then raise exception 'ALREADY_KEPT'; end if;
  v_need := coalesce(v_msg.attachment_size, 0)::bigint + coalesce(v_msg.attachment_thumb_size, 0);
  if private.vault_used(v_me.company_id) + v_need > private.vault_limit(v_me.company_id) then raise exception 'VAULT_FULL'; end if;
  return jsonb_build_object(
    'member_id', v_me.id, 'company_id', v_me.company_id, 'room_id', v_msg.room_id, 'message_id', v_msg.id,
    'kind', v_msg.kind, 'name', coalesce(v_msg.attachment_name, '파일'), 'mime', v_msg.attachment_mime,
    'size', coalesce(v_msg.attachment_size, 0), 'path', v_msg.attachment_path, 'thumb_path', v_msg.attachment_thumb_path
  );
end;
$$;

create or replace function public.vault_set_scope(p_id uuid, p_scope text)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare v_me public.members := private.require_member();
begin
  if p_scope not in ('private', 'company') then raise exception 'INVALID_SCOPE'; end if;
  update public.vault_files set scope = p_scope, scope_changed_at = now()
   where id = p_id and owner_member_id = v_me.id and company_id = v_me.company_id and deleted_at is null;
  if not found then raise exception 'NOT_FOUND'; end if;
end;
$$;

-- 지우기 = 휴지통으로(파일은 그대로). 남는 날을 돌려준다
create or replace function public.vault_delete(p_id uuid)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_me public.members := private.require_member();
  v_row public.vault_files;
begin
  select * into v_row from public.vault_files where id = p_id and company_id = v_me.company_id and deleted_at is null for update;
  if v_row.id is null then raise exception 'NOT_FOUND'; end if;
  if not (v_row.owner_member_id = v_me.id or (v_row.scope = 'company' and v_me.role in ('admin', 'super_admin'))) then
    raise exception 'NOT_ALLOWED';
  end if;
  update public.vault_files set deleted_at = now(), deleted_by = v_me.id where id = p_id;
  return jsonb_build_object('trashed', true, 'days', private.vault_trash_days(v_me.company_id));
end;
$$;

-- 휴지통 한 줄 찾기 + 권한(복구·영구 삭제 공통)
create or replace function private.vault_trash_row(p_id uuid, p_me public.members)
returns public.vault_files
language plpgsql security definer
set search_path = ''
as $$
declare v_row public.vault_files;
begin
  select * into v_row from public.vault_files where id = p_id and company_id = p_me.company_id and deleted_at is not null for update;
  if v_row.id is null then raise exception 'NOT_FOUND'; end if;
  if not (v_row.owner_member_id = p_me.id or (v_row.scope = 'company' and p_me.role in ('admin', 'super_admin'))) then
    raise exception 'NOT_ALLOWED';
  end if;
  return v_row;
end;
$$;
revoke all on function private.vault_trash_row(uuid, public.members) from public, anon, authenticated;

create or replace function public.vault_restore(p_id uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_me public.members := private.require_member();
  v_row public.vault_files := private.vault_trash_row(p_id, v_me);
begin
  update public.vault_files set deleted_at = null, deleted_by = null where id = v_row.id;
end;
$$;

-- 영구 삭제(한 개): 기록을 지우고 파일 경로를 돌려준다(서버가 저장소에서 지움)
create or replace function public.vault_purge(p_id uuid)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_me public.members := private.require_member();
  v_row public.vault_files := private.vault_trash_row(p_id, v_me);
begin
  delete from public.vault_files where id = v_row.id;
  return jsonb_build_object('path', v_row.path, 'thumb_path', v_row.thumb_path);
end;
$$;

-- 휴지통 비우기: 내가 영구 삭제할 수 있는 것 전부 → 경로 목록
create or replace function public.vault_empty_trash()
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_me public.members := private.require_member();
  v_admin boolean := v_me.role in ('admin', 'super_admin');
  v_paths jsonb;
begin
  with d as (
    delete from public.vault_files
     where company_id = v_me.company_id and deleted_at is not null
       and (owner_member_id = v_me.id or (scope = 'company' and v_admin))
    returning path, thumb_path
  )
  select coalesce(jsonb_agg(jsonb_build_object('path', path, 'thumb_path', thumb_path)), '[]'::jsonb) into v_paths from d;
  return v_paths;
end;
$$;

-- 밤 작업(service role): 휴지통 기간이 지난 파일
create or replace function public.vault_trash_due()
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', v.id, 'path', v.path, 'thumb_path', v.thumb_path)), '[]'::jsonb)
  from public.vault_files v
  where v.deleted_at is not null
    and v.deleted_at < now() - make_interval(days => private.vault_trash_days(v.company_id))
$$;

revoke all on function public.vault_restore(uuid), public.vault_purge(uuid), public.vault_empty_trash() from public, anon;
grant execute on function public.vault_restore(uuid), public.vault_purge(uuid), public.vault_empty_trash() to authenticated;
revoke all on function public.vault_trash_due() from public, anon, authenticated;
grant execute on function public.vault_trash_due() to service_role;
