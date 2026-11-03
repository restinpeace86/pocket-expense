-- =============================================================================
-- 106_messenger.sql — 사내 메신저(같은 회사 직원끼리) + 회사별 기능 스위치 (D-203, spec/features/messenger.md)
-- - company_features: 회사별 기능 스위치(기본 꺼짐). 화면 버튼 없음 — 운영자만 DB(service role)에서 켠다.
-- - chat_rooms(1:1 direct · 그룹 group · 소명서 claim) / chat_members(참여·읽은 위치) / chat_messages
-- - 쓰기는 모두 security definer 함수로만(스위치·회사·참여자 확인). 직원 권한으로 표에 직접 쓰지 못한다.
-- - 실시간: 메시지·읽음·방 변경을 참여자별 비공개 주제 'chat:{member_id}'로 보낸다(realtime.send).
--   realtime.messages 읽기 정책 = 내 주제 + 스위치 켜짐. 클라이언트가 남의 주제로 보내는 정책은 없다.
-- - 첨부: 비공개 버킷 chat-files/{company_id}/{room_id}/{uuid}.{ext} — 그 방 참여자만 올리고 읽는다.
-- - 관리자도 자기가 참여한 방만 본다(직원 대화 열람 없음). 회사 삭제 시 연쇄 삭제.
-- =============================================================================

-- ── 기능 스위치 ─────────────────────────────────────────────────────────────
create table public.company_features (
  company_id uuid not null references public.companies (id) on delete cascade,
  feature text not null check (feature in ('messenger', 'attendance')),
  enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (company_id, feature)
);
alter table public.company_features enable row level security;
alter table public.company_features force row level security;
grant select on public.company_features to authenticated;
create policy company_features_select on public.company_features for select to authenticated
  using (company_id = (select private.current_company_id()));

