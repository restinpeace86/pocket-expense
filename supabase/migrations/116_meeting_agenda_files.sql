-- =============================================================================
-- 116_meeting_agenda_files.sql — 회의 안건·자료 사전 등록 + 10분 전 알림 카드 (D-217, todo_improvement 개선사항 4)
-- - calendar_events.agenda: 회의 안건(2,000자). 회의 종류이거나 회의실을 잡은 일정에서 쓴다(화면).
-- - calendar_event_files: 회의 자료(일정마다 10개, 파일마다 20MB, PDF·문서·표·발표·한글·이미지·글·압축만)
--   비공개 버킷 meeting-files/{company}/{event}/{uuid}.{ext}. 올리기·지우기 = 일정 만든 사람만, 보기 = 같은 회사(캘린더는 회사 안 모두 공개, D-206)
-- - 저장 한도: 회사 첨부 저장 공간(요금제 1/3/10GB, D-204)에 회의 자료도 함께 센다(chat_storage_used에 더함)
-- - 회의를 지우면(취소) 자료 줄은 함께 지워지고(연쇄), 파일은 화면이 바로 지운다 + 새벽 정리가 남은 파일을 지운다
-- - 10분 전 알림방 글에 안건 첫 줄·자료 수를 더해 화면이 카드로 보여 준다
-- =============================================================================

alter table public.calendar_events add column if not exists agenda text check (agenda is null or char_length(agenda) <= 2000);

create table if not exists public.calendar_event_files (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  event_id uuid not null,
  uploaded_by_member_id uuid not null,
  path text not null unique check (char_length(path) <= 300),
  name text not null check (char_length(name) between 1 and 200),
  size bigint not null check (size between 0 and 20971520),
  mime text check (mime is null or char_length(mime) <= 100),
  created_at timestamptz not null default now(),
  foreign key (event_id, company_id) references public.calendar_events (id, company_id) on delete cascade,
  foreign key (uploaded_by_member_id, company_id) references public.members (id, company_id) on delete cascade
);
create index if not exists calendar_event_files_event_idx on public.calendar_event_files (event_id);
create index if not exists calendar_event_files_company_idx on public.calendar_event_files (company_id);
alter table public.calendar_event_files enable row level security;
alter table public.calendar_event_files force row level security;
revoke all on public.calendar_event_files from anon, authenticated;

-- ── 보관함 ──────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit)
values ('meeting-files', 'meeting-files', false, 20971520)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

-- 그 일정을 만든 사람인가(같은 회사·캘린더 켜짐)
create or replace function private.is_event_owner(p_event uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.calendar_events e
    where e.id = p_event and e.company_id = private.current_company_id() and e.created_by_member_id = private.current_member_id()
  ) and private.feature_enabled(private.current_company_id(), 'calendar')
$$;
revoke all on function private.is_event_owner(uuid) from public, anon;
grant execute on function private.is_event_owner(uuid) to authenticated;

-- 같은 회사의 등록된 회의 자료인가(표 권한 없이 정책에서 쓰려고 definer)
create or replace function private.meeting_file_visible(p_path text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.calendar_event_files f where f.path = p_path and f.company_id = private.current_company_id())
    and private.feature_enabled(private.current_company_id(), 'calendar')
$$;
revoke all on function private.meeting_file_visible(text) from public, anon;
grant execute on function private.meeting_file_visible(text) to authenticated;

drop policy if exists meeting_files_select on storage.objects;
create policy meeting_files_select on storage.objects for select to authenticated
using (
  bucket_id = 'meeting-files'
  and (storage.foldername(name))[1] = (select private.current_company_id())::text
  and private.meeting_file_visible(name)
);
drop policy if exists meeting_files_insert on storage.objects;
create policy meeting_files_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'meeting-files'
  and (storage.foldername(name))[1] = (select private.current_company_id())::text
  and private.is_event_owner(((storage.foldername(name))[2])::uuid)
);
drop policy if exists meeting_files_delete on storage.objects;
create policy meeting_files_delete on storage.objects for delete to authenticated
using (
  bucket_id = 'meeting-files'
  and owner_id = (select auth.uid())::text
  and (storage.foldername(name))[1] = (select private.current_company_id())::text
);

