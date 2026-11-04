-- D-207 회의실 설정·예약 (spec/features/calendar.md §9)
-- 회사마다 관리자가 회의실을 등록(0개면 선택칸 없음). 시간 일정에 회의실을 붙이면 같은 방·겹치는 시간은 DB가 막는다.

create extension if not exists btree_gist with schema extensions;

create table public.meeting_rooms (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 50),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (id, company_id),
  unique (company_id, name)
);
alter table public.meeting_rooms enable row level security;
alter table public.meeting_rooms force row level security;
revoke all on public.meeting_rooms from anon, authenticated;

alter table public.calendar_events add column room_id uuid;
alter table public.calendar_events add constraint calendar_events_room_fk foreign key (room_id, company_id) references public.meeting_rooms (id, company_id);
alter table public.calendar_events add constraint calendar_events_room_timed check (room_id is null or not all_day);
-- 같은 회의실·겹치는 시간 = 한 건만(동시에 눌러도 하나만 성공). 끝 시각 = 다음 시작 시각은 겹침 아님([) 구간)
alter table public.calendar_events add constraint calendar_events_room_no_overlap
  exclude using gist (room_id with =, tstzrange(starts_at, ends_at, '[)') with &&) where (room_id is not null);

-- 상세·목록 JSON에 회의실
create or replace function private.calendar_event_json(e public.calendar_events, p_me uuid)
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', e.id, 'title', e.title, 'kind', e.kind, 'all_day', e.all_day,
    'starts_at', e.starts_at, 'ends_at', e.ends_at, 'start_date', e.start_date, 'end_date', e.end_date,
    'location', e.location, 'memo', e.memo,
    'room_id', e.room_id,
    'room_name', (select r.name from public.meeting_rooms r where r.id = e.room_id),
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

-- ── 회의실 목록·예약 현황(캘린더를 쓰는 모든 멤버) ─────────────────────────
create or replace function public.calendar_rooms()
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_me public.members := private.require_calendar();
begin
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', r.id, 'name', r.name,
      'upcoming', (select count(*) from public.calendar_events e where e.room_id = r.id and e.ends_at > now())
    ) order by r.sort_order, r.name), '[]')
    from public.meeting_rooms r where r.company_id = v_me.company_id
  );
end;
$$;

-- 기간 안의 회의실 예약(사람 고르기와 상관없이 회사 전체) — 회의실 현황·예약 겹침 표시
create or replace function public.calendar_room_bookings(p_starts timestamptz, p_ends timestamptz)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_me public.members := private.require_calendar();
begin
  if p_starts is null or p_ends is null or p_ends <= p_starts or p_ends - p_starts > interval '31 days' then raise exception 'INVALID_RANGE'; end if;
  return (
    select coalesce(jsonb_agg(private.calendar_event_json(e, v_me.id) order by e.starts_at, e.created_at), '[]')
    from public.calendar_events e
    where e.company_id = v_me.company_id and e.room_id is not null and e.starts_at < p_ends and e.ends_at > p_starts
  );
end;
$$;

-- ── 회의실 설정(관리자) ─────────────────────────────────────────────────────
create or replace function private.require_calendar_admin()
returns public.members
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v public.members := private.require_calendar();
begin
  if v.role not in ('super_admin', 'admin') then raise exception 'NOT_ALLOWED' using errcode = '42501'; end if;
  return v;
end;
$$;

create or replace function public.calendar_room_save(p_id uuid, p_name text)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_me public.members := private.require_calendar_admin();
  v_name text := btrim(coalesce(p_name, ''));
  v_id uuid;
begin
  if char_length(v_name) < 1 then raise exception 'ROOM_NAME_REQUIRED'; end if;
  if char_length(v_name) > 50 then raise exception 'ROOM_NAME_TOO_LONG'; end if;
  if exists (select 1 from public.meeting_rooms r where r.company_id = v_me.company_id and r.name = v_name and r.id is distinct from p_id) then
    raise exception 'ROOM_NAME_TAKEN';
  end if;
  if p_id is null then
    if (select count(*) from public.meeting_rooms r where r.company_id = v_me.company_id) >= 30 then raise exception 'TOO_MANY_ROOMS'; end if;
    insert into public.meeting_rooms (company_id, name, sort_order)
    values (v_me.company_id, v_name, coalesce((select max(sort_order) from public.meeting_rooms r where r.company_id = v_me.company_id), 0) + 1)
    returning id into v_id;
    return v_id;
  end if;
  update public.meeting_rooms set name = v_name where id = p_id and company_id = v_me.company_id returning id into v_id;
  if v_id is null then raise exception 'NOT_FOUND'; end if;
  return v_id;
end;
$$;

create or replace function public.calendar_room_reorder(p_ids uuid[])
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_me public.members := private.require_calendar_admin();
begin
  update public.meeting_rooms r set sort_order = x.ord
  from unnest(coalesce(p_ids, '{}')) with ordinality as x(id, ord)
  where r.id = x.id and r.company_id = v_me.company_id;
end;
$$;

