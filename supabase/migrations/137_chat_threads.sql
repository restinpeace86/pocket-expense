-- =============================================================================
-- 137_chat_threads.sql — 서브 대화(스레드 · 이슈 카드) (D-246, spec/features/improvement-2026-11.md §A)
-- - 1:1·단체·결의서 방의 메시지 하나에 서브 대화 하나(root_message_id unique). 메인 대화에는 카드만
-- - 서브 대화 글 = chat_messages.thread_id. 메인 목록·안 읽은 수·방 마지막 글·방 순서에는 넣지 않음
-- - 종결은 선택(요약 한 줄) + 다시 열기 — 만든 사람·회사 관리자
-- - 참여자(만든 사람·원글 쓴 사람·글 쓴 사람)만 웹푸시·'새 글' 수·[내 서브 대화]
-- - 실시간: 'thread'(만들기·종결·다시 열기) = 방 참여자 모두, 'thread_message'(글) = 방 참여자 모두(+ 참여자 목록)
-- =============================================================================

create table public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  room_id uuid not null,
  root_message_id uuid not null unique references public.chat_messages (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 40),
  status text not null default 'open' check (status in ('open', 'closed')),
  summary text check (summary is null or char_length(summary) <= 60),
  created_by uuid,
  closed_by uuid,
  closed_at timestamptz,
  message_count integer not null default 0,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  unique (id, company_id),
  foreign key (room_id, company_id) references public.chat_rooms (id, company_id) on delete cascade,
  foreign key (created_by, company_id) references public.members (id, company_id) on delete set null (created_by),
  foreign key (closed_by, company_id) references public.members (id, company_id) on delete set null (closed_by)
);
create index chat_threads_room_idx on public.chat_threads (room_id, last_message_at desc);

alter table public.chat_messages add column thread_id uuid;
alter table public.chat_messages add constraint chat_messages_thread_fk foreign key (thread_id, company_id) references public.chat_threads (id, company_id) on delete cascade;
create index chat_messages_thread_idx on public.chat_messages (thread_id, created_at desc) where thread_id is not null;
create index chat_messages_room_main_idx on public.chat_messages (room_id, created_at desc) where thread_id is null;

create table public.chat_thread_reads (
  thread_id uuid not null,
  company_id uuid not null,
  member_id uuid not null,
  participant boolean not null default false,
  last_read_at timestamptz not null default now(),
  primary key (thread_id, member_id),
  foreign key (thread_id, company_id) references public.chat_threads (id, company_id) on delete cascade,
  foreign key (member_id, company_id) references public.members (id, company_id) on delete cascade
);
create index chat_thread_reads_member_idx on public.chat_thread_reads (member_id) where participant;

-- 표는 함수로만(읽기·쓰기 모두)
alter table public.chat_threads enable row level security;
alter table public.chat_threads force row level security;
alter table public.chat_thread_reads enable row level security;
alter table public.chat_thread_reads force row level security;
revoke all on public.chat_threads, public.chat_thread_reads from anon, authenticated;

-- 그 방에서 그 시각의 글을 볼 수 있나(메인과 같은 규칙: 초대받은 단체방은 들어온 뒤 것만, 1:1·결의서 방은 처음부터)
create or replace function private.chat_can_see(p_room uuid, p_at timestamptz)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select private.is_chat_member(p_room) and (
    (select kind from public.chat_rooms where id = p_room) in ('claim', 'direct')
    or p_at >= (select joined_at from public.chat_members where room_id = p_room and member_id = private.current_member_id()) - interval '1 second'
  )
$$;

create or replace function private.chat_thread_participants(p_thread uuid)
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(r.member_id order by r.member_id), '[]') from public.chat_thread_reads r
  join public.chat_threads t on t.id = r.thread_id
  join public.chat_members cm on cm.room_id = t.room_id and cm.member_id = r.member_id and cm.left_at is null
  where r.thread_id = p_thread and r.participant
$$;