-- ── 저장 한도: 채팅 첨부 + 회의 자료 ─────────────────────────────────────────
create or replace function private.chat_storage_used(p_company uuid)
returns bigint
language sql stable security definer
set search_path = ''
as $$
  select
    coalesce((select sum(coalesce(attachment_size, 0)::bigint + coalesce(attachment_thumb_size, 0))
              from public.chat_messages
              where company_id = p_company and attachment_path is not null and attachment_purged_at is null and deleted_at is null), 0)::bigint
    + coalesce((select sum(size) from public.calendar_event_files where company_id = p_company), 0)::bigint
$$;
revoke all on function private.chat_storage_used(uuid) from public, anon, authenticated;

-- ── 자료 올리기·지우기 ───────────────────────────────────────────────────────
create or replace function public.calendar_event_file_add(p_event uuid, p_path text, p_name text, p_mime text)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_me public.members := private.require_calendar();
  e public.calendar_events;
  v_size bigint;
  v_ext text := lower(substring(coalesce(p_name, '') from '\.([A-Za-z0-9]{1,8})$'));
  f public.calendar_event_files;
begin
  select * into e from public.calendar_events where id = p_event and company_id = v_me.company_id;
  if e.id is null then raise exception 'NOT_FOUND'; end if;
  if e.created_by_member_id <> v_me.id then raise exception 'NOT_OWNER'; end if;
  if p_path is null or p_path not like v_me.company_id::text || '/' || e.id::text || '/%' or p_path like '%..%' then raise exception 'INVALID_ATTACHMENT'; end if;
  if v_ext is null or v_ext not in ('pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'ppt', 'pptx', 'hwp', 'hwpx', 'txt', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'heic', 'zip') then
    raise exception 'FILE_TYPE';
  end if;
  if (select count(*) from public.calendar_event_files x where x.event_id = e.id) >= 10 then raise exception 'TOO_MANY_FILES'; end if;
  v_size := (select (o.metadata ->> 'size')::bigint from storage.objects o where o.bucket_id = 'meeting-files' and o.name = p_path);
  if v_size is null then raise exception 'INVALID_ATTACHMENT'; end if;
  if v_size > 20971520 then raise exception 'FILE_TOO_LARGE'; end if;
  if private.chat_storage_used(v_me.company_id) + v_size > private.chat_storage_limit(v_me.company_id) then raise exception 'STORAGE_FULL'; end if;
  insert into public.calendar_event_files (company_id, event_id, uploaded_by_member_id, path, name, size, mime)
  values (v_me.company_id, e.id, v_me.id, p_path, left(btrim(p_name), 200), v_size, left(p_mime, 100))
  returning * into f;
  return jsonb_build_object('id', f.id, 'name', f.name, 'size', f.size, 'mime', f.mime, 'path', f.path);
end;
$$;

-- 지우기: 만든 사람만. 줄을 지우고 경로를 돌려준다(파일은 화면이 바로 지움, 못 지우면 새벽 정리)
create or replace function public.calendar_event_file_delete(p_id uuid)
returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  v_me public.members := private.require_calendar();
  v_path text;
begin
  delete from public.calendar_event_files f
  using public.calendar_events e
  where f.id = p_id and f.company_id = v_me.company_id and e.id = f.event_id and e.created_by_member_id = v_me.id
  returning f.path into v_path;
  if v_path is null then raise exception 'NOT_FOUND'; end if;
  return v_path;
end;
$$;

-- 새벽 정리(서버 전용): 줄이 없는 회의 자료 파일(취소한 회의·지운 자료·올리다 만 것, 하루 지난 것)
create or replace function public.meeting_files_orphans(p_limit integer default 200)
returns setof text
language sql stable security definer
set search_path = ''
as $$
  select o.name from storage.objects o
  where o.bucket_id = 'meeting-files' and o.created_at < now() - interval '1 day'
    and not exists (select 1 from public.calendar_event_files f where f.path = o.name)
  order by o.created_at
  limit greatest(1, least(p_limit, 1000))
$$;

revoke all on function public.calendar_event_file_add(uuid, text, text, text), public.calendar_event_file_delete(uuid) from public, anon;
grant execute on function public.calendar_event_file_add(uuid, text, text, text), public.calendar_event_file_delete(uuid) to authenticated;
revoke all on function public.meeting_files_orphans(integer) from public, anon, authenticated;
grant execute on function public.meeting_files_orphans(integer) to service_role;

-- ── 일정 JSON: 안건·자료 ─────────────────────────────────────────────────────
create or replace function private.calendar_event_json(e public.calendar_events, p_me uuid)
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', e.id, 'title', e.title, 'kind', e.kind, 'all_day', e.all_day,
    'starts_at', e.starts_at, 'ends_at', e.ends_at, 'start_date', e.start_date, 'end_date', e.end_date,
    'location', e.location, 'memo', e.memo, 'agenda', e.agenda,
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
    ),
    'files', (
      select coalesce(jsonb_agg(jsonb_build_object('id', f.id, 'name', f.name, 'size', f.size, 'mime', f.mime, 'path', f.path) order by f.created_at), '[]')
      from public.calendar_event_files f where f.event_id = e.id
    )
  )
