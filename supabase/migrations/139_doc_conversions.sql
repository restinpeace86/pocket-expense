-- 서류 → 엑셀 변환 (8-104 A, spec/features/company-forms.md §A, 사용자 결정 2026-11-10·11)
-- - 채팅 사진·PDF 또는 기기에서 올린 파일 → AI(Gemini 비전)가 쪽마다 표 모델(sheets jsonb) → 앱에서 글자·행 고치기 → PDF·엑셀 받기 → 확정
-- - 1쪽 1크레딧(한 번에 5쪽까지). 직원 화면에는 크레딧을 보여 주지 않는다 — 관리자 [크레딧 사용 내역]에서 본다(credit_usage)
-- - AI가 표를 못 찾으면 크레딧을 돌려준다('doc_convert_refund')
-- - 원본은 비공개 버킷 doc-files/{company_id}/{member_id}/{id}.{ext}로 복사(채팅 보관 기간이 지나도 초안을 볼 수 있게)
-- - 공개: 초안·나만 보기 = 만든 사람만, 회사 공유(확정) = 같은 회사 멤버. 지우기 = 만든 사람, 회사 공유는 관리자도
-- - 확정하지 않은 초안은 30일 뒤 삭제(새벽 작업). 시작·완료·실패 기록은 서버(service role)만

