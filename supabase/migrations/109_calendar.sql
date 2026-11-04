-- =============================================================================
-- 109_calendar.sql — 사내 캘린더 + 메신저 기본 켜기 + 회의 10분 전 알림방 (D-206, spec/features/calendar.md)
-- 사용자 결정(2026-11-04):
-- - 메신저는 모든 회사 기본 켜짐(company_features에 false 줄이 있으면 꺼짐 — 운영자만 DB로)
-- - 캘린더: 같은 회사 승인 멤버끼리, 비공개 없음, 기본은 내 일정만 + 사람 고르기, 시간은 10분 단위
--   스위치 'calendar'(기본 꺼짐, 운영자가 회사별로 켠다)
-- - 회의 10분 전: Supabase pg_cron이 10분마다 → 참석자(불참 제외)의 채팅 '알림'방에 "회의 시작 10분 전입니다"
--   회의는 10분 단위로만 잡히므로 10분마다 돌아도 정확히 10분 전에 들어간다.
--   휴대폰 알림(웹푸시)은 pg_net이 서비스 주소(/api/cron/reminder-push)를 부른다 — 비밀값은 Vault에 있을 때만
-- =============================================================================

-- ── 기능 스위치: 메신저 기본 켜짐, 캘린더 추가 ───────────────────────────────
alter table public.company_features drop constraint company_features_feature_check;
alter table public.company_features add constraint company_features_feature_check check (feature in ('messenger', 'attendance', 'calendar'));

create or replace function private.feature_enabled(p_company uuid, p_feature text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce(
    (select f.enabled from public.company_features f where f.company_id = p_company and f.feature = p_feature),
    p_feature = 'messenger' -- D-206: 메신저는 줄이 없으면 켜짐, 나머지는 꺼짐
  )
$$;

-- ── 캘린더 표 ───────────────────────────────────────────────────────────────
create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  created_by_member_id uuid not null,
  title text not null check (char_length(btrim(title)) between 1 and 100),
  kind text not null check (kind in ('meeting', 'outside', 'trip', 'other')),
  all_day boolean not null default false,
  starts_at timestamptz,
  ends_at timestamptz,
  start_date date,
  end_date date,
  location text check (location is null or char_length(location) <= 200),
  memo text check (memo is null or char_length(memo) <= 2000),
  reminded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, company_id),
  foreign key (created_by_member_id, company_id) references public.members (id, company_id) on delete cascade,
  check (
    (all_day and start_date is not null and end_date is not null and end_date >= start_date and end_date - start_date <= 31 and starts_at is null and ends_at is null)
    or (not all_day and starts_at is not null and ends_at is not null and ends_at > starts_at and ends_at - starts_at <= interval '14 days'
        and start_date is null and end_date is null
        -- 10분 단위(D-206): 회의 10분 전 알림이 10분마다 도는 작업과 맞도록
        and extract(epoch from starts_at)::bigint % 600 = 0 and extract(epoch from ends_at)::bigint % 600 = 0)
  )
);
create index calendar_events_company_start_idx on public.calendar_events (company_id, starts_at);
create index calendar_events_company_date_idx on public.calendar_events (company_id, start_date);
create index calendar_events_remind_idx on public.calendar_events (starts_at) where kind = 'meeting' and reminded_at is null and not all_day;

create table public.calendar_attendees (
  event_id uuid not null,
  company_id uuid not null,
  member_id uuid not null,
  response text not null default 'pending' check (response in ('pending', 'accepted', 'declined')),
  responded_at timestamptz,
  primary key (event_id, member_id),
  foreign key (event_id, company_id) references public.calendar_events (id, company_id) on delete cascade,
  foreign key (member_id, company_id) references public.members (id, company_id) on delete cascade
);
create index calendar_attendees_member_idx on public.calendar_attendees (member_id);

create table public.calendar_view_prefs (
  member_id uuid primary key,
  company_id uuid not null,
  member_ids uuid[] not null default '{}',
  show_deadlines boolean not null default true,
  updated_at timestamptz not null default now(),
  foreign key (member_id, company_id) references public.members (id, company_id) on delete cascade,
  check (cardinality(member_ids) <= 100)
);

