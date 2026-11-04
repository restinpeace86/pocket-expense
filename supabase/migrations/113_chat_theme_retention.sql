-- D-211 채팅 색감(계정별) + D-212 채팅 사진·파일 보관 기간(회사별 30·60·90일) (사용자 결정 2026-11-05)
-- ① members.chat_theme: 채팅 화면 색(기본 = 지금 색, line = 업무형 테두리, cool = 업무형 쿨톤). 화면 색상(ui_theme)처럼 본인만 바꾼다.
-- ② company_chat_settings.attachment_days: 회사 관리자가 30·60·90일 중 고른다(없으면 앱 기본 90일).
--    저장 한도(요금제)는 그대로 — 보관 기간을 짧게 하면 지난 파일이 먼저 지워져 같은 한도로 더 많이 보낼 수 있다.

alter table public.members add column chat_theme text check (chat_theme in ('basic', 'line', 'cool'));
grant update (chat_theme) on public.members to authenticated;

create or replace function public.my_membership()
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'member_id', m.id, 'company_id', m.company_id, 'company_name', c.name,
    'name', m.name, 'role', m.role, 'status', m.status, 'ui_theme', m.ui_theme, 'chat_theme', m.chat_theme
  )
  from public.members m join public.companies c on c.id = m.company_id
  where m.auth_user_id = (select auth.uid())
$$;

create table public.company_chat_settings (
  company_id uuid primary key references public.companies (id) on delete cascade,
  attachment_days integer not null check (attachment_days in (30, 60, 90)),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.members (id) on delete set null
);
alter table public.company_chat_settings enable row level security;
alter table public.company_chat_settings force row level security;
revoke all on public.company_chat_settings from public, anon, authenticated;

-- 회사 보관 기간(일): 회사 설정 → 앱 기본(app_settings) → 90
create or replace function private.chat_attachment_days(p_company uuid)
returns integer
language sql stable security definer
set search_path = ''
as $$
  select coalesce(
    (select s.attachment_days from public.company_chat_settings s where s.company_id = p_company),
    (select value from private.app_settings where key = 'chat_attachment_days')::integer,
    90
  )
$$;
revoke all on function private.chat_attachment_days(uuid) from public, anon, authenticated;

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
    'days', private.chat_attachment_days(v_me.company_id)
  );
end;
$$;

-- 관리자 설정 화면용: 지금 사용량 + 보관 기간을 줄이면 비워지는 양(30·60일보다 오래된 파일)
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
  if not coalesce((select f.enabled from public.company_features f where f.company_id = v_me.company_id and f.feature = 'messenger'), false) then
    raise exception 'FEATURE_DISABLED';
  end if;
  select
    coalesce(sum(coalesce(attachment_size, 0)::bigint + coalesce(attachment_thumb_size, 0)) filter (where created_at < now() - interval '30 days'), 0),
    coalesce(sum(coalesce(attachment_size, 0)::bigint + coalesce(attachment_thumb_size, 0)) filter (where created_at < now() - interval '60 days'), 0)
  into v_old30, v_old60
  from public.chat_messages
  where company_id = v_me.company_id and attachment_path is not null and attachment_purged_at is null and deleted_at is null;
  return jsonb_build_object(
    'used', private.chat_storage_used(v_me.company_id),
    'limit', private.chat_storage_limit(v_me.company_id),
    'days', private.chat_attachment_days(v_me.company_id),
    'older_than_30', v_old30,
    'older_than_60', v_old60
  );
end;
$$;

-- 보관 기간 바꾸기: 관리자만, 자기 회사만, 메신저가 켜진 회사만
create or replace function public.chat_set_attachment_days(p_days integer)
returns integer
language plpgsql security definer
set search_path = ''
as $$
declare
  v_me public.members := private.require_admin();
begin
  if p_days is null or p_days not in (30, 60, 90) then raise exception 'INVALID_DAYS'; end if;
  if not coalesce((select f.enabled from public.company_features f where f.company_id = v_me.company_id and f.feature = 'messenger'), false) then
    raise exception 'FEATURE_DISABLED';
  end if;
  insert into public.company_chat_settings (company_id, attachment_days, updated_at, updated_by)
  values (v_me.company_id, p_days, now(), v_me.id)
  on conflict (company_id) do update set attachment_days = excluded.attachment_days, updated_at = now(), updated_by = excluded.updated_by;
  return p_days;
end;
$$;

-- 새벽 정리: 회사마다 그 회사 보관 기간으로
create or replace function public.chat_files_due(p_limit integer default 200)
returns table (message_id uuid, paths text[])
language sql stable security definer
set search_path = ''
as $$
  (
    select m.id, array_remove(array[m.attachment_path, m.attachment_thumb_path], null)
    from public.chat_messages m
    left join public.company_chat_settings s on s.company_id = m.company_id
    where m.attachment_path is not null and m.attachment_purged_at is null
      and (m.deleted_at is not null
           or m.created_at < now() - make_interval(days => coalesce(s.attachment_days, (select value from private.app_settings where key = 'chat_attachment_days')::integer, 90)))
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

revoke all on function public.chat_retention_status(), public.chat_set_attachment_days(integer) from public, anon;
grant execute on function public.chat_retention_status(), public.chat_set_attachment_days(integer) to authenticated;
revoke all on function public.chat_files_due(integer) from public, anon, authenticated;
grant execute on function public.chat_files_due(integer) to service_role;