create or replace function private.feature_enabled(p_company uuid, p_feature text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce((select f.enabled from public.company_features f where f.company_id = p_company and f.feature = p_feature), false)
$$;

-- 화면(서버)이 메뉴·주소를 보여 줄지 판단할 때
create or replace function public.my_feature_enabled(p_feature text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select private.current_company_id() is not null and private.feature_enabled(private.current_company_id(), p_feature)
$$;
revoke all on function public.my_feature_enabled(text) from public, anon;
grant execute on function public.my_feature_enabled(text) to authenticated;

-- ── 표 ──────────────────────────────────────────────────────────────────────
create table public.chat_rooms (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  kind text not null check (kind in ('direct', 'group', 'claim')),
  title text check (title is null or char_length(btrim(title)) between 1 and 50),
  direct_key text, -- 1:1: 두 멤버 id를 정렬해 이은 값(같은 두 사람은 방 하나)
  claim_id uuid,
  created_by_member_id uuid,
  created_at timestamptz not null default now(),
  last_message_at timestamptz,
  unique (id, company_id),
  unique (company_id, direct_key),
  unique (company_id, claim_id),
  check ((kind = 'direct') = (direct_key is not null)),
  check ((kind = 'claim') = (claim_id is not null)),
  foreign key (claim_id, company_id) references public.expense_claims (id, company_id) on delete cascade,
  foreign key (created_by_member_id, company_id) references public.members (id, company_id) on delete set null (created_by_member_id)
);
create index chat_rooms_company_idx on public.chat_rooms (company_id, last_message_at desc);

create table public.chat_members (
  room_id uuid not null,
  company_id uuid not null,
  member_id uuid not null,
  joined_at timestamptz not null default now(),
  last_read_at timestamptz not null default now(),
  left_at timestamptz,
  primary key (room_id, member_id),
  foreign key (room_id, company_id) references public.chat_rooms (id, company_id) on delete cascade,
  foreign key (member_id, company_id) references public.members (id, company_id) on delete cascade
);
create index chat_members_member_idx on public.chat_members (member_id) where left_at is null;

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null,
  company_id uuid not null,
  sender_member_id uuid,
  kind text not null check (kind in ('text', 'image', 'file', 'system')),
  body text check (body is null or char_length(body) <= 4000),
  attachment_path text check (attachment_path is null or char_length(attachment_path) <= 300),
  attachment_name text check (attachment_name is null or char_length(attachment_name) <= 200),
  attachment_size integer check (attachment_size is null or attachment_size between 0 and 20971520),
  attachment_mime text check (attachment_mime is null or char_length(attachment_mime) <= 100),
  width integer,
  height integer,
  created_at timestamptz not null default clock_timestamp(),
  deleted_at timestamptz,
  pushed_at timestamptz,
  foreign key (room_id, company_id) references public.chat_rooms (id, company_id) on delete cascade,
  foreign key (sender_member_id, company_id) references public.members (id, company_id) on delete set null (sender_member_id),
  check (kind <> 'text' or deleted_at is not null or char_length(btrim(coalesce(body, ''))) >= 1),
  check (kind not in ('image', 'file') or deleted_at is not null or attachment_path is not null)
);
create index chat_messages_room_idx on public.chat_messages (room_id, created_at desc);

-- 직접 쓰기 없음. 읽기도 함수로 하지만, 안전망으로 참여한 방만 보이게
alter table public.chat_rooms enable row level security;
alter table public.chat_rooms force row level security;
alter table public.chat_members enable row level security;
alter table public.chat_members force row level security;
alter table public.chat_messages enable row level security;
alter table public.chat_messages force row level security;

-- 지금 내가 참여 중인 방인가(스위치 켜짐 + 같은 회사 + 나가지 않음)
create or replace function private.is_chat_member(p_room uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.chat_members cm
    where cm.room_id = p_room
      and cm.member_id = private.current_member_id()
      and cm.company_id = private.current_company_id()
      and cm.left_at is null
  ) and private.feature_enabled(private.current_company_id(), 'messenger')
$$;

grant select on public.chat_rooms, public.chat_members, public.chat_messages to authenticated;
create policy chat_rooms_select on public.chat_rooms for select to authenticated
  using (company_id = (select private.current_company_id()) and private.is_chat_member(id));
create policy chat_members_select on public.chat_members for select to authenticated
  using (company_id = (select private.current_company_id()) and private.is_chat_member(room_id));
create policy chat_messages_select on public.chat_messages for select to authenticated
  using (company_id = (select private.current_company_id()) and private.is_chat_member(room_id));

-- ── 공통 도우미 ─────────────────────────────────────────────────────────────
-- 메신저를 쓸 수 있는 멤버(승인 + 스위치 켜짐)
create or replace function private.require_chat()
returns public.members
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v public.members;
begin
  select * into v from public.members m where m.id = private.current_member_id();
  if v.id is null then raise exception 'NOT_MEMBER'; end if;
  if not private.feature_enabled(v.company_id, 'messenger') then raise exception 'FEATURE_DISABLED'; end if;
  return v;
end;
$$;

-- 방 참여자(나가지 않은 사람) 각자의 주제로 실시간 보내기
create or replace function private.chat_notify(p_room uuid, p_event text, p_payload jsonb)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  r record;
begin
  for r in select member_id from public.chat_members where room_id = p_room and left_at is null loop
    perform realtime.send(p_payload, p_event, 'chat:' || r.member_id::text, true);
  end loop;
end;
$$;

-- 메시지 한 줄(보낸 사람 이름 포함) — 화면·실시간 공통 모양
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
    'attachment_path', case when p.deleted_at is null then p.attachment_path end,
    'attachment_name', case when p.deleted_at is null then p.attachment_name end,
    'attachment_size', case when p.deleted_at is null then p.attachment_size end,
    'attachment_mime', case when p.deleted_at is null then p.attachment_mime end,
    'width', p.width, 'height', p.height,
    'created_at', p.created_at, 'deleted', p.deleted_at is not null
  )
$$;

create or replace function private.chat_system(p_room uuid, p_company uuid, p_actor uuid, p_body text)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.chat_messages (room_id, company_id, sender_member_id, kind, body) values (p_room, p_company, p_actor, 'system', p_body);
end;
$$;