-- 표에 직접 읽기·쓰기 없음 — 모두 아래 함수로(스위치·회사·권한 확인)
alter table public.calendar_events enable row level security;
alter table public.calendar_events force row level security;
alter table public.calendar_attendees enable row level security;
alter table public.calendar_attendees force row level security;
alter table public.calendar_view_prefs enable row level security;
alter table public.calendar_view_prefs force row level security;
revoke all on public.calendar_events, public.calendar_attendees, public.calendar_view_prefs from anon, authenticated;

-- ── 도우미 ──────────────────────────────────────────────────────────────────
create or replace function private.require_calendar()
returns public.members
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v public.members;
begin
  select * into v from public.members m where m.id = private.current_member_id();
  if v.id is null then raise exception 'NOT_MEMBER'; end if;
  if not private.feature_enabled(v.company_id, 'calendar') then raise exception 'FEATURE_DISABLED'; end if;
  return v;
end;
$$;

create or replace function private.calendar_event_json(e public.calendar_events, p_me uuid)
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', e.id, 'title', e.title, 'kind', e.kind, 'all_day', e.all_day,
    'starts_at', e.starts_at, 'ends_at', e.ends_at, 'start_date', e.start_date, 'end_date', e.end_date,
    'location', e.location, 'memo', e.memo,
    'created_by', e.created_by_member_id,
    'creator_name', (select m.name from public.members m where m.id = e.created_by_member_id),
    'mine', e.created_by_member_id = p_me,
    'attendees', (
      select coalesce(jsonb_agg(jsonb_build_object('member_id', a.member_id, 'name', m.name, 'status', m.status, 'response', a.response)
        order by (a.member_id = e.created_by_member_id) desc, m.name), '[]')
      from public.calendar_attendees a join public.members m on m.id = a.member_id
      where a.event_id = e.id
    )
  )
$$;

-- 한국 날짜 하루의 시작(timestamptz)
create or replace function private.kst_day_start(p date)
returns timestamptz
language sql immutable
set search_path = ''
as $$
  select (p::timestamp at time zone 'Asia/Seoul')
$$;

-- ── 읽기 ────────────────────────────────────────────────────────────────────
-- 기간(최대 62일) × 고른 사람(만든 사람 또는 참석자)의 일정
create or replace function public.calendar_events_range(p_from date, p_to date, p_members uuid[])
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_me public.members := private.require_calendar();
  v_ids uuid[];
begin
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 62 then raise exception 'INVALID_RANGE'; end if;
  select coalesce(array_agg(m.id), '{}') into v_ids from public.members m where m.company_id = v_me.company_id and m.id = any (coalesce(p_members, '{}'));
  return (
    select coalesce(jsonb_agg(private.calendar_event_json(e, v_me.id) order by coalesce(e.starts_at, private.kst_day_start(e.start_date)), e.created_at), '[]')
    from public.calendar_events e
    where e.company_id = v_me.company_id
      and (
        (e.all_day and e.start_date <= p_to and e.end_date >= p_from)
        or (not e.all_day and e.starts_at < private.kst_day_start(p_to + 1) and e.ends_at > private.kst_day_start(p_from))
      )
      and exists (select 1 from public.calendar_attendees a where a.event_id = e.id and a.member_id = any (v_ids))
  );
end;
$$;

-- 일정 하나(상세)
create or replace function public.calendar_event(p_id uuid)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_me public.members := private.require_calendar();
  v_e public.calendar_events;
begin
  select * into v_e from public.calendar_events where id = p_id and company_id = v_me.company_id;
  if v_e.id is null then raise exception 'NOT_FOUND'; end if;
  return private.calendar_event_json(v_e, v_me.id);
end;
$$;

