-- 회사 양식 등록 (8-104 B, spec/features/company-forms.md §B, D-249, 사용자 결정 2026-11-10·11)
-- - 관리자가 회사 서류(휴가신청서·일반 결재 문서) 사진·PDF를 올리면 AI가 표 모양(sheets, 서류 → 엑셀과 같은 모델)과 값 칸(fields)을 읽는다
--   → PC에서 칸마다 우리 데이터 / 직원 입력 / 고정 값 / 비워 두기 / 빼기를 정해 등록. 등록 과정의 AI는 크레딧을 쓰지 않는다
-- - 버전마다 한 줄: 같은 양식(group_id)의 새 버전 = 고치기·새 파일로 바꾸기(무료, 칸 그대로). 이미 낸 문서는 낼 때의 버전으로(C)
-- - 상태: draft(고치는 중·휴대폰에서 담아 둔 파일, 30일 정리) / active(지금 쓰는 버전) / old(지난 버전) / deleted(지운 양식 — 지난 문서용으로 줄은 남김)
-- - 양식 칸: billing_plans.form_slots(스타터 0·프로 1·비즈니스 3) + companies.extra_form_slots(추가 1장 2만 원, 한 번 결제)
--   결제가 꺼진 동안은 모든 회사 1장(사용자 결정 2026-11-11) — 결제 연동 때 회사 요금제를 읽도록 바꾼다
-- - 칸 다 쓰면 [추가 신청] → 운영자가 extra_form_slots를 늘려 준다(form_slot_requests)
-- - 원본은 비공개 버킷 form-files/{company_id}/{id}.{ext} — 사용자 정책 없음(서버가 관리자 확인 뒤 서명 주소로만 보여 줌)
-- - 회사 격리: company_id 복합 FK, RLS 강제, 쓰기는 함수로만(관리자)

alter table public.billing_plans add column form_slots integer not null default 0 check (form_slots between 0 and 50);
update public.billing_plans set form_slots = case code when 'starter' then 0 when 'standard' then 1 when 'pro' then 3 else 0 end;
alter table public.companies add column extra_form_slots integer not null default 0 check (extra_form_slots between 0 and 100);