-- 새 메시지·삭제 → 참여자에게 실시간
create or replace function private.chat_messages_realtime()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.chat_rooms set last_message_at = new.created_at where id = new.room_id;
    perform private.chat_notify(new.room_id, 'message', private.chat_message_json(new));
  elsif new.deleted_at is distinct from old.deleted_at then
    perform private.chat_notify(new.room_id, 'message_update', private.chat_message_json(new));
  end if;
  return null;
end;
$$;
create trigger chat_messages_realtime after insert or update on public.chat_messages
  for each row execute function private.chat_messages_realtime();

-- 같은 회사의 승인된 멤버만 초대할 수 있다
create or replace function private.chat_valid_members(p_company uuid, p_ids uuid[])
returns uuid[]
language sql stable security definer
set search_path = ''
as $$
  select coalesce(array_agg(distinct m.id), '{}') from public.members m
  where m.company_id = p_company and m.status = 'approved' and m.id = any (p_ids)
$$;

-- ── 방 만들기·열기 ──────────────────────────────────────────────────────────
-- 1:1: 같은 두 사람은 방 하나. 이미 있으면 그 방
create or replace function public.chat_open_direct(p_member uuid)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_me public.members := private.require_chat();
  v_key text;
  v_room uuid;
begin
  if p_member = v_me.id then raise exception 'INVALID_MEMBER'; end if;
  if cardinality(private.chat_valid_members(v_me.company_id, array[p_member])) <> 1 then raise exception 'INVALID_MEMBER'; end if;
  v_key := least(v_me.id::text, p_member::text) || ':' || greatest(v_me.id::text, p_member::text);
  select id into v_room from public.chat_rooms where company_id = v_me.company_id and direct_key = v_key;
  if v_room is null then
    insert into public.chat_rooms (company_id, kind, direct_key, created_by_member_id)
      values (v_me.company_id, 'direct', v_key, v_me.id)
      on conflict (company_id, direct_key) do nothing
      returning id into v_room;
    if v_room is null then
      select id into v_room from public.chat_rooms where company_id = v_me.company_id and direct_key = v_key;
    end if;
    insert into public.chat_members (room_id, company_id, member_id) values (v_room, v_me.company_id, v_me.id), (v_room, v_me.company_id, p_member)
      on conflict do nothing;
  end if;
  return v_room;
end;
$$;

-- 그룹: 나 + 고른 사람(1명 이상). 이름은 없어도 된다(참여자 이름으로 보임)
create or replace function public.chat_create_group(p_member_ids uuid[], p_title text default null)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_me public.members := private.require_chat();
  v_ids uuid[] := array_remove(private.chat_valid_members(v_me.company_id, p_member_ids), v_me.id);
  v_room uuid;
  v_title text := nullif(btrim(coalesce(p_title, '')), '');
begin
  if cardinality(v_ids) < 1 then raise exception 'INVALID_MEMBER'; end if;
  if v_title is not null and char_length(v_title) > 50 then raise exception 'TITLE_TOO_LONG'; end if;
  insert into public.chat_rooms (company_id, kind, title, created_by_member_id) values (v_me.company_id, 'group', v_title, v_me.id) returning id into v_room;
  insert into public.chat_members (room_id, company_id, member_id)
    select v_room, v_me.company_id, x from unnest(v_ids || v_me.id) x;
  perform private.chat_system(v_room, v_me.company_id, v_me.id,
    v_me.name || '님이 ' || (select string_agg(m.name || '님', ', ' order by m.name) from public.members m where m.id = any (v_ids)) || '을 초대했어요.');
  return v_room;
end;
$$;

-- 소명서 대화: 그 소명서를 볼 수 있는 사람(본인·관리자·결재자)만. 소명서마다 방 하나, 처음엔 나 + 작성자
create or replace function public.chat_open_claim(p_claim uuid)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_me public.members := private.require_chat();
  v_claim public.expense_claims;
  v_room uuid;
