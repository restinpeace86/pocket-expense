-- D-204 채팅 첨부 저장·트래픽 줄이기 (사용자 결정 2026-11-03)
-- - 사진: 원본 긴 변 1280px(카톡 일반 화질 수준) + 말풍선용 작은 미리보기(attachment_thumb_*). 원본은 눌렀을 때만.
-- - 보관 기간 90일: 지나면 새벽 작업이 파일을 지우고 attachment_purged_at 표시(글·말풍선은 남음).
--   삭제한 메시지의 파일, 올렸지만 메시지가 안 된 파일(하루 지난 것)도 새벽 작업이 지운다.
-- - 회사별 저장 한도(요금제별): billing_plans.chat_storage_mb — 스타터 1GB / 프로 3GB / 비즈니스 10GB.
--   결제 연동 전이라 회사에 요금제가 없으므로 지금은 모든 회사 = 스타터 한도(무료 이용 = 스타터와 같음).

alter table public.billing_plans add column chat_storage_mb integer check (chat_storage_mb is null or chat_storage_mb > 0);
update public.billing_plans set chat_storage_mb = case code when 'starter' then 1024 when 'standard' then 3072 when 'pro' then 10240 end;

alter table public.chat_messages
  add column attachment_thumb_path text check (attachment_thumb_path is null or char_length(attachment_thumb_path) <= 300),
  add column attachment_thumb_size integer check (attachment_thumb_size is null or attachment_thumb_size between 0 and 2097152),
  add column attachment_purged_at timestamptz;

-- 회사 사용량 합계·정리 대상 찾기용
create index chat_messages_attach_idx on public.chat_messages (company_id, created_at)
  where attachment_path is not null and attachment_purged_at is null;

create index chat_messages_attach_path_idx on public.chat_messages (attachment_path) where attachment_path is not null;

insert into private.app_settings (key, value) values ('chat_attachment_days', '90')
on conflict (key) do nothing;

-- 회사 채팅 첨부 한도(바이트). 결제 연동 때 회사 요금제를 읽도록 바꾼다 — 지금은 스타터
create or replace function private.chat_storage_limit(p_company uuid)
returns bigint
language sql stable security definer
set search_path = ''
as $$
  select coalesce((select chat_storage_mb from public.billing_plans where code = 'starter'), 1024)::bigint * 1024 * 1024
$$;

-- 지금 쓰는 양: 지우지 않았고 보관 기간이 지나지 않은 첨부(원본 + 미리보기)
create or replace function private.chat_storage_used(p_company uuid)
returns bigint
language sql stable security definer
set search_path = ''
as $$
  select coalesce(sum(coalesce(attachment_size, 0)::bigint + coalesce(attachment_thumb_size, 0)), 0)::bigint
  from public.chat_messages
  where company_id = p_company and attachment_path is not null and attachment_purged_at is null and deleted_at is null
$$;

create or replace function public.chat_storage_status()
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_me public.members := private.require_chat();
begin
  return jsonb_build_object(
    'used', private.chat_storage_used(v_me.company_id),
    'limit', private.chat_storage_limit(v_me.company_id),
    'days', coalesce((select value from private.app_settings where key = 'chat_attachment_days')::integer, 90)
  );
end;
$$;

create or replace function private.chat_message_json(p public.chat_messages)
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p.id, 'room_id', p.room_id, 'sender_member_id', p.sender_member_id,
    'sender_name', (select m.name from public.members m where m.id = p.sender_member_id),
    'kind', p.kind,
    'body', case when p.deleted_at is null then p.body end,
    'attachment_path', case when p.deleted_at is null and p.attachment_purged_at is null then p.attachment_path end,
    'attachment_thumb_path', case when p.deleted_at is null and p.attachment_purged_at is null then p.attachment_thumb_path end,
    'attachment_name', case when p.deleted_at is null then p.attachment_name end,
    'attachment_size', case when p.deleted_at is null then p.attachment_size end,
    'attachment_mime', case when p.deleted_at is null then p.attachment_mime end,
    'width', p.width, 'height', p.height,
    'created_at', p.created_at, 'deleted', p.deleted_at is not null,
    'expired', p.deleted_at is null and p.attachment_purged_at is not null
  )
$$;

-- 보내기: 미리보기 경로·크기 + 회사 저장 한도 확인. 크기는 저장소에 실제로 올라간 크기를 우선 쓴다
create or replace function public.chat_send(
  p_room uuid,
  p_id uuid,
  p_kind text,
  p_body text default null,
  p_attachment jsonb default null
)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_me public.members := private.require_chat();
  v_row public.chat_messages;
  v_path text := p_attachment ->> 'path';
  v_thumb text := p_attachment ->> 'thumb_path';
  v_prefix text;
  v_size bigint;
  v_thumb_size bigint;