$$;
revoke all on function private.calendar_event_json(public.calendar_events, uuid) from public, anon, authenticated;

-- ── 저장: 안건 ───────────────────────────────────────────────────────────────
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
  v_agenda text := nullif(btrim(coalesce(p ->> 'agenda', '')), '');
  v_room uuid := nullif(p ->> 'room_id', '')::uuid;
  v_ids uuid[];
  v_time_changed boolean := false;
begin
  if char_length(v_title) < 1 then raise exception 'TITLE_REQUIRED'; end if;
  if char_length(v_title) > 100 then raise exception 'TITLE_TOO_LONG'; end if;
  if v_kind is null or v_kind not in ('meeting', 'outside', 'trip', 'other') then raise exception 'INVALID_KIND'; end if;
  if v_loc is not null and char_length(v_loc) > 200 then raise exception 'LOCATION_TOO_LONG'; end if;
  if v_memo is not null and char_length(v_memo) > 2000 then raise exception 'MEMO_TOO_LONG'; end if;
  if v_agenda is not null and char_length(v_agenda) > 2000 then raise exception 'AGENDA_TOO_LONG'; end if;
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
      insert into public.calendar_events (company_id, created_by_member_id, title, kind, all_day, starts_at, ends_at, start_date, end_date, location, memo, agenda, room_id)
      values (v_me.company_id, v_me.id, v_title, v_kind, v_all_day, v_starts, v_ends, v_sd, v_ed, v_loc, v_memo, v_agenda, v_room)
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
      start_date = v_sd, end_date = v_ed, location = v_loc, memo = v_memo, agenda = v_agenda, room_id = v_room, updated_at = now(),
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

-- ── 10분 전 알림: 안건 첫 줄·자료 수(화면이 카드로) ─────────────────────────────
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
  v_agenda text;
  v_files integer;
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
    v_agenda := nullif(btrim(split_part(coalesce(e.agenda, ''), chr(10), 1)), '');
    v_files := (select count(*) from public.calendar_event_files f where f.event_id = e.id);
    v_body := '회의 시작 10분 전입니다.' || chr(10)
      || to_char(e.starts_at at time zone 'Asia/Seoul', 'HH24:MI') || '~' || to_char(e.ends_at at time zone 'Asia/Seoul', 'HH24:MI') || ' ' || e.title
      || case when v_place is not null then chr(10) || '장소: ' || v_place else '' end
      || case when v_agenda is not null then chr(10) || '안건: ' || left(v_agenda, 100) else '' end
      || case when v_files > 0 then chr(10) || '자료: ' || v_files || '개' else '' end;
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
revoke all on function private.calendar_reminder_tick() from public, anon, authenticated;