begin
  if not private.can_view_claim(p_claim) then raise exception 'NOT_FOUND'; end if;
  select * into v_claim from public.expense_claims where id = p_claim and company_id = v_me.company_id;
  select id into v_room from public.chat_rooms where company_id = v_me.company_id and claim_id = p_claim;
  if v_room is null then
    insert into public.chat_rooms (company_id, kind, claim_id, created_by_member_id)
      values (v_me.company_id, 'claim', p_claim, v_me.id)
      on conflict (company_id, claim_id) do nothing
      returning id into v_room;
    if v_room is null then select id into v_room from public.chat_rooms where company_id = v_me.company_id and claim_id = p_claim; end if;
  end if;
  insert into public.chat_members (room_id, company_id, member_id)
    select v_room, v_me.company_id, x from unnest(array[v_me.id, v_claim.member_id]) x
    where exists (select 1 from public.members m where m.id = x and m.status = 'approved')
    on conflict (room_id, member_id) do update set left_at = null, joined_at = case when public.chat_members.left_at is null then public.chat_members.joined_at else now() end,
      last_read_at = case when public.chat_members.left_at is null then public.chat_members.last_read_at else now() end;
  perform private.chat_notify(v_room, 'room', jsonb_build_object('room_id', v_room));
  return v_room;
end;
$$;

-- 초대(그룹·소명서 방). 1:1에서 초대하면 화면이 새 그룹을 만든다
create or replace function public.chat_invite(p_room uuid, p_member_ids uuid[])
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_me public.members := private.require_chat();
  v_room public.chat_rooms;
  v_ids uuid[];
begin
  if not private.is_chat_member(p_room) then raise exception 'NOT_FOUND'; end if;
  select * into v_room from public.chat_rooms where id = p_room;
  if v_room.kind = 'direct' then raise exception 'DIRECT_ROOM'; end if;
  select coalesce(array_agg(x), '{}') into v_ids from unnest(private.chat_valid_members(v_me.company_id, p_member_ids)) x
    where not exists (select 1 from public.chat_members cm where cm.room_id = p_room and cm.member_id = x and cm.left_at is null);
  if cardinality(v_ids) < 1 then return; end if;
  insert into public.chat_members (room_id, company_id, member_id)
    select p_room, v_me.company_id, x from unnest(v_ids) x
    on conflict (room_id, member_id) do update set left_at = null, joined_at = now(), last_read_at = now();
  perform private.chat_system(p_room, v_me.company_id, v_me.id,
    v_me.name || '님이 ' || (select string_agg(m.name || '님', ', ' order by m.name) from public.members m where m.id = any (v_ids)) || '을 초대했어요.');
  perform private.chat_notify(p_room, 'room', jsonb_build_object('room_id', p_room));
end;
$$;