-- 사람 고르기: 같은 회사 승인 멤버(부서별) + 내가 고른 사람 기억
create or replace function public.calendar_directory()
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_me public.members := private.require_calendar();
begin
  return jsonb_build_object(
    'me', v_me.id,
    'departments', (select coalesce(jsonb_agg(jsonb_build_object('id', d.id, 'name', d.name) order by d.sort_order, d.name), '[]')
                    from public.departments d where d.company_id = v_me.company_id),
    'members', (select coalesce(jsonb_agg(jsonb_build_object('member_id', m.id, 'name', m.name, 'position', m.position, 'department_id', m.department_id) order by m.name), '[]')
                from public.members m where m.company_id = v_me.company_id and m.status = 'approved'),
    'prefs', (select jsonb_build_object('member_ids', p.member_ids, 'show_deadlines', p.show_deadlines)
              from public.calendar_view_prefs p where p.member_id = v_me.id)
  );
end;
$$;

-- 고른 시간에 이미 일정이 있는 사람(불참 제외) — 참석자 고를 때 "일정 있음"
create or replace function public.calendar_busy(p_starts timestamptz, p_ends timestamptz, p_exclude uuid default null)
returns uuid[]
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_me public.members := private.require_calendar();
begin
  if p_starts is null or p_ends is null or p_ends <= p_starts or p_ends - p_starts > interval '31 days' then return '{}'; end if;
  return (
    select coalesce(array_agg(distinct a.member_id), '{}')
    from public.calendar_events e join public.calendar_attendees a on a.event_id = e.id
    where e.company_id = v_me.company_id and a.response <> 'declined' and e.id is distinct from p_exclude
      and (
        (not e.all_day and e.starts_at < p_ends and e.ends_at > p_starts)
        or (e.all_day and private.kst_day_start(e.start_date) < p_ends and private.kst_day_start(e.end_date + 1) > p_starts)
      )
  );
end;
$$;

-- ── 쓰기 ────────────────────────────────────────────────────────────────────
create or replace function public.calendar_save_prefs(p_member_ids uuid[], p_show_deadlines boolean)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_me public.members := private.require_calendar();
  v_ids uuid[];
begin
  select coalesce(array_agg(m.id), '{}') into v_ids from public.members m
    where m.company_id = v_me.company_id and m.status = 'approved' and m.id = any (coalesce(p_member_ids, '{}'));
  if cardinality(v_ids) > 100 then raise exception 'TOO_MANY'; end if;
  insert into public.calendar_view_prefs (member_id, company_id, member_ids, show_deadlines, updated_at)
  values (v_me.id, v_me.company_id, v_ids, coalesce(p_show_deadlines, true), now())
  on conflict (member_id) do update set member_ids = excluded.member_ids, show_deadlines = excluded.show_deadlines, updated_at = now();
end;
$$;

-- 만들기(p_id null)·고치기(만든 사람만). 시간을 바꾸면 참석자 응답은 다시 '대기', 10분 전 알림도 다시
create or replace function public.calendar_save_event(p_id uuid, p jsonb)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_me public.members := private.require_calendar();
  v_old public.calendar_events;
  v_id uuid;
  v_title text := btrim(coalesce(p ->> 'title', ''));
  v_kind text := p ->> 'kind';
  v_all_day boolean := coalesce((p ->> 'all_day')::boolean, false);
  v_starts timestamptz;
  v_ends timestamptz;
  v_sd date;
  v_ed date;
  v_loc text := nullif(btrim(coalesce(p ->> 'location', '')), '');
  v_memo text := nullif(btrim(coalesce(p ->> 'memo', '')), '');
  v_ids uuid[];
  v_time_changed boolean := false;
