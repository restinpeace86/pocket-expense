-- =============================================================================
-- 118_file_retention_all.sql — 사진·파일 보관 기간(30·60·90일)을 회사가 올린 파일 전체에 (D-218, 사용자 결정 2026-11-05)
-- - 대상: 채팅 사진·파일(D-212) + 회의 자료(D-217). 영수증·증빙(결의서 첨부)은 세무 보관 대상이라 넣지 않는다.
-- - 회의 자료 기준일 = 올린 날과 회의 끝난 날 중 늦은 날(미리 올린 자료가 회의 전에 지워지지 않게) + 회사 보관 기간.
--   지나면 새벽 작업이 파일을 지우고 purged_at 표시 — 줄(이름)은 남아 "보관 기간이 지나 지워졌어요"로 보인다. 저장 공간·10개 한도에서 빠진다.
-- - 설정은 메신저 스위치와 관계없이 관리자가 바꿀 수 있다(회의 자료만 쓰는 회사도 있으므로).
-- =============================================================================

alter table public.calendar_event_files add column if not exists purged_at timestamptz;
create index if not exists calendar_event_files_live_idx on public.calendar_event_files (company_id, created_at) where purged_at is null;

-- 회의 자료 기준일(이 날 + 보관 기간이 지나면 지움)
create or replace function private.meeting_file_base(f public.calendar_event_files)
returns timestamptz
language sql stable security definer
set search_path = ''
as $$
  select greatest(f.created_at, coalesce((select coalesce(e.ends_at, private.kst_day_start(e.end_date + 1)) from public.calendar_events e where e.id = f.event_id), f.created_at))
$$;
revoke all on function private.meeting_file_base(public.calendar_event_files) from public, anon, authenticated;

create or replace function private.chat_storage_used(p_company uuid)
returns bigint
language sql stable security definer
set search_path = ''
as $$
  select
    coalesce((select sum(coalesce(attachment_size, 0)::bigint + coalesce(attachment_thumb_size, 0))
              from public.chat_messages
              where company_id = p_company and attachment_path is not null and attachment_purged_at is null and deleted_at is null), 0)::bigint
    + coalesce((select sum(size) from public.calendar_event_files where company_id = p_company and purged_at is null), 0)::bigint
$$;
revoke all on function private.chat_storage_used(uuid) from public, anon, authenticated;

create or replace function public.chat_retention_status()
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_me public.members := private.require_admin();
  v_old30 bigint;
  v_old60 bigint;
begin
  select
    coalesce(sum(coalesce(attachment_size, 0)::bigint + coalesce(attachment_thumb_size, 0)) filter (where created_at < now() - interval '30 days'), 0),
    coalesce(sum(coalesce(attachment_size, 0)::bigint + coalesce(attachment_thumb_size, 0)) filter (where created_at < now() - interval '60 days'), 0)
  into v_old30, v_old60
  from public.chat_messages
  where company_id = v_me.company_id and attachment_path is not null and attachment_purged_at is null and deleted_at is null;
  select v_old30 + coalesce(sum(f.size) filter (where private.meeting_file_base(f) < now() - interval '30 days'), 0),
         v_old60 + coalesce(sum(f.size) filter (where private.meeting_file_base(f) < now() - interval '60 days'), 0)
  into v_old30, v_old60
  from public.calendar_event_files f
  where f.company_id = v_me.company_id and f.purged_at is null;
  return jsonb_build_object(
    'used', private.chat_storage_used(v_me.company_id),
    'limit', private.chat_storage_limit(v_me.company_id),
    'days', private.chat_attachment_days(v_me.company_id),
    'older_than_30', v_old30,
    'older_than_60', v_old60
  );
end;
$$;

create or replace function public.chat_set_attachment_days(p_days integer)
returns integer
language plpgsql security definer
set search_path = ''
as $$
declare
  v_me public.members := private.require_admin();
begin
  if p_days is null or p_days not in (30, 60, 90) then raise exception 'INVALID_DAYS'; end if;
  insert into public.company_chat_settings (company_id, attachment_days, updated_at, updated_by)
  values (v_me.company_id, p_days, now(), v_me.id)
  on conflict (company_id) do update set attachment_days = excluded.attachment_days, updated_at = now(), updated_by = excluded.updated_by;
  return p_days;
end;
$$;
revoke all on function public.chat_retention_status(), public.chat_set_attachment_days(integer) from public, anon;
grant execute on function public.chat_retention_status(), public.chat_set_attachment_days(integer) to authenticated;

-- 새벽 정리(서버 전용): 보관 기간이 지난 회의 자료
create or replace function public.meeting_files_due(p_limit integer default 200)
returns table (id uuid, path text)
language sql stable security definer
set search_path = ''
as $$
  select f.id, f.path
  from public.calendar_event_files f
  where f.purged_at is null
    and private.meeting_file_base(f) < now() - make_interval(days => private.chat_attachment_days(f.company_id))
  order by f.created_at
  limit greatest(1, least(p_limit, 1000))
$$;
create or replace function public.meeting_files_mark_purged(p_ids uuid[])
returns integer
language sql security definer
set search_path = ''
as $$
  with u as (update public.calendar_event_files set purged_at = now() where id = any (p_ids) and purged_at is null returning 1)
  select count(*)::integer from u
$$;
revoke all on function public.meeting_files_due(integer), public.meeting_files_mark_purged(uuid[]) from public, anon, authenticated;
grant execute on function public.meeting_files_due(integer), public.meeting_files_mark_purged(uuid[]) to service_role;

-- 10개 한도·보기: 지워진 자료는 한도에서 빠지고, 보관함 보기 대상도 아님
create or replace function private.meeting_file_visible(p_path text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.calendar_event_files f where f.path = p_path and f.company_id = private.current_company_id() and f.purged_at is null)
    and private.feature_enabled(private.current_company_id(), 'calendar')
$$;

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
  if (select count(*) from public.calendar_event_files x where x.event_id = e.id and x.purged_at is null) >= 10 then raise exception 'TOO_MANY_FILES'; end if;
  v_size := (select (o.metadata ->> 'size')::bigint from storage.objects o where o.bucket_id = 'meeting-files' and o.name = p_path);
  if v_size is null then raise exception 'INVALID_ATTACHMENT'; end if;
  if v_size > 20971520 then raise exception 'FILE_TOO_LARGE'; end if;
  if private.chat_storage_used(v_me.company_id) + v_size > private.chat_storage_limit(v_me.company_id) then raise exception 'STORAGE_FULL'; end if;
  insert into public.calendar_event_files (company_id, event_id, uploaded_by_member_id, path, name, size, mime)
  values (v_me.company_id, e.id, v_me.id, p_path, left(btrim(p_name), 200), v_size, left(p_mime, 100))
  returning * into f;
  return jsonb_build_object('id', f.id, 'name', f.name, 'size', f.size, 'mime', f.mime, 'path', f.path, 'purged', false);
end;
$$;

-- 일정 JSON: 자료에 purged(보관 기간이 지나 지워짐)
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
      select coalesce(jsonb_agg(jsonb_build_object('id', f.id, 'name', f.name, 'size', f.size, 'mime', f.mime, 'path', f.path, 'purged', f.purged_at is not null) order by f.created_at), '[]')
      from public.calendar_event_files f where f.event_id = e.id
    )
  )
$$;
revoke all on function private.calendar_event_json(public.calendar_events, uuid) from public, anon, authenticated;