-- 나가기(그룹·소명서 방). 1:1은 나가지 않는다(카톡처럼 목록에서만 지우는 기능은 나중에)
create or replace function public.chat_leave(p_room uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_me public.members := private.require_chat();
  v_kind text;
begin
  if not private.is_chat_member(p_room) then raise exception 'NOT_FOUND'; end if;
  select kind into v_kind from public.chat_rooms where id = p_room;
  if v_kind = 'direct' then raise exception 'DIRECT_ROOM'; end if;
  perform private.chat_notify(p_room, 'room', jsonb_build_object('room_id', p_room, 'left', v_me.id));
  update public.chat_members set left_at = now() where room_id = p_room and member_id = v_me.id;
  perform private.chat_system(p_room, v_me.company_id, v_me.id, v_me.name || '님이 나갔어요.');
end;
$$;

-- 방 이름 바꾸기(그룹만). 빈칸이면 참여자 이름으로
create or replace function public.chat_rename(p_room uuid, p_title text)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_me public.members := private.require_chat();
  v_title text := nullif(btrim(coalesce(p_title, '')), '');
begin
  if not private.is_chat_member(p_room) then raise exception 'NOT_FOUND'; end if;
  if (select kind from public.chat_rooms where id = p_room) <> 'group' then raise exception 'NOT_GROUP'; end if;
  if v_title is not null and char_length(v_title) > 50 then raise exception 'TITLE_TOO_LONG'; end if;
  update public.chat_rooms set title = v_title where id = p_room;
  perform private.chat_notify(p_room, 'room', jsonb_build_object('room_id', p_room));
end;
$$;

-- ── 메시지 ──────────────────────────────────────────────────────────────────
-- 보내기. p_id는 화면이 만든 id(다시 보내도 한 번만 저장). 첨부는 그 방 폴더 경로만
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
    if v_path is null or v_path not like v_me.company_id::text || '/' || p_room::text || '/%' or v_path like '%..%' then raise exception 'INVALID_ATTACHMENT'; end if;
  end if;
  insert into public.chat_messages (id, room_id, company_id, sender_member_id, kind, body, attachment_path, attachment_name, attachment_size, attachment_mime, width, height)
  values (
    p_id, p_room, v_me.company_id, v_me.id, p_kind,
    case when p_kind = 'text' then p_body end,
    case when p_kind <> 'text' then v_path end,
    case when p_kind <> 'text' then left(p_attachment ->> 'name', 200) end,
    case when p_kind <> 'text' then (p_attachment ->> 'size')::integer end,
    case when p_kind <> 'text' then left(p_attachment ->> 'mime', 100) end,
    case when p_kind = 'image' then (p_attachment ->> 'width')::integer end,
    case when p_kind = 'image' then (p_attachment ->> 'height')::integer end
  ) returning * into v_row;
  -- 보낸 사람은 자기 메시지까지 읽은 것
  update public.chat_members set last_read_at = greatest(last_read_at, v_row.created_at) where room_id = p_room and member_id = v_me.id;
  return private.chat_message_json(v_row);
end;
$$;

-- 내 메시지 삭제 → "삭제된 메시지입니다". 첨부 경로를 돌려줘 화면이 파일도 지운다
create or replace function public.chat_delete_message(p_id uuid)
returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  v_me public.members := private.require_chat();
  v_row public.chat_messages;
begin
  select * into v_row from public.chat_messages where id = p_id and company_id = v_me.company_id;
  if v_row.id is null or v_row.sender_member_id is distinct from v_me.id or v_row.kind = 'system' or not private.is_chat_member(v_row.room_id) then raise exception 'NOT_FOUND'; end if;
  if v_row.deleted_at is not null then return null; end if;
  update public.chat_messages set deleted_at = now(), body = null where id = p_id;
  return v_row.attachment_path;
end;
$$;

-- 읽음: 지금까지 읽은 것으로. 참여자에게 알려 말풍선 옆 숫자를 줄인다
create or replace function public.chat_mark_read(p_room uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_me public.members := private.require_chat();
  v_at timestamptz := clock_timestamp();
begin
  if not private.is_chat_member(p_room) then raise exception 'NOT_FOUND'; end if;
  update public.chat_members set last_read_at = v_at where room_id = p_room and member_id = v_me.id;
  perform private.chat_notify(p_room, 'read', jsonb_build_object('room_id', p_room, 'member_id', v_me.id, 'last_read_at', v_at));
end;
$$;

-- 웹푸시 한 번만: 내가 방금 보낸 메시지의 받는 사람 목록(보낸 사람·나간 사람 제외)과 알림 문구
create or replace function public.chat_claim_push(p_id uuid)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_me public.members := private.require_chat();
  v_row public.chat_messages;
  v_room public.chat_rooms;
begin
  update public.chat_messages set pushed_at = now()
    where id = p_id and sender_member_id = v_me.id and pushed_at is null and kind <> 'system' and created_at > now() - interval '10 minutes'
    returning * into v_row;
  if v_row.id is null then return null; end if;
  select * into v_room from public.chat_rooms where id = v_row.room_id;
  return jsonb_build_object(
    'room_id', v_row.room_id,
    'company_id', v_row.company_id,
    'kind', v_room.kind,
    'room_title', coalesce(v_room.title, (select c.title from public.expense_claims c where c.id = v_room.claim_id)),
    'sender_name', v_me.name,
    'message_kind', v_row.kind,
    'body', left(v_row.body, 120),
    'recipients', (select coalesce(jsonb_agg(cm.member_id), '[]') from public.chat_members cm where cm.room_id = v_row.room_id and cm.left_at is null and cm.member_id <> v_me.id)
  );
end;
$$;

-- ── 읽기 ────────────────────────────────────────────────────────────────────
-- 방 참여자(이름·퇴사 여부·읽은 위치)
create or replace function private.chat_room_members_json(p_room uuid)
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('member_id', m.id, 'name', m.name, 'status', m.status, 'last_read_at', cm.last_read_at, 'joined_at', cm.joined_at) order by m.name), '[]')
  from public.chat_members cm join public.members m on m.id = cm.member_id
  where cm.room_id = p_room and cm.left_at is null
