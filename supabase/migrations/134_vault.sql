-- 채팅 파일 영구 보관 · 파일 보관함 (8-96, D-245, spec/features/file-vault.md)
-- - 채팅 첨부는 회사 보관 기간 뒤 그대로 지워지고, [영구 보관]한 파일만 비공개 버킷 vault-files로 복사해 지울 때까지 둔다.
-- - 공개 범위: private(보관한 사람만) / company(같은 회사 멤버). 지우기 = 보관한 사람, 회사 공유는 관리자도.
-- - 한도는 채팅과 따로: billing_plans.vault_storage_mb(스타터 1GB·프로 3GB·비즈니스 10GB). 다 차면 새 보관만 막음, 70%·90% 넘을 때 관리자 안내.
-- - 관리자는 나만 보기 파일의 이름·내용은 못 보고 직원별 개수·용량만.
-- - 퇴사(비활성) 멤버의 나만 보기 파일은 퇴사 30일 뒤 삭제(퇴사 때·삭제 7일 전 관리자 안내).
-- - 복사·파일 삭제는 서버(service role)가 한다: 사용자는 vault_keep_check로 확인만, 서버가 복사 뒤 vault_add로 기록.

alter table public.billing_plans add column vault_storage_mb integer check (vault_storage_mb is null or vault_storage_mb > 0);
update public.billing_plans set vault_storage_mb = case code when 'starter' then 1024 when 'standard' then 3072 when 'pro' then 10240 end;

create table public.vault_files (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  owner_member_id uuid not null,
  scope text not null default 'private' check (scope in ('private', 'company')),
  name text not null check (char_length(name) between 1 and 255),
  kind text not null check (kind in ('image', 'file')),
  mime text check (mime is null or char_length(mime) <= 100),
  size integer not null check (size between 0 and 20971520),
  thumb_size integer not null default 0 check (thumb_size between 0 and 2097152),
  path text not null unique,
  thumb_path text unique,
  source_room_id uuid,
  source_message_id uuid,
  created_at timestamptz not null default now(),
  scope_changed_at timestamptz,
  unique (id, company_id),
  unique (owner_member_id, source_message_id),
  foreign key (owner_member_id, company_id) references public.members (id, company_id) on delete cascade
);
create index vault_files_company_idx on public.vault_files (company_id, scope, created_at desc);
create index vault_files_owner_idx on public.vault_files (owner_member_id);
create index vault_files_source_idx on public.vault_files (source_room_id) where source_room_id is not null;

alter table public.vault_files enable row level security;
alter table public.vault_files force row level security;
-- 읽기: 같은 회사 승인 멤버 — 회사 공유는 모두, 나만 보기는 보관한 사람만. 쓰기는 함수로만
create policy vault_files_select on public.vault_files for select to authenticated
using (
  company_id = (select private.current_company_id())
  and (scope = 'company' or owner_member_id = (select private.current_member_id()))
);
revoke all on public.vault_files from anon;
revoke insert, update, delete on public.vault_files from authenticated;
grant select on public.vault_files to authenticated;

-- 퇴사 멤버(나만 보기 파일 정리용): 비활성이 된 때와 안내 기록
create table private.vault_leavers (
  member_id uuid primary key references public.members (id) on delete cascade,
  company_id uuid not null,
  since timestamptz not null default now(),
  notified7 boolean not null default false
);

-- ── 비공개 버킷 ────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit)
values ('vault-files', 'vault-files', false, 20971520)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

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
      and (v.scope = 'company' or v.owner_member_id = m.id)
  )
$$;
-- 읽기만 사용자에게(서명 주소). 올리기·지우기는 service role
create policy vault_files_obj_select on storage.objects for select to authenticated
using (bucket_id = 'vault-files' and private.vault_can_read(name));

-- ── 한도 ───────────────────────────────────────────────────────────────────
-- 회사 보관 한도(바이트). 결제 연동 때 회사 요금제를 읽도록 바꾼다 — 지금은 스타터(채팅 한도와 같은 방식)
create or replace function private.vault_limit(p_company uuid)
returns bigint
language sql stable security definer
set search_path = ''
as $$
  select coalesce((select vault_storage_mb from public.billing_plans where code = 'starter'), 1024)::bigint * 1024 * 1024
