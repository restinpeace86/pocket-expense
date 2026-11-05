-- =============================================================================
-- 120_assistant_room.sql — WORKON 도우미 방 1단계 (D-222, 사용자 승인 2026-11-05)
-- - 사람마다 하나인 1:1 방(chat_rooms.kind = 'assistant', assistant_member_id = 주인). 주인만 들어가고, 주인만 글을 쓴다.
-- - 주인은 그냥 대화하듯 글(text)을 쓰고, 답은 서버(service role)가 'bot' 글로 넣는다(사진·파일 없음).
-- - 'bot' 글은 도우미 방에만, 알림(notice) 글은 알림방에만. 할 수 있는 일은 조회·화면 이동뿐(쓰기·승인 없음 — 화면이 정함).
-- - 하루 30번 한도는 서버가 "오늘 이 방에 내가 보낸 글 수"로 센다(별도 표 없음).
-- =============================================================================

alter table public.chat_rooms add column if not exists assistant_member_id uuid;
alter table public.chat_rooms drop constraint if exists chat_rooms_kind_check;
alter table public.chat_rooms add constraint chat_rooms_kind_check check (kind in ('direct', 'group', 'claim', 'notice', 'assistant'));
alter table public.chat_rooms drop constraint if exists chat_rooms_assistant_check;
alter table public.chat_rooms add constraint chat_rooms_assistant_check check ((kind = 'assistant') = (assistant_member_id is not null));
alter table public.chat_rooms drop constraint if exists chat_rooms_assistant_unique;
alter table public.chat_rooms add constraint chat_rooms_assistant_unique unique (company_id, assistant_member_id);
alter table public.chat_rooms drop constraint if exists chat_rooms_assistant_member_fk;
alter table public.chat_rooms add constraint chat_rooms_assistant_member_fk foreign key (assistant_member_id, company_id) references public.members (id, company_id) on delete cascade;

alter table public.chat_messages drop constraint if exists chat_messages_kind_check;
alter table public.chat_messages add constraint chat_messages_kind_check check (kind in ('text', 'image', 'file', 'system', 'notice', 'bot'));

-- 방 종류별 글 종류: 알림방 = notice만 / 도우미 방 = 주인 text + bot / bot은 도우미 방에만
create or replace function private.chat_notice_guard_message()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_room public.chat_rooms;
begin
  select * into v_room from public.chat_rooms where id = new.room_id;
  if (v_room.kind = 'notice') <> (new.kind = 'notice') then raise exception 'NOTICE_ROOM'; end if;
  if (v_room.kind = 'assistant') then
    if new.kind not in ('text', 'bot') then raise exception 'ASSISTANT_ROOM'; end if;
    if new.kind = 'text' and new.sender_member_id is distinct from v_room.assistant_member_id then raise exception 'ASSISTANT_ROOM'; end if;
    if new.kind = 'bot' and new.sender_member_id is not null then raise exception 'ASSISTANT_ROOM'; end if;
  elsif new.kind = 'bot' then
    raise exception 'ASSISTANT_ROOM';
  end if;
  return new;
end;
$$;

create or replace function private.chat_notice_guard_member()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_room public.chat_rooms;
begin
  select * into v_room from public.chat_rooms where id = new.room_id;
  if v_room.kind = 'notice' and (new.member_id <> v_room.notice_member_id or new.left_at is not null) then raise exception 'NOTICE_ROOM'; end if;
  if v_room.kind = 'assistant' and (new.member_id <> v_room.assistant_member_id or new.left_at is not null) then raise exception 'ASSISTANT_ROOM'; end if;
  return new;
end;
$$;

-- 내 도우미 방(없으면 만든다). 메신저가 켜진 회사·승인된 멤버만(require_chat)
create or replace function public.chat_assistant_room()
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_me public.members := private.require_chat();
  v_room uuid;
begin
  select id into v_room from public.chat_rooms where company_id = v_me.company_id and assistant_member_id = v_me.id;
  if v_room is null then
    insert into public.chat_rooms (company_id, kind, title, assistant_member_id) values (v_me.company_id, 'assistant', 'WORKON 도우미', v_me.id)
      on conflict (company_id, assistant_member_id) do nothing returning id into v_room;
    if v_room is null then select id into v_room from public.chat_rooms where company_id = v_me.company_id and assistant_member_id = v_me.id; end if;
    insert into public.chat_members (room_id, company_id, member_id) values (v_room, v_me.company_id, v_me.id) on conflict do nothing;
  end if;
  return v_room;
end;
$$;
revoke all on function public.chat_assistant_room() from public, anon;
grant execute on function public.chat_assistant_room() to authenticated;