-- 서브 대화 카드 모양(화면·실시간 공통). new/mine은 부른 사람 기준(실시간으로 갈 때는 화면이 스스로 셈)
create or replace function private.chat_thread_json(t public.chat_threads)
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', t.id, 'room_id', t.room_id, 'root_message_id', t.root_message_id, 'title', t.title, 'status', t.status, 'summary', t.summary,
    'created_by', t.created_by, 'created_by_name', (select m.name from public.members m where m.id = t.created_by),
    'closed_by_name', (select m.name from public.members m where m.id = t.closed_by), 'closed_at', t.closed_at,
    'message_count', t.message_count, 'last_message_at', coalesce(t.last_message_at, t.created_at), 'created_at', t.created_at,
    'people', (select coalesce(jsonb_agg(jsonb_build_object('member_id', x.member_id, 'name', x.name) order by x.first_at), '[]') from (
        select r.member_id, m.name, coalesce((select min(cm2.created_at) from public.chat_messages cm2 where cm2.thread_id = t.id and cm2.sender_member_id = r.member_id), t.created_at) as first_at
        from public.chat_thread_reads r join public.members m on m.id = r.member_id
        where r.thread_id = t.id and r.participant
        order by first_at limit 5) x),
    'people_count', (select count(*) from public.chat_thread_reads r where r.thread_id = t.id and r.participant),
    'mine', exists (select 1 from public.chat_thread_reads r where r.thread_id = t.id and r.member_id = private.current_member_id() and r.participant),
    'new', (select count(*) from public.chat_messages m
            where m.thread_id = t.id and m.deleted_at is null and m.sender_member_id is distinct from private.current_member_id()
              and exists (select 1 from public.chat_thread_reads r where r.thread_id = t.id and r.member_id = private.current_member_id() and r.participant)
              and m.created_at > coalesce((select r.last_read_at from public.chat_thread_reads r where r.thread_id = t.id and r.member_id = private.current_member_id()), t.created_at))
  )
$$;

-- 메시지 한 줄에 thread_id + (원글이면) 서브 대화 카드
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
    'link', p.link,
    'attachment_path', case when p.deleted_at is null and p.attachment_purged_at is null then p.attachment_path end,
    'attachment_thumb_path', case when p.deleted_at is null and p.attachment_purged_at is null then p.attachment_thumb_path end,
    'attachment_name', case when p.deleted_at is null then p.attachment_name end,
    'attachment_size', case when p.deleted_at is null then p.attachment_size end,
    'attachment_mime', case when p.deleted_at is null then p.attachment_mime end,
    'width', p.width, 'height', p.height,
    'created_at', p.created_at, 'deleted', p.deleted_at is not null,
    'expired', p.deleted_at is null and p.attachment_purged_at is not null,
    'thread_id', p.thread_id,
    'thread', (select private.chat_thread_json(t) from public.chat_threads t where t.root_message_id = p.id)
  )
$$;

-- 실시간: 서브 대화 글은 'thread_message'(방 순서·마지막 글은 그대로), 메인 글은 지금처럼
create or replace function private.chat_messages_realtime()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_thread public.chat_threads;
begin
  if new.thread_id is not null then
    if tg_op = 'INSERT' or new.deleted_at is distinct from old.deleted_at then
      select * into v_thread from public.chat_threads where id = new.thread_id;
      perform private.chat_notify(new.room_id, 'thread_message', jsonb_build_object(
        'room_id', new.room_id, 'thread', private.chat_thread_json(v_thread), 'message', private.chat_message_json(new),
        'participants', private.chat_thread_participants(new.thread_id), 'insert', tg_op = 'INSERT'));
    end if;
    return null;
  end if;
  if tg_op = 'INSERT' then
    update public.chat_rooms set last_message_at = new.created_at where id = new.room_id;
    perform private.chat_notify(new.room_id, 'message', private.chat_message_json(new));
  elsif new.deleted_at is distinct from old.deleted_at then
    perform private.chat_notify(new.room_id, 'message_update', private.chat_message_json(new));
  end if;
  return null;
end;
$$;

-- ── 메인 대화에서 서브 대화 글 빼기 ──────────────────────────────────────────
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
      where room_id = p_room and thread_id is null
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
        'last', (select private.chat_message_json(lm) from public.chat_messages lm where lm.room_id = r.id and lm.thread_id is null order by lm.created_at desc, lm.id desc limit 1),
        'unread', (select count(*) from public.chat_messages um where um.room_id = r.id and um.thread_id is null and um.created_at > cm.last_read_at
                    and um.sender_member_id is distinct from v_me.id and um.kind <> 'system' and um.deleted_at is null),
        'members', private.chat_room_members_json(r.id)
      ) as x
      from public.chat_members cm join public.chat_rooms r on r.id = cm.room_id
      where cm.member_id = v_me.id and cm.left_at is null and r.company_id = v_me.company_id
        and (r.kind <> 'direct' or r.last_message_at is not null or r.created_by_member_id = v_me.id)
    ) t
  );
end;
$$;