$$;

create or replace function private.vault_used(p_company uuid)
returns bigint
language sql stable security definer
set search_path = ''
as $$
  select coalesce(sum(size::bigint + thumb_size), 0)::bigint from public.vault_files where company_id = p_company
$$;

-- 관리자들에게 [알림]방 글(메신저가 켜진 회사만)
create or replace function private.vault_notify_admins(p_company uuid, p_body text)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare r record;
begin
  if not private.feature_enabled(p_company, 'messenger') then return; end if;
  for r in select id from public.members where company_id = p_company and status = 'approved' and role in ('admin', 'super_admin') loop
    insert into public.chat_messages (room_id, company_id, sender_member_id, kind, body, link)
    values (private.chat_notice_room(p_company, r.id), p_company, null, 'notice', p_body, '/workspace/' || p_company || '/admin/chat-settings');
  end loop;
end;
$$;

create or replace function private.vault_mb(p_bytes bigint)
returns text
language sql immutable
set search_path = ''
as $$
  select case when p_bytes >= 1073741824 then trim(to_char(p_bytes / 1073741824.0, 'FM990.0')) || 'GB'
              else greatest(1, round(p_bytes / 1048576.0))::text || 'MB' end
$$;

-- ── 사용자 함수 ────────────────────────────────────────────────────────────
-- 보관함 상태: 회사 사용량·한도, 내 개수
create or replace function public.vault_status()
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare v_me public.members := private.require_member();
begin
  return jsonb_build_object(
    'used', private.vault_used(v_me.company_id),
    'limit', private.vault_limit(v_me.company_id),
    'company_count', (select count(*) from public.vault_files where company_id = v_me.company_id and scope = 'company'),
    'mine_private', (select count(*) from public.vault_files where owner_member_id = v_me.id and scope = 'private')
  );
end;
$$;

-- 보관 전 확인(사용자): 그 방 참여자 · 사진/파일 · 지워지지 않음 · 내가 아직 안 보관 · 한도 안. 서버가 복사할 원본 경로를 돌려준다
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

-- 내 파일 공개 범위 바꾸기(보관한 사람만)
create or replace function public.vault_set_scope(p_id uuid, p_scope text)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare v_me public.members := private.require_member();
begin
  if p_scope not in ('private', 'company') then raise exception 'INVALID_SCOPE'; end if;
  update public.vault_files set scope = p_scope, scope_changed_at = now() where id = p_id and owner_member_id = v_me.id and company_id = v_me.company_id;
  if not found then raise exception 'NOT_FOUND'; end if;
end;
$$;

-- 지우기: 보관한 사람, 또는 관리자(회사 공유만). 지운 파일 경로를 돌려준다(서버가 파일 삭제)
create or replace function public.vault_delete(p_id uuid)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_me public.members := private.require_member();
  v_row public.vault_files;
begin
  select * into v_row from public.vault_files where id = p_id and company_id = v_me.company_id for update;
  if v_row.id is null then raise exception 'NOT_FOUND'; end if;
  if not (v_row.owner_member_id = v_me.id or (v_row.scope = 'company' and v_me.role in ('admin', 'super_admin'))) then
    raise exception 'NOT_ALLOWED';
  end if;
  delete from public.vault_files where id = p_id;
  return jsonb_build_object('path', v_row.path, 'thumb_path', v_row.thumb_path);
end;
$$;