begin
  if char_length(v_title) < 1 then raise exception 'TITLE_REQUIRED'; end if;
  if char_length(v_title) > 100 then raise exception 'TITLE_TOO_LONG'; end if;
  if v_kind is null or v_kind not in ('meeting', 'outside', 'trip', 'other') then raise exception 'INVALID_KIND'; end if;
  if v_loc is not null and char_length(v_loc) > 200 then raise exception 'LOCATION_TOO_LONG'; end if;
  if v_memo is not null and char_length(v_memo) > 2000 then raise exception 'MEMO_TOO_LONG'; end if;
  if v_all_day then
    v_sd := (p ->> 'start_date')::date;
    v_ed := coalesce((p ->> 'end_date')::date, v_sd);
    if v_sd is null or v_ed < v_sd or v_ed - v_sd > 31 then raise exception 'INVALID_TIME'; end if;
  else
    v_starts := (p ->> 'starts_at')::timestamptz;
    v_ends := (p ->> 'ends_at')::timestamptz;
    if v_starts is null or v_ends is null or v_ends <= v_starts or v_ends - v_starts > interval '14 days' then raise exception 'INVALID_TIME'; end if;
    if extract(epoch from v_starts)::bigint % 600 <> 0 or extract(epoch from v_ends)::bigint % 600 <> 0 then raise exception 'TIME_UNIT_10MIN'; end if;
  end if;
  -- 참석자: 같은 회사 승인 멤버만, 나는 늘 포함
  select coalesce(array_agg(distinct m.id), '{}') into v_ids from public.members m
    where m.company_id = v_me.company_id and m.status = 'approved' and m.id = any (coalesce((select array_agg(x::uuid) from jsonb_array_elements_text(coalesce(p -> 'attendee_ids', '[]')) x), '{}'))
      and m.id <> v_me.id;
  if cardinality(v_ids) > 100 then raise exception 'TOO_MANY'; end if;

  if p_id is null then
    insert into public.calendar_events (company_id, created_by_member_id, title, kind, all_day, starts_at, ends_at, start_date, end_date, location, memo)
    values (v_me.company_id, v_me.id, v_title, v_kind, v_all_day, v_starts, v_ends, v_sd, v_ed, v_loc, v_memo)
    returning id into v_id;
    insert into public.calendar_attendees (event_id, company_id, member_id, response, responded_at) values (v_id, v_me.company_id, v_me.id, 'accepted', now());
    insert into public.calendar_attendees (event_id, company_id, member_id) select v_id, v_me.company_id, x from unnest(v_ids) x;
    return v_id;
  end if;

  select * into v_old from public.calendar_events where id = p_id and company_id = v_me.company_id for update;
  if v_old.id is null then raise exception 'NOT_FOUND'; end if;
  if v_old.created_by_member_id <> v_me.id then raise exception 'NOT_OWNER'; end if;
  v_time_changed := v_old.all_day is distinct from v_all_day or v_old.starts_at is distinct from v_starts or v_old.ends_at is distinct from v_ends
    or v_old.start_date is distinct from v_sd or v_old.end_date is distinct from v_ed;
  update public.calendar_events set title = v_title, kind = v_kind, all_day = v_all_day, starts_at = v_starts, ends_at = v_ends,
    start_date = v_sd, end_date = v_ed, location = v_loc, memo = v_memo, updated_at = now(),
    reminded_at = case when v_time_changed or v_kind <> v_old.kind then null else reminded_at end
  where id = p_id;
  delete from public.calendar_attendees where event_id = p_id and member_id <> v_me.id and member_id <> all (v_ids);
  insert into public.calendar_attendees (event_id, company_id, member_id) select p_id, v_me.company_id, x from unnest(v_ids) x
    on conflict (event_id, member_id) do nothing;
  if v_time_changed then
    update public.calendar_attendees set response = 'pending', responded_at = null where event_id = p_id and member_id <> v_me.id;
  end if;
  return p_id;
end;
$$;