-- 삭제: 그 방에 잡힌 일정은 지우지 않고 장소 글자로 옮긴다(지난 기록·앞으로 회의 그대로)
create or replace function public.calendar_room_delete(p_id uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_me public.members := private.require_calendar_admin();
  v_room public.meeting_rooms;
begin
  select * into v_room from public.meeting_rooms where id = p_id and company_id = v_me.company_id for update;
  if v_room.id is null then raise exception 'NOT_FOUND'; end if;
  update public.calendar_events
    set location = left(case when location is null or btrim(location) = '' then v_room.name else v_room.name || ' · ' || location end, 200),
        room_id = null, updated_at = now()
  where room_id = v_room.id;
  delete from public.meeting_rooms where id = v_room.id;
end;
$$;

-- ── 일정 저장: 회의실(시간 일정만, 같은 회사 방, 겹치면 ROOM_TAKEN) ─────────
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
  v_room uuid := nullif(p ->> 'room_id', '')::uuid;
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
  if v_room is not null then
    if v_all_day then raise exception 'ROOM_ALL_DAY'; end if;
    if not exists (select 1 from public.meeting_rooms r where r.id = v_room and r.company_id = v_me.company_id) then raise exception 'ROOM_NOT_FOUND'; end if;
  end if;
  -- 참석자: 같은 회사 승인 멤버만, 나는 늘 포함
  select coalesce(array_agg(distinct m.id), '{}') into v_ids from public.members m
    where m.company_id = v_me.company_id and m.status = 'approved' and m.id = any (coalesce((select array_agg(x::uuid) from jsonb_array_elements_text(coalesce(p -> 'attendee_ids', '[]')) x), '{}'))
      and m.id <> v_me.id;
  if cardinality(v_ids) > 100 then raise exception 'TOO_MANY'; end if;

  if p_id is null then
    begin
      insert into public.calendar_events (company_id, created_by_member_id, title, kind, all_day, starts_at, ends_at, start_date, end_date, location, memo, room_id)
      values (v_me.company_id, v_me.id, v_title, v_kind, v_all_day, v_starts, v_ends, v_sd, v_ed, v_loc, v_memo, v_room)
      returning id into v_id;
    exception when exclusion_violation then
      raise exception 'ROOM_TAKEN';
    end;
    insert into public.calendar_attendees (event_id, company_id, member_id, response, responded_at) values (v_id, v_me.company_id, v_me.id, 'accepted', now());
    insert into public.calendar_attendees (event_id, company_id, member_id) select v_id, v_me.company_id, x from unnest(v_ids) x;
    return v_id;
  end if;

  select * into v_old from public.calendar_events where id = p_id and company_id = v_me.company_id for update;
  if v_old.id is null then raise exception 'NOT_FOUND'; end if;
  if v_old.created_by_member_id <> v_me.id then raise exception 'NOT_OWNER'; end if;
  v_time_changed := v_old.all_day is distinct from v_all_day or v_old.starts_at is distinct from v_starts or v_old.ends_at is distinct from v_ends
    or v_old.start_date is distinct from v_sd or v_old.end_date is distinct from v_ed;
  begin
    update public.calendar_events set title = v_title, kind = v_kind, all_day = v_all_day, starts_at = v_starts, ends_at = v_ends,
      start_date = v_sd, end_date = v_ed, location = v_loc, memo = v_memo, room_id = v_room, updated_at = now(),
      reminded_at = case when v_time_changed or v_kind <> v_old.kind then null else reminded_at end
    where id = p_id;
  exception when exclusion_violation then
    raise exception 'ROOM_TAKEN';
  end;
  delete from public.calendar_attendees where event_id = p_id and member_id <> v_me.id and member_id <> all (v_ids);
  insert into public.calendar_attendees (event_id, company_id, member_id) select p_id, v_me.company_id, x from unnest(v_ids) x
    on conflict (event_id, member_id) do nothing;
  if v_time_changed then
    update public.calendar_attendees set response = 'pending', responded_at = null where event_id = p_id and member_id <> v_me.id;
  end if;
  return p_id;
end;
$$;

-- ── 회의 10분 전 안내: 장소 = 회의실 이름(+ 적은 장소) ─────────────────────
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
  v_place text;
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
    v_place := nullif(concat_ws(' · ', (select r.name from public.meeting_rooms r where r.id = e.room_id), e.location), '');
    v_body := '회의 시작 10분 전입니다.' || chr(10)
      || to_char(e.starts_at at time zone 'Asia/Seoul', 'HH24:MI') || '~' || to_char(e.ends_at at time zone 'Asia/Seoul', 'HH24:MI') || ' ' || e.title
      || case when v_place is not null then chr(10) || '장소: ' || v_place else '' end;
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

revoke all on function private.require_calendar_admin(), private.calendar_reminder_tick(), private.calendar_event_json(public.calendar_events, uuid) from public, anon, authenticated;
revoke all on function public.calendar_rooms(), public.calendar_room_bookings(timestamptz, timestamptz), public.calendar_room_save(uuid, text),
  public.calendar_room_reorder(uuid[]), public.calendar_room_delete(uuid), public.calendar_save_event(uuid, jsonb) from public, anon;
grant execute on function public.calendar_rooms(), public.calendar_room_bookings(timestamptz, timestamptz), public.calendar_room_save(uuid, text),
  public.calendar_room_reorder(uuid[]), public.calendar_room_delete(uuid), public.calendar_save_event(uuid, jsonb) to authenticated;