-- 관리자: 직원별 회사 공유·나만 보기 개수·용량(나만 보기 파일 이름·내용은 주지 않음)
create or replace function public.vault_member_usage()
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare v_admin public.members := private.require_admin();
begin
  return jsonb_build_object(
    'used', private.vault_used(v_admin.company_id),
    'limit', private.vault_limit(v_admin.company_id),
    'members', coalesce((
      select jsonb_agg(x order by x.total desc, x.name)
      from (
        select m.id as member_id, m.name, m.status::text as status,
          count(*) filter (where v.scope = 'company') as company_count,
          coalesce(sum(v.size::bigint + v.thumb_size) filter (where v.scope = 'company'), 0) as company_bytes,
          count(*) filter (where v.scope = 'private') as private_count,
          coalesce(sum(v.size::bigint + v.thumb_size) filter (where v.scope = 'private'), 0) as private_bytes,
          sum(v.size::bigint + v.thumb_size) as total,
          (select l.since + interval '30 days' from private.vault_leavers l where l.member_id = m.id) as private_delete_at
        from public.vault_files v join public.members m on m.id = v.owner_member_id
        where v.company_id = v_admin.company_id
        group by m.id, m.name, m.status
      ) x
    ), '[]'::jsonb)
  );
end;
$$;

-- ── 서버(service role) 함수 ────────────────────────────────────────────────
-- 복사 뒤 기록: 한도를 다시 확인(동시에 여러 개 보관). 70%·90%를 처음 넘으면 관리자 안내
create or replace function public.vault_add(p_member uuid, p_message uuid, p_scope text, p_path text, p_thumb_path text, p_thumb_size integer)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_member public.members;
  v_msg public.chat_messages;
  v_before bigint;
  v_after bigint;
  v_limit bigint;
  v_id uuid;
  v_level integer;
begin
  if p_scope not in ('private', 'company') then raise exception 'INVALID_SCOPE'; end if;
  select * into v_member from public.members where id = p_member and status = 'approved';
  if v_member.id is null then raise exception 'NOT_FOUND'; end if;
  select * into v_msg from public.chat_messages where id = p_message and company_id = v_member.company_id;
  if v_msg.id is null or v_msg.attachment_path is null then raise exception 'NOT_FOUND'; end if;
  perform pg_advisory_xact_lock(hashtext('vault:' || v_member.company_id));
  v_limit := private.vault_limit(v_member.company_id);
  v_before := private.vault_used(v_member.company_id);
  if v_before + coalesce(v_msg.attachment_size, 0) + coalesce(p_thumb_size, 0) > v_limit then raise exception 'VAULT_FULL'; end if;
  insert into public.vault_files (company_id, owner_member_id, scope, name, kind, mime, size, thumb_size, path, thumb_path, source_room_id, source_message_id)
  values (v_member.company_id, v_member.id, p_scope, coalesce(v_msg.attachment_name, '파일'), v_msg.kind, v_msg.attachment_mime,
          coalesce(v_msg.attachment_size, 0), coalesce(p_thumb_size, 0), p_path, p_thumb_path, v_msg.room_id, v_msg.id)
  returning id into v_id;
  v_after := v_before + coalesce(v_msg.attachment_size, 0) + coalesce(p_thumb_size, 0);
  v_level := case when v_before * 10 < v_limit * 9 and v_after * 10 >= v_limit * 9 then 90
                  when v_before * 10 < v_limit * 7 and v_after * 10 >= v_limit * 7 then 70 end;
  if v_level is not null then
    perform private.vault_notify_admins(v_member.company_id,
      format(E'파일 보관함이 %s%% 찼어요\n%s / %s 사용 중이에요. 다 차면 새로 보관할 수 없어요(보관한 파일은 지워지지 않아요). [파일 보관]에서 직원별 사용량을 확인해 주세요.',
        v_level, private.vault_mb(v_after), private.vault_mb(v_limit)));
  end if;
  return v_id;
end;
$$;