begin
  if not private.is_chat_member(p_room) then raise exception 'NOT_FOUND'; end if;
  if p_kind not in ('text', 'image', 'file') then raise exception 'INVALID_KIND'; end if;
  select * into v_row from public.chat_messages where id = p_id;
  if v_row.id is not null then
    if v_row.sender_member_id is distinct from v_me.id or v_row.room_id <> p_room then raise exception 'INVALID_ID'; end if;
    return private.chat_message_json(v_row);
  end if;
  if p_kind = 'text' and char_length(btrim(coalesce(p_body, ''))) = 0 then raise exception 'EMPTY_MESSAGE'; end if;
  if p_kind = 'text' and char_length(p_body) > 4000 then raise exception 'MESSAGE_TOO_LONG'; end if;
  if p_kind in ('image', 'file') then
    v_prefix := v_me.company_id::text || '/' || p_room::text || '/%';
    if v_path is null or v_path not like v_prefix or v_path like '%..%' then raise exception 'INVALID_ATTACHMENT'; end if;
    if p_kind <> 'image' then v_thumb := null; end if;
    if v_thumb is not null and (v_thumb not like v_prefix or v_thumb like '%..%') then raise exception 'INVALID_ATTACHMENT'; end if;
    v_size := coalesce((select (o.metadata ->> 'size')::bigint from storage.objects o where o.bucket_id = 'chat-files' and o.name = v_path), (p_attachment ->> 'size')::bigint, 0);
    v_thumb_size := case when v_thumb is null then null
      else coalesce((select (o.metadata ->> 'size')::bigint from storage.objects o where o.bucket_id = 'chat-files' and o.name = v_thumb), (p_attachment ->> 'thumb_size')::bigint, 0) end;
    if private.chat_storage_used(v_me.company_id) + v_size + coalesce(v_thumb_size, 0) > private.chat_storage_limit(v_me.company_id) then
      raise exception 'STORAGE_FULL';
    end if;
  end if;
  insert into public.chat_messages (id, room_id, company_id, sender_member_id, kind, body, attachment_path, attachment_name, attachment_size, attachment_mime, width, height, attachment_thumb_path, attachment_thumb_size)
  values (
    p_id, p_room, v_me.company_id, v_me.id, p_kind,
    case when p_kind = 'text' then p_body end,
    case when p_kind <> 'text' then v_path end,
    case when p_kind <> 'text' then left(p_attachment ->> 'name', 200) end,
    case when p_kind <> 'text' then least(v_size, 20971520)::integer end,
    case when p_kind <> 'text' then left(p_attachment ->> 'mime', 100) end,
    case when p_kind = 'image' then (p_attachment ->> 'width')::integer end,
    case when p_kind = 'image' then (p_attachment ->> 'height')::integer end,
    v_thumb,
    least(v_thumb_size, 2097152)::integer
  ) returning * into v_row;
  update public.chat_members set last_read_at = greatest(last_read_at, v_row.created_at) where room_id = p_room and member_id = v_me.id;
  return private.chat_message_json(v_row);
end;
$$;

-- ── 새벽 정리(서버 전용, service role) ─────────────────────────────────────
-- 지울 파일 목록: ① 보관 기간이 지난 첨부 ② 삭제한 메시지의 첨부 ③ 메시지가 되지 않은 파일(하루 지난 것)
create or replace function public.chat_files_due(p_limit integer default 200)
returns table (message_id uuid, paths text[])
language sql stable security definer
set search_path = ''
as $$
  (
    select m.id, array_remove(array[m.attachment_path, m.attachment_thumb_path], null)
    from public.chat_messages m
    where m.attachment_path is not null and m.attachment_purged_at is null
      and (m.deleted_at is not null
           or m.created_at < now() - make_interval(days => coalesce((select value from private.app_settings where key = 'chat_attachment_days')::integer, 90)))
    order by m.created_at
    limit greatest(1, least(p_limit, 1000))
  )
  union all
  (
    select null::uuid, array[o.name]
    from storage.objects o
    where o.bucket_id = 'chat-files' and o.created_at < now() - interval '1 day'
      and not exists (select 1 from public.chat_messages m where m.attachment_path = o.name or m.attachment_thumb_path = o.name)
    order by o.created_at
    limit greatest(1, least(p_limit, 1000))
  )
$$;

create or replace function public.chat_files_mark_purged(p_ids uuid[])
returns integer
language sql security definer
set search_path = ''
as $$
  with u as (
    update public.chat_messages set attachment_purged_at = now()
    where id = any (p_ids) and attachment_purged_at is null
    returning 1
  )
  select count(*)::integer from u
$$;

revoke all on function private.chat_storage_limit(uuid), private.chat_storage_used(uuid) from public, anon, authenticated;
revoke all on function public.chat_storage_status() from public, anon;
grant execute on function public.chat_storage_status() to authenticated;
revoke all on function public.chat_files_due(integer), public.chat_files_mark_purged(uuid[]) from public, anon, authenticated;
grant execute on function public.chat_files_due(integer), public.chat_files_mark_purged(uuid[]) to service_role;