create or replace function public.chat_unread_total()
returns integer
language sql stable security definer
set search_path = ''
as $$
  select case when private.current_member_id() is null or not private.feature_enabled(private.current_company_id(), 'messenger') then null else (
    select count(*)::integer from public.chat_members cm
    join public.chat_messages m on m.room_id = cm.room_id and m.created_at > cm.last_read_at and m.thread_id is null
    where cm.member_id = private.current_member_id() and cm.left_at is null
      and m.sender_member_id is distinct from cm.member_id and m.kind <> 'system' and m.deleted_at is null
  ) end
$$;

-- ── 보내기: p_thread(서브 대화)를 받음 ──────────────────────────────────────
drop function public.chat_send(uuid, uuid, text, text, jsonb);
create function public.chat_send(
  p_room uuid,
  p_id uuid,
  p_kind text,
  p_body text default null,
  p_attachment jsonb default null,
  p_thread uuid default null
)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_me public.members := private.require_chat();
  v_row public.chat_messages;
  v_thread public.chat_threads;
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
  if p_thread is not null then
    select * into v_thread from public.chat_threads where id = p_thread and room_id = p_room;
    if v_thread.id is null or not private.chat_can_see(p_room, v_thread.created_at) then raise exception 'NOT_FOUND'; end if;
    if v_thread.status <> 'open' then raise exception 'THREAD_CLOSED'; end if;
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
  if v_thread.id is not null then
    -- 글 쓴 사람은 참여자(카드 숫자가 실시간 알림에 바로 반영되게 먼저)
    insert into public.chat_thread_reads (thread_id, company_id, member_id, participant, last_read_at)
      values (v_thread.id, v_me.company_id, v_me.id, true, clock_timestamp())
      on conflict (thread_id, member_id) do update set participant = true, last_read_at = clock_timestamp();
    update public.chat_threads set message_count = message_count + 1, last_message_at = clock_timestamp() where id = v_thread.id;
  end if;
  insert into public.chat_messages (id, room_id, company_id, sender_member_id, kind, body, attachment_path, attachment_name, attachment_size, attachment_mime, width, height, attachment_thumb_path, attachment_thumb_size, thread_id)
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
    least(v_thumb_size, 2097152)::integer,
    v_thread.id
  ) returning * into v_row;
  if v_thread.id is null then
    update public.chat_members set last_read_at = greatest(last_read_at, v_row.created_at) where room_id = p_room and member_id = v_me.id;
  end if;
  return private.chat_message_json(v_row);
end;
$$;
revoke all on function public.chat_send(uuid, uuid, text, text, jsonb, uuid) from public, anon;
grant execute on function public.chat_send(uuid, uuid, text, text, jsonb, uuid) to authenticated;

-- 웹푸시 받는 사람: 서브 대화 글은 그 서브 대화 참여자만(보낸 사람 빼고), 제목 = "방 › 서브 대화 제목"
create or replace function public.chat_claim_push(p_id uuid)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_me public.members := private.require_chat();
  v_row public.chat_messages;
  v_room public.chat_rooms;
  v_thread public.chat_threads;
begin
  update public.chat_messages set pushed_at = now()
    where id = p_id and sender_member_id = v_me.id and pushed_at is null and kind <> 'system' and created_at > now() - interval '10 minutes'
    returning * into v_row;
  if v_row.id is null then return null; end if;
  select * into v_room from public.chat_rooms where id = v_row.room_id;
  if v_row.thread_id is not null then select * into v_thread from public.chat_threads where id = v_row.thread_id; end if;
  return jsonb_build_object(
    'room_id', v_row.room_id,
    'company_id', v_row.company_id,
    'kind', v_room.kind,
    'room_title', coalesce(v_room.title, (select c.title from public.expense_claims c where c.id = v_room.claim_id)),
    'sender_name', v_me.name,
    'message_kind', v_row.kind,
    'body', left(v_row.body, 120),
    'thread_id', v_thread.id,
    'thread_title', v_thread.title,
    'recipients', case when v_thread.id is null then
        (select coalesce(jsonb_agg(cm.member_id), '[]') from public.chat_members cm where cm.room_id = v_row.room_id and cm.left_at is null and cm.member_id <> v_me.id)
      else
        (select coalesce(jsonb_agg(r.member_id), '[]') from public.chat_thread_reads r
          join public.chat_members cm on cm.room_id = v_row.room_id and cm.member_id = r.member_id and cm.left_at is null
          where r.thread_id = v_thread.id and r.participant and r.member_id <> v_me.id)
      end
  );
end;
$$;

-- ── 서브 대화 만들기·종결·다시 열기 ─────────────────────────────────────────
create or replace function public.chat_thread_open(p_root uuid, p_title text)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_me public.members := private.require_chat();
  v_root public.chat_messages;
  v_kind text;
  v_thread public.chat_threads;
  v_title text := btrim(coalesce(p_title, ''));