-- 퇴사(비활성) 감지: 나만 보기 파일이 있으면 관리자 안내. 다시 활성화되면 기록 지움
create or replace function private.vault_member_status_trg()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare v_cnt integer; v_bytes bigint;
begin
  if new.status = 'inactive' and old.status is distinct from 'inactive' then
    select count(*), coalesce(sum(size::bigint + thumb_size), 0) into v_cnt, v_bytes from public.vault_files where owner_member_id = new.id and scope = 'private';
    insert into private.vault_leavers (member_id, company_id) values (new.id, new.company_id)
    on conflict (member_id) do update set since = now(), notified7 = false;
    if v_cnt > 0 then
      perform private.vault_notify_admins(new.company_id,
        format(E'퇴사 처리된 %s 님의 보관 파일 안내\n''나만 보기'' 보관 파일 %s개(%s)는 %s에 지워져요. 회사 공유 파일은 그대로 남아요.',
          new.name, v_cnt, private.vault_mb(v_bytes), to_char((now() + interval '30 days') at time zone 'Asia/Seoul', 'YYYY-MM-DD')));
    end if;
  elsif new.status <> 'inactive' and old.status = 'inactive' then
    delete from private.vault_leavers where member_id = new.id;
  end if;
  return new;
end;
$$;
create trigger vault_member_status after update of status on public.members
for each row execute function private.vault_member_status_trg();

-- 새벽 작업: 삭제 7일 전 안내 + 30일 지난 퇴사자의 나만 보기 파일 목록(서버가 파일 삭제 뒤 vault_files_remove)
create or replace function public.vault_leaver_files_due()
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare r record; v_cnt integer; v_bytes bigint;
begin
  for r in
    select l.member_id, l.company_id, l.since, m.name from private.vault_leavers l join public.members m on m.id = l.member_id
    where not l.notified7 and l.since <= now() - interval '23 days' and l.since > now() - interval '30 days'
  loop
    select count(*), coalesce(sum(size::bigint + thumb_size), 0) into v_cnt, v_bytes from public.vault_files where owner_member_id = r.member_id and scope = 'private';
    if v_cnt > 0 then
      perform private.vault_notify_admins(r.company_id,
        format(E'7일 뒤 지워지는 보관 파일\n퇴사한 %s 님의 ''나만 보기'' 보관 파일 %s개(%s)가 %s에 지워져요.',
          r.name, v_cnt, private.vault_mb(v_bytes), to_char((r.since + interval '30 days') at time zone 'Asia/Seoul', 'YYYY-MM-DD')));
    end if;
    update private.vault_leavers set notified7 = true where member_id = r.member_id;
  end loop;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', v.id, 'path', v.path, 'thumb_path', v.thumb_path))
    from public.vault_files v join private.vault_leavers l on l.member_id = v.owner_member_id
    where v.scope = 'private' and l.since <= now() - interval '30 days'
  ), '[]'::jsonb);
end;
$$;

create or replace function public.vault_files_remove(p_ids uuid[])
returns integer
language sql security definer
set search_path = ''
as $$
  with d as (delete from public.vault_files where id = any(p_ids) returning 1) select count(*)::integer from d
$$;

-- 운영 점검: 전체 저장 용량(바이트) — Supabase 포함량 대비 운영자 알림용
create or replace function public.storage_total_bytes()
returns bigint
language sql stable security definer
set search_path = ''
as $$
  select coalesce(sum((metadata ->> 'size')::bigint), 0)::bigint from storage.objects
$$;

revoke all on function private.vault_can_read(text), private.vault_limit(uuid), private.vault_used(uuid), private.vault_notify_admins(uuid, text),
  private.vault_mb(bigint), private.vault_member_status_trg() from public, anon, authenticated;
grant execute on function private.vault_can_read(text) to authenticated;
revoke all on function public.vault_status(), public.vault_keep_check(uuid), public.vault_set_scope(uuid, text), public.vault_delete(uuid),
  public.vault_member_usage() from public, anon;
grant execute on function public.vault_status(), public.vault_keep_check(uuid), public.vault_set_scope(uuid, text), public.vault_delete(uuid),
  public.vault_member_usage() to authenticated;
revoke all on function public.vault_add(uuid, uuid, text, text, text, integer), public.vault_leaver_files_due(), public.vault_files_remove(uuid[]),
  public.storage_total_bytes() from public, anon, authenticated;
grant execute on function public.vault_add(uuid, uuid, text, text, text, integer), public.vault_leaver_files_due(), public.vault_files_remove(uuid[]),
  public.storage_total_bytes() to service_role;