-- ── 표 ────────────────────────────────────────────────────────────────────
create table public.doc_conversions (
  id uuid primary key,
  company_id uuid not null references public.companies (id) on delete cascade,
  member_id uuid not null,
  name text not null check (char_length(name) between 1 and 255),
  mime text not null check (mime in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  source_path text not null unique,
  source_message_id uuid,
  pages integer not null check (pages between 1 and 5),
  credits integer not null default 0 check (credits >= 0),
  status text not null default 'reading' check (status in ('reading', 'draft', 'confirmed')),
  scope text not null default 'private' check (scope in ('private', 'company')),
  sheets jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  confirmed_at timestamptz,
  unique (id, company_id),
  foreign key (member_id, company_id) references public.members (id, company_id) on delete cascade,
  check (sheets is null or pg_column_size(sheets) <= 600000)
);
create index doc_conversions_member_idx on public.doc_conversions (member_id, created_at desc);
create index doc_conversions_company_idx on public.doc_conversions (company_id, status, scope, created_at desc);

alter table public.doc_conversions enable row level security;
alter table public.doc_conversions force row level security;
create policy doc_conversions_select on public.doc_conversions for select to authenticated
using (
  company_id = (select private.current_company_id())
  and (member_id = (select private.current_member_id()) or (status = 'confirmed' and scope = 'company'))
);
revoke all on public.doc_conversions from anon;
revoke insert, update, delete on public.doc_conversions from authenticated;
grant select on public.doc_conversions to authenticated;

-- ── 크레딧 기록: 변환 차감·돌려줌 + 내용(파일 이름) ─────────────────────────
do $$
declare c text;
begin
  select conname into c from pg_constraint
   where conrelid = 'public.credit_ledger'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%reason%';
  if c is not null then execute format('alter table public.credit_ledger drop constraint %I', c); end if;
end;
$$;
alter table public.credit_ledger
  add constraint credit_ledger_reason_check check (reason in ('free_trial_grant', 'receipt_upload', 'event_bonus', 'survey_bonus', 'doc_convert', 'doc_convert_refund'));
alter table public.credit_ledger add column note text check (note is null or char_length(note) <= 300);

-- ── 비공개 버킷 ────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('doc-files', 'doc-files', false, 20971520, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create or replace function private.doc_can_read(p_name text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.doc_conversions d
    join public.members m on m.id = (select private.current_member_id()) and m.status = 'approved'
    where d.source_path = p_name and d.company_id = m.company_id
      and (d.member_id = m.id or (d.status = 'confirmed' and d.scope = 'company'))
  )
$$;
-- 읽기: 볼 수 있는 변환의 원본. 올리기: 내 폴더({company}/{member}/…)에만(기기에서 고른 파일). 지우기는 서버
create policy doc_files_obj_select on storage.objects for select to authenticated
using (bucket_id = 'doc-files' and private.doc_can_read(name));
create policy doc_files_obj_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'doc-files'
  and (storage.foldername(name))[1] = (select private.current_company_id())::text
  and (storage.foldername(name))[2] = (select private.current_member_id())::text
);

-- ── 사용자 함수 ────────────────────────────────────────────────────────────
-- 채팅 파일로 변환하기 전 확인: 그 방 참여자 · 사진/PDF · 지워지지 않음. 서버가 복사할 원본을 돌려준다
create or replace function public.doc_convert_check(p_message uuid)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_me public.members := private.require_chat();
  v_msg public.chat_messages;
begin
  select * into v_msg from public.chat_messages where id = p_message and company_id = v_me.company_id;
  if v_msg.id is null or not private.is_chat_member(v_msg.room_id) then raise exception 'NOT_FOUND'; end if;
  if v_msg.kind not in ('image', 'file') or v_msg.attachment_path is null
     or coalesce(v_msg.attachment_mime, '') not in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf') then
    raise exception 'NOT_CONVERTIBLE';
  end if;
  if v_msg.deleted_at is not null or v_msg.attachment_purged_at is not null then raise exception 'EXPIRED'; end if;
  return jsonb_build_object('member_id', v_me.id, 'company_id', v_me.company_id, 'message_id', v_msg.id,
    'name', coalesce(v_msg.attachment_name, '서류'), 'mime', v_msg.attachment_mime, 'size', coalesce(v_msg.attachment_size, 0), 'path', v_msg.attachment_path);
end;
$$;

-- 고친 표 저장(만든 사람, 확정 뒤에도 고칠 수 있음)
create or replace function public.doc_convert_save(p_id uuid, p_sheets jsonb)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare v_me public.members := private.require_member();
begin
  if p_sheets is null or jsonb_typeof(p_sheets) <> 'object' or jsonb_typeof(p_sheets -> 'sheets') <> 'array'
     or jsonb_array_length(p_sheets -> 'sheets') not between 1 and 5 or pg_column_size(p_sheets) > 600000 then
    raise exception 'INVALID_SHEETS';
  end if;
  update public.doc_conversions set sheets = p_sheets, updated_at = now()
   where id = p_id and member_id = v_me.id and company_id = v_me.company_id and status in ('draft', 'confirmed');
  if not found then raise exception 'NOT_FOUND'; end if;
end;
$$;

-- 확정(회사 공유 / 나만 보기). 확정한 뒤 범위 바꾸기도 같은 함수
create or replace function public.doc_convert_confirm(p_id uuid, p_scope text)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare v_me public.members := private.require_member();
begin
  if p_scope not in ('private', 'company') then raise exception 'INVALID_SCOPE'; end if;
  update public.doc_conversions set status = 'confirmed', scope = p_scope, confirmed_at = coalesce(confirmed_at, now()), updated_at = now()
   where id = p_id and member_id = v_me.id and company_id = v_me.company_id and status in ('draft', 'confirmed');
  if not found then raise exception 'NOT_FOUND'; end if;
end;
$$;

-- 지우기: 만든 사람, 또는 관리자(회사 공유만). 원본 경로를 돌려준다(서버가 파일 삭제)
create or replace function public.doc_convert_delete(p_id uuid)
returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  v_me public.members := private.require_member();
  v_row public.doc_conversions;
begin
  select * into v_row from public.doc_conversions where id = p_id and company_id = v_me.company_id for update;
  if v_row.id is null then raise exception 'NOT_FOUND'; end if;
  if not (v_row.member_id = v_me.id or (v_row.status = 'confirmed' and v_row.scope = 'company' and v_me.role in ('admin', 'super_admin'))) then
    raise exception 'NOT_ALLOWED';
  end if;
  if v_row.status = 'reading' then raise exception 'NOT_ALLOWED'; end if;
  delete from public.doc_conversions where id = p_id;
  return v_row.source_path;
end;
$$;

-- 관리자: 이번 달(또는 고른 달, KST) 크레딧 사용 내역 — 합계 + 줄(최근 300줄). 누가·언제·무엇에
create or replace function public.credit_usage(p_month text)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_admin public.members := private.require_admin();
  v_from timestamptz;
  v_to timestamptz;
  v_company public.companies;
begin
  if p_month !~ '^\d{4}-(0[1-9]|1[0-2])$' then raise exception 'INVALID_MONTH'; end if;
  v_from := ((p_month || '-01')::date)::timestamp at time zone 'Asia/Seoul';
  v_to := (((p_month || '-01')::date + interval '1 month')::date)::timestamp at time zone 'Asia/Seoul';
  select * into v_company from public.companies where id = v_admin.company_id;
  return jsonb_build_object(
    'remaining', v_company.receipt_credits_granted - v_company.receipt_credits_used,
    'receipt', coalesce((select -sum(delta) from public.credit_ledger where company_id = v_admin.company_id and reason = 'receipt_upload' and created_at >= v_from and created_at < v_to), 0),
    'convert', coalesce((select -sum(delta) from public.credit_ledger where company_id = v_admin.company_id and reason in ('doc_convert', 'doc_convert_refund') and created_at >= v_from and created_at < v_to), 0),
    'rows', coalesce((
      select jsonb_agg(x order by x.at desc)
      from (
        select l.id, l.created_at as at, l.reason, l.delta, l.note, m.name as member_name
        from public.credit_ledger l left join public.members m on m.id = l.member_id
        where l.company_id = v_admin.company_id and l.reason in ('receipt_upload', 'doc_convert', 'doc_convert_refund')
          and l.created_at >= v_from and l.created_at < v_to
        order by l.created_at desc
        limit 300
      ) x
    ), '[]'::jsonb)
  );
end;
$$;

-- ── 서버(service role) 함수 ────────────────────────────────────────────────
-- 변환 시작: 쪽 수만큼 크레딧 차감(모자라면 NO_CREDITS) + 줄 만들기(status reading)
create or replace function public.doc_convert_begin(p_id uuid, p_member uuid, p_name text, p_mime text, p_path text, p_pages integer, p_message uuid)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_member public.members;
  v_company public.companies;
  v_name text := left(coalesce(nullif(trim(p_name), ''), '서류'), 255);
begin
  select * into v_member from public.members where id = p_member and status = 'approved';
  if v_member.id is null then raise exception 'NOT_FOUND'; end if;
  if p_pages is null or p_pages not between 1 and 5 then raise exception 'TOO_MANY_PAGES'; end if;
  if p_path is null or split_part(p_path, '/', 1) <> v_member.company_id::text or split_part(p_path, '/', 2) <> v_member.id::text then
    raise exception 'INVALID_FILE';
  end if;
  select * into v_company from public.companies where id = v_member.company_id for update;
  if v_company.receipt_credits_granted - v_company.receipt_credits_used < p_pages then raise exception 'NO_CREDITS'; end if;
  update public.companies set receipt_credits_used = receipt_credits_used + p_pages where id = v_company.id;
  insert into public.doc_conversions (id, company_id, member_id, name, mime, source_path, source_message_id, pages, credits)
  values (p_id, v_member.company_id, v_member.id, v_name, p_mime, p_path, p_message, p_pages, p_pages);
  insert into public.credit_ledger (company_id, delta, reason, member_id, note)
  values (v_member.company_id, -p_pages, 'doc_convert', v_member.id, format('%s (%s쪽)', v_name, p_pages));
  return jsonb_build_object('id', p_id);
end;
$$;

-- 변환 끝: 표 저장(status draft)
create or replace function public.doc_convert_ready(p_id uuid, p_sheets jsonb)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if p_sheets is null or jsonb_typeof(p_sheets -> 'sheets') <> 'array' then raise exception 'INVALID_SHEETS'; end if;
  update public.doc_conversions set sheets = p_sheets, status = 'draft', updated_at = now() where id = p_id and status = 'reading';
  if not found then raise exception 'NOT_FOUND'; end if;
end;
$$;

-- 변환 실패(표를 못 찾음·AI 오류): 크레딧 돌려주고 줄 지우기. 원본 경로를 돌려준다(서버가 파일 삭제)
create or replace function public.doc_convert_fail(p_id uuid)
returns text
language plpgsql security definer
set search_path = ''
as $$
declare v_row public.doc_conversions;
begin
  select * into v_row from public.doc_conversions where id = p_id and status = 'reading' for update;
  if v_row.id is null then return null; end if;
  if v_row.credits > 0 then
    update public.companies set receipt_credits_used = greatest(0, receipt_credits_used - v_row.credits) where id = v_row.company_id;
    insert into public.credit_ledger (company_id, delta, reason, member_id, note)
    values (v_row.company_id, v_row.credits, 'doc_convert_refund', v_row.member_id, format('%s — 표를 못 찾아 돌려줌', v_row.name));
  end if;
  delete from public.doc_conversions where id = p_id;
  return v_row.source_path;
end;
$$;

-- 새벽 작업: 30일 지난 초안 + 1시간 넘게 멈춘 변환(크레딧 돌려줌) 지우기 → 원본 경로 목록
create or replace function public.doc_convert_due()
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare r record; v_paths text[] := '{}'; v_p text;
begin
  for r in select id from public.doc_conversions where status = 'reading' and created_at < now() - interval '1 hour' loop
    v_p := public.doc_convert_fail(r.id);
    if v_p is not null then v_paths := v_paths || v_p; end if;
  end loop;
  with d as (delete from public.doc_conversions where status = 'draft' and created_at < now() - interval '30 days' returning source_path)
  select v_paths || coalesce(array_agg(source_path), '{}') into v_paths from d;
  return to_jsonb(v_paths);
end;
$$;

revoke all on function private.doc_can_read(text) from public, anon, authenticated;
grant execute on function private.doc_can_read(text) to authenticated;
revoke all on function public.doc_convert_check(uuid), public.doc_convert_save(uuid, jsonb), public.doc_convert_confirm(uuid, text),
  public.doc_convert_delete(uuid), public.credit_usage(text) from public, anon;
grant execute on function public.doc_convert_check(uuid), public.doc_convert_save(uuid, jsonb), public.doc_convert_confirm(uuid, text),
  public.doc_convert_delete(uuid), public.credit_usage(text) to authenticated;
revoke all on function public.doc_convert_begin(uuid, uuid, text, text, text, integer, uuid), public.doc_convert_ready(uuid, jsonb),
  public.doc_convert_fail(uuid), public.doc_convert_due() from public, anon, authenticated;
grant execute on function public.doc_convert_begin(uuid, uuid, text, text, text, integer, uuid), public.doc_convert_ready(uuid, jsonb),
  public.doc_convert_fail(uuid), public.doc_convert_due() to service_role;