begin
  select * into v_root from public.chat_messages where id = p_root;
  if v_root.id is null or not private.chat_can_see(v_root.room_id, v_root.created_at) then raise exception 'NOT_FOUND'; end if;
  select kind into v_kind from public.chat_rooms where id = v_root.room_id;
  if v_kind not in ('direct', 'group', 'claim') or v_root.thread_id is not null or v_root.kind not in ('text', 'image', 'file') or v_root.deleted_at is not null then
    raise exception 'THREAD_NOT_ALLOWED';
  end if;
  select * into v_thread from public.chat_threads where root_message_id = p_root;
  if v_thread.id is not null then return private.chat_thread_json(v_thread); end if; -- 동시에 만들면 먼저 만든 것
  if char_length(v_title) not between 1 and 40 then raise exception 'INVALID_THREAD_TITLE'; end if;
  insert into public.chat_threads (company_id, room_id, root_message_id, title, created_by)
    values (v_me.company_id, v_root.room_id, p_root, v_title, v_me.id)
    on conflict (root_message_id) do nothing
    returning * into v_thread;
  if v_thread.id is null then
    select * into v_thread from public.chat_threads where root_message_id = p_root;
    return private.chat_thread_json(v_thread);
  end if;
  insert into public.chat_thread_reads (thread_id, company_id, member_id, participant)
    select v_thread.id, v_me.company_id, x.id, true from (select v_me.id union select v_root.sender_member_id) x(id)
    where x.id is not null and exists (select 1 from public.chat_members cm where cm.room_id = v_root.room_id and cm.member_id = x.id and cm.left_at is null)
    on conflict do nothing;
  perform private.chat_notify(v_root.room_id, 'thread', jsonb_build_object('room_id', v_root.room_id, 'thread', private.chat_thread_json(v_thread)));
  return private.chat_thread_json(v_thread);
end;
$$;

create or replace function private.chat_thread_guard(p_thread uuid)
returns public.chat_threads
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_thread public.chat_threads;
begin
  select * into v_thread from public.chat_threads where id = p_thread;
  if v_thread.id is null or not private.chat_can_see(v_thread.room_id, v_thread.created_at) then raise exception 'NOT_FOUND'; end if;
  return v_thread;
end;
$$;

create or replace function public.chat_thread_close(p_thread uuid, p_summary text)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_me public.members := private.require_chat();
  v_thread public.chat_threads := private.chat_thread_guard(p_thread);
begin
  if v_thread.created_by is distinct from v_me.id and not private.is_admin() then raise exception 'NOT_ALLOWED'; end if;
  update public.chat_threads set status = 'closed', summary = nullif(left(btrim(coalesce(p_summary, '')), 60), ''), closed_by = v_me.id, closed_at = now()
    where id = p_thread returning * into v_thread;
  perform private.chat_notify(v_thread.room_id, 'thread', jsonb_build_object('room_id', v_thread.room_id, 'thread', private.chat_thread_json(v_thread)));
  return private.chat_thread_json(v_thread);
end;
$$;

create or replace function public.chat_thread_reopen(p_thread uuid)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_me public.members := private.require_chat();
  v_thread public.chat_threads := private.chat_thread_guard(p_thread);
begin
  if v_thread.created_by is distinct from v_me.id and not private.is_admin() then raise exception 'NOT_ALLOWED'; end if;
  update public.chat_threads set status = 'open', closed_by = null, closed_at = null where id = p_thread returning * into v_thread;
  perform private.chat_notify(v_thread.room_id, 'thread', jsonb_build_object('room_id', v_thread.room_id, 'thread', private.chat_thread_json(v_thread)));
  return private.chat_thread_json(v_thread);
end;
$$;

-- ── 읽기 ────────────────────────────────────────────────────────────────────
create or replace function public.chat_thread_detail(p_thread uuid)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_me public.members := private.require_chat();
  v_thread public.chat_threads := private.chat_thread_guard(p_thread);
begin
  return private.chat_thread_json(v_thread) || jsonb_build_object(
    'root', (select private.chat_message_json(m) from public.chat_messages m where m.id = v_thread.root_message_id),
    'can_manage', v_thread.created_by = v_me.id or private.is_admin());
end;
$$;

create or replace function public.chat_thread_messages(p_thread uuid, p_before timestamptz default null, p_after timestamptz default null, p_limit integer default 50)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_me public.members := private.require_chat();
  v_thread public.chat_threads := private.chat_thread_guard(p_thread);