create or replace function public.calendar_delete_event(p_id uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_me public.members := private.require_calendar();
  v_owner uuid;
begin
  select created_by_member_id into v_owner from public.calendar_events where id = p_id and company_id = v_me.company_id;
  if v_owner is null then raise exception 'NOT_FOUND'; end if;
  if v_owner <> v_me.id then raise exception 'NOT_OWNER'; end if;
  delete from public.calendar_events where id = p_id;
end;
$$;

-- 참석자 응답(만든 사람은 늘 참석)
create or replace function public.calendar_respond(p_id uuid, p_response text)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_me public.members := private.require_calendar();
  v_owner uuid;
begin
  if p_response not in ('accepted', 'declined') then raise exception 'INVALID_RESPONSE'; end if;
  select created_by_member_id into v_owner from public.calendar_events where id = p_id and company_id = v_me.company_id;
  if v_owner is null then raise exception 'NOT_FOUND'; end if;
  if v_owner = v_me.id then raise exception 'CREATOR'; end if;
  update public.calendar_attendees set response = p_response, responded_at = now() where event_id = p_id and member_id = v_me.id;
  if not found then raise exception 'NOT_ATTENDEE'; end if;
end;
$$;

revoke all on function public.calendar_events_range(date, date, uuid[]), public.calendar_event(uuid), public.calendar_directory(),
  public.calendar_busy(timestamptz, timestamptz, uuid), public.calendar_save_prefs(uuid[], boolean), public.calendar_save_event(uuid, jsonb),
  public.calendar_delete_event(uuid), public.calendar_respond(uuid, text) from public, anon;
grant execute on function public.calendar_events_range(date, date, uuid[]), public.calendar_event(uuid), public.calendar_directory(),
  public.calendar_busy(timestamptz, timestamptz, uuid), public.calendar_save_prefs(uuid[], boolean), public.calendar_save_event(uuid, jsonb),
  public.calendar_delete_event(uuid), public.calendar_respond(uuid, text) to authenticated;
revoke all on function private.require_calendar(), private.calendar_event_json(public.calendar_events, uuid), private.kst_day_start(date) from public, anon, authenticated;

-- ── 채팅 '알림'방 (사람마다 하나, 시스템만 글을 쓴다) ────────────────────────
alter table public.chat_rooms add column notice_member_id uuid;
alter table public.chat_rooms drop constraint chat_rooms_kind_check;
alter table public.chat_rooms add constraint chat_rooms_kind_check check (kind in ('direct', 'group', 'claim', 'notice'));
alter table public.chat_rooms add constraint chat_rooms_notice_check check ((kind = 'notice') = (notice_member_id is not null));
alter table public.chat_rooms add constraint chat_rooms_notice_unique unique (company_id, notice_member_id);
alter table public.chat_rooms add constraint chat_rooms_notice_member_fk foreign key (notice_member_id, company_id) references public.members (id, company_id) on delete cascade;

alter table public.chat_messages drop constraint chat_messages_kind_check;
alter table public.chat_messages add constraint chat_messages_kind_check check (kind in ('text', 'image', 'file', 'system', 'notice'));
alter table public.chat_messages add column link text check (link is null or char_length(link) <= 300);

-- 알림방: 알림(notice) 글만, 주인 한 사람만. 다른 방에는 알림 글이 들어가지 않는다
create or replace function private.chat_notice_guard_message()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_kind text;
begin
  select kind into v_kind from public.chat_rooms where id = new.room_id;
  if (v_kind = 'notice') <> (new.kind = 'notice') then raise exception 'NOTICE_ROOM'; end if;
  return new;
end;
$$;
create trigger chat_notice_guard_message before insert on public.chat_messages
  for each row execute function private.chat_notice_guard_message();

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
  return new;
end;
$$;
create trigger chat_notice_guard_member before insert or update on public.chat_members
  for each row execute function private.chat_notice_guard_member();

-- 메시지 모양에 link(알림 글의 [캘린더에서 보기]) 추가
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
    'expired', p.deleted_at is null and p.attachment_purged_at is not null
  )
$$;

-- 그 사람의 알림방(없으면 만든다)
create or replace function private.chat_notice_room(p_company uuid, p_member uuid)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_room uuid;
begin
  select id into v_room from public.chat_rooms where company_id = p_company and notice_member_id = p_member;
  if v_room is null then
    insert into public.chat_rooms (company_id, kind, title, notice_member_id) values (p_company, 'notice', '알림', p_member)
      on conflict (company_id, notice_member_id) do nothing returning id into v_room;
    if v_room is null then select id into v_room from public.chat_rooms where company_id = p_company and notice_member_id = p_member; end if;
    insert into public.chat_members (room_id, company_id, member_id) values (v_room, p_company, p_member) on conflict do nothing;
  end if;
  return v_room;
end;
$$;