create table public.company_forms (
  id uuid primary key,
  company_id uuid not null references public.companies (id) on delete cascade,
  group_id uuid not null,
  version integer not null default 0 check (version >= 0),
  kind text check (kind in ('leave', 'general')),
  name text not null check (char_length(name) between 1 and 60),
  status text not null default 'draft' check (status in ('draft', 'active', 'old', 'deleted')),
  sheets jsonb,
  fields jsonb not null default '[]'::jsonb,
  source_path text not null,
  mime text not null check (mime in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  source_name text check (source_name is null or char_length(source_name) <= 255),
  reads integer not null default 0 check (reads between 0 and 3),
  created_by uuid,
  created_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  unique (id, company_id),
  foreign key (created_by, company_id) references public.members (id, company_id) on delete set null (created_by),
  check (sheets is null or pg_column_size(sheets) <= 600000),
  check (jsonb_typeof(fields) = 'array' and jsonb_array_length(fields) <= 200),
  check (status = 'draft' or (sheets is not null and kind is not null and version > 0))
);
create index company_forms_company_idx on public.company_forms (company_id, status, created_at desc);
create unique index company_forms_one_active on public.company_forms (group_id) where status = 'active';
create unique index company_forms_one_draft on public.company_forms (group_id) where status = 'draft';
create unique index company_forms_version on public.company_forms (group_id, version) where version > 0;
-- 휴가신청서는 회사에 하나(새로 올리면 그 양식의 새 버전)
create unique index company_forms_one_leave on public.company_forms (company_id) where status = 'active' and kind = 'leave';

alter table public.company_forms enable row level security;
alter table public.company_forms force row level security;
-- 읽기: 관리자는 회사 양식 전부, 직원은 지금 쓰는/지난 버전(휴가신청서 출력 C용). 쓰기는 함수로만
create policy company_forms_select on public.company_forms for select to authenticated
using (
  company_id = (select private.current_company_id())
  and (status in ('active', 'old') or (select private.is_admin()))
);
revoke all on public.company_forms from anon;
revoke insert, update, delete on public.company_forms from authenticated;
grant select on public.company_forms to authenticated;

-- 칸 추가 신청(결제가 꺼진 동안 운영자가 늘려 줌)
create table public.form_slot_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  member_id uuid,
  requested_by_name text,
  status text not null default 'received' check (status in ('received', 'done')),
  created_at timestamptz not null default now(),
  done_at timestamptz,
  foreign key (member_id, company_id) references public.members (id, company_id) on delete set null (member_id)
);
create unique index form_slot_requests_one_open on public.form_slot_requests (company_id) where status = 'received';
alter table public.form_slot_requests enable row level security;
alter table public.form_slot_requests force row level security;
create policy form_slot_requests_select on public.form_slot_requests for select to authenticated
using (company_id = (select private.current_company_id()) and (select private.is_admin()));
revoke all on public.form_slot_requests from anon;
revoke insert, update, delete on public.form_slot_requests from authenticated;
grant select on public.form_slot_requests to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('form-files', 'form-files', false, 20971520, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- ── 칸 ─────────────────────────────────────────────────────────────────────
create or replace function private.form_slot_limit(p_company uuid)
returns integer
language sql stable security definer
set search_path = ''
as $$
  -- 결제가 꺼진 동안 모든 회사 프로(standard) 기준 1장 + 추가 칸
  select coalesce((select form_slots from public.billing_plans where code = 'standard'), 1)
       + coalesce((select extra_form_slots from public.companies where id = p_company), 0)
$$;

create or replace function private.form_slot_used(p_company uuid)
returns integer
language sql stable security definer
set search_path = ''
as $$
  select count(distinct group_id)::integer from public.company_forms where company_id = p_company and status = 'active'
$$;

-- 원본 파일을 다른 줄(다른 버전)이 아직 쓰면 null
create or replace function private.form_orphan_path(p_path text, p_except uuid)
returns text
language sql stable security definer
set search_path = ''
as $$
  select case when exists (select 1 from public.company_forms where source_path = p_path and id <> p_except) then null else p_path end
$$;

-- ── 관리자 함수 ────────────────────────────────────────────────────────────
-- 칸 사용·신청 상태
create or replace function public.company_form_slots()
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare v_admin public.members := private.require_admin();
begin
  return jsonb_build_object(
    'limit', private.form_slot_limit(v_admin.company_id),
    'used', private.form_slot_used(v_admin.company_id),
    'requested', exists (select 1 from public.form_slot_requests where company_id = v_admin.company_id and status = 'received')
  );
end;
$$;

-- 채팅 사진·PDF로 시작하기 전 확인(관리자 · 그 방 참여자 · 사진/PDF · 지워지지 않음). 서버가 복사할 원본을 돌려준다
create or replace function public.company_form_check(p_message uuid)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_admin public.members := private.require_admin();
  v_msg public.chat_messages;
begin
  select * into v_msg from public.chat_messages where id = p_message and company_id = v_admin.company_id;
  if v_msg.id is null or not private.is_chat_member(v_msg.room_id) then raise exception 'NOT_FOUND'; end if;
  if v_msg.kind not in ('image', 'file') or v_msg.attachment_path is null
     or coalesce(v_msg.attachment_mime, '') not in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf') then
    raise exception 'NOT_CONVERTIBLE';
  end if;
  if v_msg.deleted_at is not null or v_msg.attachment_purged_at is not null then raise exception 'EXPIRED'; end if;
  return jsonb_build_object('company_id', v_admin.company_id, 'name', coalesce(v_msg.attachment_name, '양식'),
    'mime', v_msg.attachment_mime, 'size', coalesce(v_msg.attachment_size, 0), 'path', v_msg.attachment_path);
end;
$$;

-- 초안 만들기(서버가 form-files/{회사}/{id}.{ext}로 파일을 옮긴 뒤). p_group = 새 버전으로 올릴 양식(없으면 새 양식)
-- 같은 양식의 이전 초안은 지우고 그 원본 경로를 돌려준다(서버가 파일 삭제)
create or replace function public.company_form_start(p_id uuid, p_group uuid, p_name text, p_mime text, p_path text, p_source_name text)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_admin public.members := private.require_admin();
  v_active public.company_forms;
  v_old public.company_forms;
  v_removed text;
begin
  if p_path is null or p_path !~ ('^' || v_admin.company_id::text || '/' || p_id::text || '\.(jpg|png|webp|pdf)$') then
    raise exception 'INVALID_FILE';
  end if;
  if p_group is not null then
    select * into v_active from public.company_forms where group_id = p_group and company_id = v_admin.company_id and status = 'active';
    if v_active.id is null then raise exception 'NOT_FOUND'; end if;
    select * into v_old from public.company_forms where group_id = p_group and status = 'draft';
    if v_old.id is not null then
      delete from public.company_forms where id = v_old.id;
      v_removed := private.form_orphan_path(v_old.source_path, v_old.id);
    end if;
  elsif (select count(*) from public.company_forms where company_id = v_admin.company_id and status = 'draft'
           and not exists (select 1 from public.company_forms a where a.group_id = company_forms.group_id and a.status = 'active')) >= 5 then
    raise exception 'DRAFTS_FULL';
  end if;
  insert into public.company_forms (id, company_id, group_id, kind, name, source_path, mime, source_name, created_by, created_by_name)
  values (p_id, v_admin.company_id, coalesce(p_group, p_id), v_active.kind,
    left(coalesce(nullif(trim(v_active.name), ''), nullif(trim(p_name), ''), '회사 양식'), 60),
    p_path, p_mime, left(p_source_name, 255), v_admin.id, v_admin.name);
  return jsonb_build_object('id', p_id, 'removed', v_removed);
end;
$$;

-- AI로 읽기 전 확인: 종류 정하기(새 양식은 칸 확인, 휴가신청서가 이미 있으면 그 양식의 새 버전으로), 읽은 횟수 3번(처음 + 다시 읽기 2번)까지
-- 서버가 읽을 원본 경로를 돌려준다. 다른 양식으로 옮기며 지운 초안 경로도 함께
create or replace function public.company_form_read_begin(p_id uuid, p_kind text)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_admin public.members := private.require_admin();
  v_row public.company_forms;
  v_leave public.company_forms;
  v_old public.company_forms;
  v_removed text;
  v_new boolean;
begin
  if p_kind not in ('leave', 'general') then raise exception 'INVALID_KIND'; end if;
  select * into v_row from public.company_forms where id = p_id and company_id = v_admin.company_id and status = 'draft' for update;
  if v_row.id is null then raise exception 'NOT_FOUND'; end if;
  if v_row.reads >= 3 then raise exception 'READS_USED'; end if;
  v_new := not exists (select 1 from public.company_forms where group_id = v_row.group_id and status = 'active');
  if v_new and p_kind = 'leave' then
    select * into v_leave from public.company_forms where company_id = v_admin.company_id and status = 'active' and kind = 'leave';
    if v_leave.id is not null then
      -- 휴가신청서는 하나: 이미 있는 휴가신청서의 새 버전으로 옮긴다(무료)
      select * into v_old from public.company_forms where group_id = v_leave.group_id and status = 'draft';
      if v_old.id is not null then
        delete from public.company_forms where id = v_old.id;
        v_removed := private.form_orphan_path(v_old.source_path, v_old.id);
      end if;
      update public.company_forms set group_id = v_leave.group_id, name = v_leave.name where id = p_id;
      v_new := false;
    end if;
  end if;
  if not v_new and p_kind <> coalesce((select kind from public.company_forms where group_id = (select group_id from public.company_forms where id = p_id) and status = 'active'), p_kind) then
    raise exception 'KIND_MISMATCH';
  end if;
  if v_new and private.form_slot_used(v_admin.company_id) >= private.form_slot_limit(v_admin.company_id) then
    raise exception 'SLOTS_FULL';
  end if;
  update public.company_forms set kind = p_kind, updated_at = now() where id = p_id;
  return jsonb_build_object('path', v_row.source_path, 'mime', v_row.mime, 'removed', v_removed);
end;
$$;

-- AI가 읽은 결과 저장(읽은 횟수 +1)
create or replace function public.company_form_read_done(p_id uuid, p_name text, p_sheets jsonb, p_fields jsonb)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare v_admin public.members := private.require_admin();
begin
  if p_sheets is null or jsonb_typeof(p_sheets -> 'sheets') <> 'array' or jsonb_array_length(p_sheets -> 'sheets') not between 1 and 5
     or pg_column_size(p_sheets) > 600000 or jsonb_typeof(p_fields) <> 'array' then
    raise exception 'INVALID_SHEETS';
  end if;
  update public.company_forms
     set sheets = p_sheets, fields = p_fields, reads = reads + 1, updated_at = now(),
         -- 새 양식만 AI가 읽은 제목으로 이름(새 버전은 원래 이름 그대로)
         name = case when not exists (select 1 from public.company_forms a where a.group_id = company_forms.group_id and a.status = 'active')
                     then left(coalesce(nullif(trim(p_name), ''), name), 60) else name end
   where id = p_id and company_id = v_admin.company_id and status = 'draft' and reads < 3;
  if not found then raise exception 'READS_USED'; end if;
end;
$$;

-- 고친 표·칸·이름 저장(초안)
create or replace function public.company_form_save(p_id uuid, p_name text, p_sheets jsonb, p_fields jsonb)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare v_admin public.members := private.require_admin();
begin
  if p_sheets is null or jsonb_typeof(p_sheets -> 'sheets') <> 'array' or jsonb_array_length(p_sheets -> 'sheets') not between 1 and 5
     or pg_column_size(p_sheets) > 600000 or jsonb_typeof(p_fields) <> 'array' or jsonb_array_length(p_fields) > 200 then
    raise exception 'INVALID_SHEETS';
  end if;
  if char_length(trim(coalesce(p_name, ''))) not between 1 and 60 then raise exception 'INVALID_NAME'; end if;
  update public.company_forms set sheets = p_sheets, fields = p_fields, name = trim(p_name), updated_at = now()
   where id = p_id and company_id = v_admin.company_id and status = 'draft';
  if not found then raise exception 'NOT_FOUND'; end if;
end;
$$;

-- 등록: 모든 칸이 정해졌는지(정해 주세요가 없음), 직원 입력 칸 수(휴가 5·일반 15), 새 양식이면 칸 확인 → 새 버전 번호로 지금 쓰는 버전
create or replace function public.company_form_publish(p_id uuid)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_admin public.members := private.require_admin();
  v_row public.company_forms;
  v_new boolean;
  v_inputs integer;
  v_version integer;
begin
  select * into v_row from public.company_forms where id = p_id and company_id = v_admin.company_id and status = 'draft' for update;
  if v_row.id is null then raise exception 'NOT_FOUND'; end if;
  if v_row.sheets is null or v_row.kind is null then raise exception 'NOT_READ'; end if;
  if exists (select 1 from jsonb_array_elements(v_row.fields) f where coalesce(f -> 'b' ->> 'k', 'pending') not in ('data', 'input', 'fixed', 'blank')) then
    raise exception 'FIELDS_PENDING';
  end if;
  select count(*) into v_inputs from jsonb_array_elements(v_row.fields) f where f -> 'b' ->> 'k' = 'input';
  if v_inputs > (case v_row.kind when 'leave' then 5 else 15 end) then raise exception 'TOO_MANY_INPUTS'; end if;
  -- 같은 회사 양식을 동시에 등록할 때 칸 수가 넘지 않게 회사 줄을 잠근다
  perform 1 from public.companies where id = v_admin.company_id for update;
  v_new := not exists (select 1 from public.company_forms where group_id = v_row.group_id and status = 'active');
  if v_new and private.form_slot_used(v_admin.company_id) >= private.form_slot_limit(v_admin.company_id) then
    raise exception 'SLOTS_FULL';
  end if;
  if v_new and v_row.kind = 'leave' and exists (select 1 from public.company_forms where company_id = v_admin.company_id and status = 'active' and kind = 'leave') then
    raise exception 'LEAVE_EXISTS';
  end if;
  select coalesce(max(version), 0) + 1 into v_version from public.company_forms where group_id = v_row.group_id;
  update public.company_forms set status = 'old', updated_at = now() where group_id = v_row.group_id and status = 'active';
  update public.company_forms set status = 'active', version = v_version, published_at = now(), updated_at = now(),
    created_by = v_admin.id, created_by_name = v_admin.name
   where id = p_id;
  return jsonb_build_object('group_id', v_row.group_id, 'version', v_version);
end;
$$;

-- 고치기: 지금 쓰는 버전을 초안으로 복사(이미 고치는 중이면 그 초안). AI 읽기 없음
create or replace function public.company_form_edit(p_group uuid)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_admin public.members := private.require_admin();
  v_active public.company_forms;
  v_draft uuid;
  v_id uuid := gen_random_uuid();
begin
  select * into v_active from public.company_forms where group_id = p_group and company_id = v_admin.company_id and status = 'active';
  if v_active.id is null then raise exception 'NOT_FOUND'; end if;
  select id into v_draft from public.company_forms where group_id = p_group and status = 'draft';
  if v_draft is not null then return v_draft; end if;
  insert into public.company_forms (id, company_id, group_id, kind, name, sheets, fields, source_path, mime, source_name, reads, created_by, created_by_name)
  values (v_id, v_admin.company_id, p_group, v_active.kind, v_active.name, v_active.sheets, v_active.fields, v_active.source_path,
    v_active.mime, v_active.source_name, 3, v_admin.id, v_admin.name); -- 같은 파일이라 AI 다시 읽기는 없음
  return v_id;
end;
$$;

-- 지우기: 초안은 줄 삭제(원본을 다른 버전이 안 쓰면 경로를 돌려줌). 등록된 양식은 모든 버전을 deleted로(칸이 빈다, 지난 문서용으로 줄은 남김)
create or replace function public.company_form_delete(p_id uuid)
returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  v_admin public.members := private.require_admin();
  v_row public.company_forms;
begin
  select * into v_row from public.company_forms where id = p_id and company_id = v_admin.company_id;
  if v_row.id is null or v_row.status = 'deleted' then raise exception 'NOT_FOUND'; end if;
  if v_row.status = 'draft' then
    delete from public.company_forms where id = p_id;
    return private.form_orphan_path(v_row.source_path, p_id);
  end if;
  delete from public.company_forms where group_id = v_row.group_id and status = 'draft';
  update public.company_forms set status = 'deleted', updated_at = now() where group_id = v_row.group_id and status in ('active', 'old');
  return null;
end;
$$;

-- 칸 추가 신청(이미 접수된 신청이 있으면 그대로)
create or replace function public.form_slot_request()
returns void
language plpgsql security definer
set search_path = ''
as $$
declare v_admin public.members := private.require_admin();
begin
  insert into public.form_slot_requests (company_id, member_id, requested_by_name)
  values (v_admin.company_id, v_admin.id, v_admin.name)
  on conflict (company_id) where status = 'received' do nothing;
end;
$$;

-- ── 서버(service role) 함수 ────────────────────────────────────────────────
-- 새벽 작업: 30일 지난 초안 지우기 → 다른 버전이 안 쓰는 원본 경로 목록
create or replace function public.company_form_due()
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare r record; v_paths text[] := '{}'; v_p text;
begin
  for r in select id, source_path from public.company_forms where status = 'draft' and updated_at < now() - interval '30 days' loop
    delete from public.company_forms where id = r.id;
    v_p := private.form_orphan_path(r.source_path, r.id);
    if v_p is not null then v_paths := v_paths || v_p; end if;
  end loop;
  return to_jsonb(v_paths);
end;
$$;

-- 운영자: 칸 +n(신청 처리)
create or replace function public.form_slot_grant(p_company uuid, p_add integer)
returns integer
language plpgsql security definer
set search_path = ''
as $$
declare v_extra integer;
begin
  if p_add is null or p_add not between -10 and 10 or p_add = 0 then raise exception 'INVALID_COUNT'; end if;
  update public.companies set extra_form_slots = greatest(0, extra_form_slots + p_add) where id = p_company returning extra_form_slots into v_extra;
  if v_extra is null then raise exception 'NOT_FOUND'; end if;
  if p_add > 0 then
    update public.form_slot_requests set status = 'done', done_at = now() where company_id = p_company and status = 'received';
  end if;
  return v_extra;
end;
$$;

revoke all on function private.form_slot_limit(uuid), private.form_slot_used(uuid), private.form_orphan_path(text, uuid) from public, anon, authenticated;
revoke all on function public.company_form_slots(), public.company_form_check(uuid), public.company_form_start(uuid, uuid, text, text, text, text),
  public.company_form_read_begin(uuid, text), public.company_form_read_done(uuid, text, jsonb, jsonb), public.company_form_save(uuid, text, jsonb, jsonb),
  public.company_form_publish(uuid), public.company_form_edit(uuid), public.company_form_delete(uuid), public.form_slot_request() from public, anon;
grant execute on function public.company_form_slots(), public.company_form_check(uuid), public.company_form_start(uuid, uuid, text, text, text, text),
  public.company_form_read_begin(uuid, text), public.company_form_read_done(uuid, text, jsonb, jsonb), public.company_form_save(uuid, text, jsonb, jsonb),
  public.company_form_publish(uuid), public.company_form_edit(uuid), public.company_form_delete(uuid), public.form_slot_request() to authenticated;
revoke all on function public.company_form_due(), public.form_slot_grant(uuid, integer) from public, anon, authenticated;
grant execute on function public.company_form_due(), public.form_slot_grant(uuid, integer) to service_role;