$$;

-- 채팅 목록: 최근 대화 순, 마지막 메시지·안 읽은 수·참여자
create or replace function public.chat_room_list()
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_me public.members := private.require_chat();
begin
  return (
    select coalesce(jsonb_agg(x order by x ->> 'sort_at' desc), '[]') from (
      select jsonb_build_object(
        'id', r.id, 'kind', r.kind, 'title', r.title, 'claim_id', r.claim_id,
        'claim_title', (select c.title from public.expense_claims c where c.id = r.claim_id),
        'sort_at', coalesce(r.last_message_at, r.created_at),
        'last', (select private.chat_message_json(lm) from public.chat_messages lm where lm.room_id = r.id order by lm.created_at desc, lm.id desc limit 1),
        'unread', (select count(*) from public.chat_messages um where um.room_id = r.id and um.created_at > cm.last_read_at
                    and um.sender_member_id is distinct from v_me.id and um.kind <> 'system' and um.deleted_at is null),
        'members', private.chat_room_members_json(r.id)
      ) as x
      from public.chat_members cm join public.chat_rooms r on r.id = cm.room_id
      where cm.member_id = v_me.id and cm.left_at is null and r.company_id = v_me.company_id
        -- 1:1은 첫 메시지가 오가기 전엔 목록에 안 보임(카톡과 같게)
        and (r.kind <> 'direct' or r.last_message_at is not null or r.created_by_member_id = v_me.id)
    ) t
  );
end;
$$;

-- 방 정보(제목·종류·소명서·참여자)
create or replace function public.chat_room_detail(p_room uuid)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_me public.members := private.require_chat();
  v_room public.chat_rooms;
begin
  if not private.is_chat_member(p_room) then raise exception 'NOT_FOUND'; end if;
  select * into v_room from public.chat_rooms where id = p_room;
  return jsonb_build_object(
    'id', v_room.id, 'kind', v_room.kind, 'title', v_room.title, 'claim_id', v_room.claim_id,
    'claim', (select jsonb_build_object('id', c.id, 'title', c.title, 'status', c.status, 'total_amount', c.total_amount, 'member_id', c.member_id)
              from public.expense_claims c where c.id = v_room.claim_id),
    'members', private.chat_room_members_json(p_room)
  );
end;
$$;

-- 메시지 50개씩(최신부터). p_before보다 이전 것 / p_after보다 이후 것(다시 연결됐을 때 빈틈 메우기)
create or replace function public.chat_messages_page(p_room uuid, p_before timestamptz default null, p_after timestamptz default null, p_limit integer default 50)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_me public.members := private.require_chat();
  v_joined timestamptz;
begin
  if not private.is_chat_member(p_room) then raise exception 'NOT_FOUND'; end if;
  select joined_at into v_joined from public.chat_members where room_id = p_room and member_id = v_me.id;
  return (
    select coalesce(jsonb_agg(private.chat_message_json(m) order by m.created_at desc, m.id desc), '[]') from (
      select * from public.chat_messages
      where room_id = p_room
        -- 초대받은 사람은 들어온 뒤의 메시지만(카톡과 같게). 소명서 방은 이전 대화도 보여 맥락을 잇는다
        and (created_at >= v_joined - interval '1 second' or (select kind from public.chat_rooms where id = p_room) = 'claim'
             or (select kind from public.chat_rooms where id = p_room) = 'direct')
        and (p_before is null or created_at < p_before)
        and (p_after is null or created_at > p_after)
      order by created_at desc, id desc
      limit least(greatest(coalesce(p_limit, 50), 1), 100)
    ) m
  );
end;
$$;