begin
  return (
    select coalesce(jsonb_agg(private.chat_message_json(m) order by m.created_at desc, m.id desc), '[]') from (
      select * from public.chat_messages
      where thread_id = p_thread
        and (p_before is null or created_at < p_before)
        and (p_after is null or created_at > p_after)
      order by created_at desc, id desc
      limit least(greatest(coalesce(p_limit, 50), 1), 100)
    ) m
  );
end;
$$;

-- 이 방 서브 대화(진행 중·종결 모두, 최근 글 순)
create or replace function public.chat_thread_list(p_room uuid)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_me public.members := private.require_chat();
begin
  if not private.is_chat_member(p_room) then raise exception 'NOT_FOUND'; end if;
  return (
    select coalesce(jsonb_agg(private.chat_thread_json(t) || jsonb_build_object('root_sender_name', (select mm.name from public.chat_messages rm join public.members mm on mm.id = rm.sender_member_id where rm.id = t.root_message_id))
      order by coalesce(t.last_message_at, t.created_at) desc), '[]')
    from public.chat_threads t
    where t.room_id = p_room and private.chat_can_see(p_room, t.created_at)
  );
end;
$$;

-- [내 서브 대화]: 내가 참여한 서브 대화(여러 방), 최근 글 순 100개
create or replace function public.chat_my_threads()
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_me public.members := private.require_chat();
begin
  return (
    select coalesce(jsonb_agg(x order by x ->> 'last_message_at' desc), '[]') from (
      select private.chat_thread_json(t) || jsonb_build_object(
        'room_kind', r.kind,
        'room_title', coalesce(r.title, (select c.title from public.expense_claims c where c.id = r.claim_id),
          case when r.kind = 'direct' then (select m.name from public.chat_members cm2 join public.members m on m.id = cm2.member_id where cm2.room_id = r.id and cm2.member_id <> v_me.id limit 1) end),
        'room_members', (select count(*) from public.chat_members cm3 where cm3.room_id = r.id and cm3.left_at is null)
      ) as x
      from public.chat_thread_reads tr
      join public.chat_threads t on t.id = tr.thread_id
      join public.chat_rooms r on r.id = t.room_id
      join public.chat_members cm on cm.room_id = r.id and cm.member_id = v_me.id and cm.left_at is null
      where tr.member_id = v_me.id and tr.participant
      order by coalesce(t.last_message_at, t.created_at) desc
      limit 100
    ) s
  );
end;
$$;

-- [내 서브 대화] 새 글 합(채팅 목록 줄 배지)
create or replace function public.chat_my_threads_new()
returns integer
language sql stable security definer
set search_path = ''
as $$
  select coalesce(sum((select count(*) from public.chat_messages m
    where m.thread_id = tr.thread_id and m.deleted_at is null and m.sender_member_id is distinct from tr.member_id and m.created_at > tr.last_read_at)), 0)::integer
  from public.chat_thread_reads tr
  join public.chat_threads t on t.id = tr.thread_id
  join public.chat_members cm on cm.room_id = t.room_id and cm.member_id = tr.member_id and cm.left_at is null
  where tr.member_id = private.current_member_id() and tr.participant
    and private.feature_enabled(private.current_company_id(), 'messenger')
$$;

create or replace function public.chat_thread_mark_read(p_thread uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_me public.members := private.require_chat();
  v_thread public.chat_threads := private.chat_thread_guard(p_thread);
begin
  insert into public.chat_thread_reads (thread_id, company_id, member_id, participant, last_read_at)
    values (v_thread.id, v_me.company_id, v_me.id, false, clock_timestamp())
    on conflict (thread_id, member_id) do update set last_read_at = clock_timestamp();
end;
$$;

revoke all on function private.chat_can_see(uuid, timestamptz), private.chat_thread_participants(uuid), private.chat_thread_json(public.chat_threads), private.chat_thread_guard(uuid) from public, anon, authenticated;
revoke all on function public.chat_thread_open(uuid, text), public.chat_thread_close(uuid, text), public.chat_thread_reopen(uuid), public.chat_thread_detail(uuid),
  public.chat_thread_messages(uuid, timestamptz, timestamptz, integer), public.chat_thread_list(uuid), public.chat_my_threads(), public.chat_my_threads_new(), public.chat_thread_mark_read(uuid) from public, anon;
grant execute on function public.chat_thread_open(uuid, text), public.chat_thread_close(uuid, text), public.chat_thread_reopen(uuid), public.chat_thread_detail(uuid),
  public.chat_thread_messages(uuid, timestamptz, timestamptz, integer), public.chat_thread_list(uuid), public.chat_my_threads(), public.chat_my_threads_new(), public.chat_thread_mark_read(uuid) to authenticated;