-- ── 회의 10분 전 알림 (pg_cron 10분마다) ─────────────────────────────────────
-- 지금부터 15분 안에 시작하는(1분 넘게 남은) 회의 중 아직 안 보낸 것 → 참석자(불참·퇴사 제외)의 알림방에 한 줄
create or replace function private.calendar_reminder_tick()
returns integer
language plpgsql security definer
set search_path = ''
as $$
declare
  e public.calendar_events;
  a record;
  v_room uuid;
  v_n integer := 0;
  v_body text;
  v_url text;
  v_secret text;
begin
  for e in
    select * from public.calendar_events ev
    where ev.kind = 'meeting' and not ev.all_day and ev.reminded_at is null
      and ev.starts_at > now() + interval '1 minute' and ev.starts_at <= now() + interval '15 minutes'
    for update skip locked
  loop
    update public.calendar_events set reminded_at = now() where id = e.id;
    if not (private.feature_enabled(e.company_id, 'calendar') and private.feature_enabled(e.company_id, 'messenger')) then continue; end if;
    v_body := '회의 시작 10분 전입니다.' || chr(10)
      || to_char(e.starts_at at time zone 'Asia/Seoul', 'HH24:MI') || '~' || to_char(e.ends_at at time zone 'Asia/Seoul', 'HH24:MI') || ' ' || e.title
      || case when e.location is not null then chr(10) || '장소: ' || e.location else '' end;
    for a in
      select ca.member_id from public.calendar_attendees ca join public.members m on m.id = ca.member_id
      where ca.event_id = e.id and ca.response <> 'declined' and m.status = 'approved'
    loop
      v_room := private.chat_notice_room(e.company_id, a.member_id);
      insert into public.chat_messages (room_id, company_id, sender_member_id, kind, body, link)
      values (v_room, e.company_id, null, 'notice', v_body,
        '/workspace/' || e.company_id || '/calendar?date=' || to_char(e.starts_at at time zone 'Asia/Seoul', 'YYYY-MM-DD') || '&event=' || e.id);
      v_n := v_n + 1;
    end loop;
  end loop;
  -- 휴대폰 알림: 서비스 주소·비밀값이 Vault에 있을 때만(없으면 채팅 알림방에만 남는다)
  if v_n > 0 then
    select decrypted_secret into v_url from vault.decrypted_secrets where name = 'reminder_push_url';
    select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'reminder_push_secret';
    if v_url is not null and v_secret is not null then
      perform net.http_post(url := v_url, body := '{}'::jsonb,
        headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret, 'Content-Type', 'application/json'), timeout_milliseconds := 10000);
    end if;
  end if;
  return v_n;
end;
$$;

-- 서버(웹푸시 보내는 곳) 전용: 아직 푸시 안 한 알림 글(30분 안)을 가져가며 표시
create or replace function public.chat_notice_push_due()
returns jsonb
language sql security definer
set search_path = ''
as $$
  with due as (
    update public.chat_messages m set pushed_at = now()
    where m.kind = 'notice' and m.pushed_at is null and m.created_at > now() - interval '30 minutes'
    returning m.id, m.room_id, m.company_id, m.body, m.link
  )
  select coalesce(jsonb_agg(jsonb_build_object('id', d.id, 'room_id', d.room_id, 'company_id', d.company_id, 'member_id', r.notice_member_id, 'body', d.body, 'link', d.link)), '[]')
  from due d join public.chat_rooms r on r.id = d.room_id
$$;

revoke all on function private.chat_notice_room(uuid, uuid), private.calendar_reminder_tick(), private.chat_notice_guard_message(), private.chat_notice_guard_member() from public, anon, authenticated;
revoke all on function public.chat_notice_push_due() from public, anon, authenticated;
grant execute on function public.chat_notice_push_due() to service_role;

-- 예약 작업: 10분마다(00·10·20·…분)
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;
select cron.schedule('calendar-meeting-reminders', '*/10 * * * *', 'select private.calendar_reminder_tick()');

-- 약관·개인정보 처리방침 버전(메신저·캘린더 항목 추가)
update private.app_settings set value = '2026-11-04' where key in ('terms_version', 'privacy_version');