-- 메뉴 배지: 스위치가 꺼졌으면 null(메뉴를 숨긴다), 켜졌으면 안 읽은 메시지 합
create or replace function public.chat_unread_total()
returns integer
language sql stable security definer
set search_path = ''
as $$
  select case when private.current_member_id() is null or not private.feature_enabled(private.current_company_id(), 'messenger') then null else (
    select count(*)::integer from public.chat_members cm
    join public.chat_messages m on m.room_id = cm.room_id and m.created_at > cm.last_read_at
    where cm.member_id = private.current_member_id() and cm.left_at is null
      and m.sender_member_id is distinct from cm.member_id and m.kind <> 'system' and m.deleted_at is null
  ) end
$$;

-- 새 대화 상대 고르기: 같은 회사 승인된 멤버(나 제외)
create or replace function public.chat_member_directory()
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_me public.members := private.require_chat();
begin
  return (
    select coalesce(jsonb_agg(jsonb_build_object('member_id', m.id, 'name', m.name, 'position', m.position,
      'department', (select d.name from public.departments d where d.id = m.department_id)) order by m.name), '[]')
    from public.members m where m.company_id = v_me.company_id and m.status = 'approved' and m.id <> v_me.id
  );
end;
$$;

revoke all on function public.chat_open_direct(uuid), public.chat_create_group(uuid[], text), public.chat_open_claim(uuid),
  public.chat_invite(uuid, uuid[]), public.chat_leave(uuid), public.chat_rename(uuid, text),
  public.chat_send(uuid, uuid, text, text, jsonb), public.chat_delete_message(uuid), public.chat_mark_read(uuid),
  public.chat_claim_push(uuid), public.chat_room_list(), public.chat_room_detail(uuid),
  public.chat_messages_page(uuid, timestamptz, timestamptz, integer), public.chat_unread_total(), public.chat_member_directory() from public, anon;
grant execute on function public.chat_open_direct(uuid), public.chat_create_group(uuid[], text), public.chat_open_claim(uuid),
  public.chat_invite(uuid, uuid[]), public.chat_leave(uuid), public.chat_rename(uuid, text),
  public.chat_send(uuid, uuid, text, text, jsonb), public.chat_delete_message(uuid), public.chat_mark_read(uuid),
  public.chat_claim_push(uuid), public.chat_room_list(), public.chat_room_detail(uuid),
  public.chat_messages_page(uuid, timestamptz, timestamptz, integer), public.chat_unread_total(), public.chat_member_directory() to authenticated;
revoke all on function private.feature_enabled(uuid, text), private.is_chat_member(uuid), private.require_chat(), private.chat_notify(uuid, text, jsonb),
  private.chat_message_json(public.chat_messages), private.chat_system(uuid, uuid, uuid, text), private.chat_messages_realtime(),
  private.chat_valid_members(uuid, uuid[]), private.chat_room_members_json(uuid) from public, anon;
grant execute on function private.feature_enabled(uuid, text), private.is_chat_member(uuid) to authenticated;

-- ── 실시간 권한: 내 주제('chat:{내 member_id}')만 받기 ───────────────────────
create policy chat_member_topic_select on realtime.messages for select to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and (select realtime.topic()) = 'chat:' || coalesce((select private.current_member_id())::text, '-')
    and (select private.feature_enabled(private.current_company_id(), 'messenger'))
  );

-- ── 첨부 보관함 ─────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit)
values ('chat-files', 'chat-files', false, 20971520)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

create policy chat_files_select on storage.objects for select to authenticated
using (
  bucket_id = 'chat-files'
  and (storage.foldername(name))[1] = (select private.current_company_id())::text
  and private.is_chat_member(((storage.foldername(name))[2])::uuid)
);
create policy chat_files_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'chat-files'
  and (storage.foldername(name))[1] = (select private.current_company_id())::text
  and private.is_chat_member(((storage.foldername(name))[2])::uuid)
);
-- 지우기: 내가 올린 파일만(메시지 삭제 때)
create policy chat_files_delete on storage.objects for delete to authenticated
using (
  bucket_id = 'chat-files'
  and owner_id = (select auth.uid())::text
  and (storage.foldername(name))[1] = (select private.current_company_id())::text
);
