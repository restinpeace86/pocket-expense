-- 163: [결재 문서] — 품의서·구매요청서 같은 일반 결재 문서를 직원이 쓰고 결재받는다(9-33e2, D-284 · spec/features/company-forms.md §G-3)
-- - 결재선 = 지출결의서와 같은 결재라인(부서별 → 회사 기본 사전 검토 0~4명) → 관리자 최종 승인. 올릴 때 단계를 복사해 고정(D-012와 같음)
-- - 직원은 결재선을 못 바꾼다. 회수 = 첫 결재자가 처리하기 전까지만(→ 작성 중). 참조자 없음
-- - 대표(최고 관리자) 본인 문서는 바로 본인 승인(D-026과 같은 방식), 결재선에 본인이 있으면 본인 단계까지 건너뜀
-- - 알림: 차례가 된 사람(검토자 / 관리자들)·쓴 사람(최종 승인·반려)에게 채팅 [알림]방 + 앱 알림(근태와 같은 통로)
-- - 첨부: 사진·PDF 최대 5개, 10MB, 저장소 approval-files/{회사}/{쓴 사람}/{문서}/… (휴가 증빙과 같은 방식)
-- 회사 격리: company_id 복합 FK + RLS 강제, 쓰기는 함수만

create table public.approval_documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  member_id uuid not null,
  member_name text not null,
  form_id uuid not null, -- 쓴 양식 버전(company_forms 줄)
  doc_type text not null check (doc_type in ('pumui', 'purchase', 'trip', 'outside', 'remote', 'early', 'incident', 'resign', 'absence', 'other')),
  title text not null check (char_length(title) between 1 and 100),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object' and pg_column_size(payload) <= 100000),
  status text not null default 'draft' check (status in ('draft', 'submitted', 'approved', 'rejected')),
  current_round integer not null default 0 check (current_round >= 0),
  self_approved boolean not null default false,
  rejection_reason text check (rejection_reason is null or char_length(rejection_reason) <= 300),
  submitted_at timestamptz,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, company_id),
  foreign key (member_id, company_id) references public.members (id, company_id),
  foreign key (form_id, company_id) references public.company_forms (id, company_id)
);
create index approval_documents_member on public.approval_documents (member_id, updated_at desc);
create index approval_documents_company on public.approval_documents (company_id, status, submitted_at desc);

create table public.approval_document_steps (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null,
  company_id uuid not null references public.companies (id) on delete cascade,
  round integer not null check (round >= 1),
  step_order integer not null check (step_order >= 1),
  step_kind public.approval_step_kind not null,
  approver_member_id uuid, -- review: 지정 검토자 / final: null(쓴 사람 뺀 관리자 이상)
  acted_by_member_id uuid,
  acted_by_name text,
  status public.approval_step_status not null,
  comment text check (comment is null or char_length(comment) <= 300),
  acted_at timestamptz,
  created_at timestamptz not null default now(),
  constraint approval_document_steps_review_has_approver check ((step_kind = 'review') = (approver_member_id is not null)),
  unique (document_id, round, step_order),
  foreign key (document_id, company_id) references public.approval_documents (id, company_id) on delete cascade,
  foreign key (approver_member_id, company_id) references public.members (id, company_id),
  foreign key (acted_by_member_id, company_id) references public.members (id, company_id)
);
create index approval_document_steps_pending on public.approval_document_steps (company_id, status) where status = 'pending';
create index approval_document_steps_approver on public.approval_document_steps (approver_member_id) where approver_member_id is not null;

create table public.approval_document_files (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  member_id uuid not null,
  document_id uuid not null,
  path text not null unique,
  name text not null check (char_length(name) between 1 and 200),
  mime text not null check (mime in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  size integer not null check (size > 0 and size <= 10485760),
  created_at timestamptz not null default now(),
  constraint approval_document_files_path check (path like company_id::text || '/' || member_id::text || '/' || document_id::text || '/%'),
  foreign key (document_id, company_id) references public.approval_documents (id, company_id) on delete cascade,
  foreign key (member_id, company_id) references public.members (id, company_id)
);
create index approval_document_files_doc on public.approval_document_files (document_id);

-- 볼 수 있는 사람: 쓴 사람 · 결재선에 있는 검토자 · 관리자(올린 뒤부터). 같은 회사만
create or replace function private.approval_doc_visible(p_doc uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.approval_documents d
    where d.id = p_doc and d.company_id = private.current_company_id()
      and (d.member_id = private.current_member_id()
        or (d.status <> 'draft' and private.is_admin())
        or exists (select 1 from public.approval_document_steps s where s.document_id = d.id and s.approver_member_id = private.current_member_id()))
  )
$$;
-- 저장소 경로(글자)용: uuid 모양일 때만 확인(다른 버킷 경로에서 변환 오류가 나지 않게 case로 순서 고정)
create or replace function private.approval_doc_visible_path(p_folder text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select case when p_folder ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then private.approval_doc_visible(p_folder::uuid) else false end
$$;
revoke all on function private.approval_doc_visible(uuid), private.approval_doc_visible_path(text) from public, anon;
grant execute on function private.approval_doc_visible(uuid), private.approval_doc_visible_path(text) to authenticated;

alter table public.approval_documents enable row level security;
alter table public.approval_documents force row level security;
alter table public.approval_document_steps enable row level security;
alter table public.approval_document_steps force row level security;
alter table public.approval_document_files enable row level security;
alter table public.approval_document_files force row level security;
revoke all on public.approval_documents, public.approval_document_steps, public.approval_document_files from anon, authenticated;
grant select on public.approval_documents, public.approval_document_steps, public.approval_document_files to authenticated;
create policy approval_documents_select on public.approval_documents for select to authenticated
  using (company_id = (select private.current_company_id()) and (select private.approval_doc_visible(id)));
create policy approval_document_steps_select on public.approval_document_steps for select to authenticated
  using (company_id = (select private.current_company_id()) and (select private.approval_doc_visible(document_id)));
create policy approval_document_files_select on public.approval_document_files for select to authenticated
  using (company_id = (select private.current_company_id()) and (select private.approval_doc_visible(document_id)));

-- ── 첨부 저장소 ─────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('approval-files', 'approval-files', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy approval_files_select on storage.objects for select to authenticated
using (
  bucket_id = 'approval-files'
  and (storage.foldername(name))[1] = private.current_company_id()::text
  and private.approval_doc_visible_path((storage.foldername(name))[3])
);
-- 올리기·지우기: 쓴 사람만, 작성 중·반려(고쳐 쓰는 중)인 자기 문서 폴더에만
create policy approval_files_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'approval-files'
  and (storage.foldername(name))[1] = private.current_company_id()::text
  and (storage.foldername(name))[2] = private.current_member_id()::text
  and exists (select 1 from public.approval_documents d
              where d.id::text = (storage.foldername(name))[3] and d.member_id = private.current_member_id() and d.status in ('draft', 'rejected'))
);
create policy approval_files_delete on storage.objects for delete to authenticated
using (
  bucket_id = 'approval-files'
  and (storage.foldername(name))[1] = private.current_company_id()::text
  and (storage.foldername(name))[2] = private.current_member_id()::text
  and exists (select 1 from public.approval_documents d
              where d.id::text = (storage.foldername(name))[3] and d.member_id = private.current_member_id() and d.status in ('draft', 'rejected'))
);

-- ── 함수 ────────────────────────────────────────────────────────────────────
-- 내 문서(작성 중·반려만 고칠 수 있음)
create or replace function private.approval_doc_mine(p_id uuid, p_editable boolean)
returns public.approval_documents
language plpgsql security definer
set search_path = ''
as $$
declare v_me public.members := private.require_member(); d public.approval_documents;
begin
  select * into d from public.approval_documents where id = p_id and company_id = v_me.company_id and member_id = v_me.id for update;
  if d.id is null then raise exception 'NOT_FOUND' using errcode = '42501'; end if;
  if p_editable and d.status not in ('draft', 'rejected') then raise exception 'INVALID_STATUS'; end if;
  return d;
end;
$$;

-- 알림 한 건([알림]방). 보낸 게 있으면 true
create or replace function private.approval_doc_notify(p_doc public.approval_documents, p_to uuid, p_head text, p_link text)
returns boolean
language plpgsql security definer
set search_path = ''
as $$
begin
  return private.attendance_notify(p_doc.company_id, p_to,
    p_head || chr(10) || '종류: ' || coalesce((select name from public.company_forms where id = p_doc.form_id), '결재 문서')
      || chr(10) || '제목: ' || p_doc.title || chr(10) || '쓴 사람: ' || p_doc.member_name,
    p_link);
end;
$$;

-- 지금 차례인 사람에게 알림(검토 = 그 사람, 최종 = 쓴 사람 뺀 관리자 모두)
create or replace function private.approval_doc_notify_turn(p_doc public.approval_documents)
returns boolean
language plpgsql security definer
set search_path = ''
as $$
declare s public.approval_document_steps; a record; v_sent boolean := false;
begin
  select * into s from public.approval_document_steps where document_id = p_doc.id and round = p_doc.current_round and status = 'pending';
  if s.id is null then return false; end if;
  if s.step_kind = 'review' then
    return private.approval_doc_notify(p_doc, s.approver_member_id, '결재 문서 확인 요청이 왔어요', '/workspace/' || p_doc.company_id || '/approvals');
  end if;
  for a in select m.id from public.members m
           where m.company_id = p_doc.company_id and m.status = 'approved' and m.role in ('super_admin', 'admin') and m.id <> p_doc.member_id
  loop
    v_sent := private.approval_doc_notify(p_doc, a.id, '결재 문서 승인 요청이 왔어요', '/workspace/' || p_doc.company_id || '/admin/docs') or v_sent;
  end loop;
  return v_sent;
end;
$$;

-- 새로 쓰기: 지금 쓰는(등록된) 결재 문서 양식으로 작성 중 문서를 만든다
create or replace function public.approval_doc_create(p_form uuid)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare v_me public.members := private.require_member(); f public.company_forms; v_id uuid;
begin
  select * into f from public.company_forms where id = p_form and company_id = v_me.company_id and status = 'active' and kind = 'general';
  if f.id is null then raise exception 'FORM_NOT_FOUND'; end if;
  if (select count(*) from public.approval_documents where member_id = v_me.id and status = 'draft') >= 50 then raise exception 'TOO_MANY_DRAFTS'; end if;
  insert into public.approval_documents (company_id, member_id, member_name, form_id, doc_type, title)
  values (v_me.company_id, v_me.id, v_me.name, f.id, coalesce(f.doc_type, 'other'), f.name)
  returning id into v_id;
  return v_id;
end;
$$;

-- 저장(자동 저장): 제목 + 입력값. 작성 중·반려만
create or replace function public.approval_doc_save(p_id uuid, p_title text, p_payload jsonb)
returns timestamptz
language plpgsql security definer
set search_path = ''
as $$
declare d public.approval_documents := private.approval_doc_mine(p_id, true); v_at timestamptz := now();
begin
  if char_length(trim(coalesce(p_title, ''))) not between 1 and 100 then raise exception 'INVALID_TITLE'; end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' or pg_column_size(p_payload) > 100000 then raise exception 'INVALID_PAYLOAD'; end if;
  update public.approval_documents set title = trim(p_title), payload = p_payload, updated_at = v_at where id = d.id;
  return v_at;
end;
$$;

-- 지우기: 작성 중만. 첨부 저장소 경로를 돌려준다(앱이 지움)
create or replace function public.approval_doc_delete(p_id uuid)
returns text[]
language plpgsql security definer
set search_path = ''
as $$
declare d public.approval_documents := private.approval_doc_mine(p_id, true); v_paths text[];
begin
  if d.status <> 'draft' then raise exception 'INVALID_STATUS'; end if;
  select coalesce(array_agg(path), '{}') into v_paths from public.approval_document_files where document_id = d.id;
  delete from public.approval_documents where id = d.id;
  return v_paths;
end;
$$;

-- 첨부 기록(저장소에 먼저 올린 뒤). 최대 5개
create or replace function public.approval_doc_file_add(p_id uuid, p_path text, p_name text, p_mime text, p_size integer)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare d public.approval_documents := private.approval_doc_mine(p_id, true); v_id uuid;
begin
  if p_path is null or p_path not like d.company_id || '/' || d.member_id || '/' || d.id || '/%'
     or not exists (select 1 from storage.objects o where o.bucket_id = 'approval-files' and o.name = p_path) then
    raise exception 'INVALID_FILE';
  end if;
  if (select count(*) from public.approval_document_files where document_id = d.id) >= 5 then raise exception 'FILE_LIMIT'; end if;
  insert into public.approval_document_files (company_id, member_id, document_id, path, name, mime, size)
  values (d.company_id, d.member_id, d.id, p_path, left(trim(p_name), 200), p_mime, p_size)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.approval_doc_file_remove(p_file uuid)
returns text
language plpgsql security definer
set search_path = ''
as $$
declare v_me public.members := private.require_member(); f public.approval_document_files;
begin
  select * into f from public.approval_document_files where id = p_file and company_id = v_me.company_id and member_id = v_me.id;
  if f.id is null then raise exception 'NOT_FOUND' using errcode = '42501'; end if;
  perform private.approval_doc_mine(f.document_id, true);
  delete from public.approval_document_files where id = f.id;
  return f.path;
end;
$$;

-- 필수 칸이 비었나(양식 칸 중 직원 입력 + 필수). 빈 글·빈 목록·없음 = 비었음
create or replace function private.approval_doc_missing(d public.approval_documents)
returns text[]
language sql stable security definer
set search_path = ''
as $$
  select coalesce(array_agg(x->>'label' order by ord), '{}')
  from public.company_forms f, jsonb_array_elements(f.fields) with ordinality as t(x, ord)
  where f.id = d.form_id
    and x->'b'->>'k' = 'input' and coalesce((x->'b'->>'required')::boolean, false)
    and (d.payload -> (x->>'key') is null
      or (jsonb_typeof(d.payload -> (x->>'key')) = 'string' and trim(d.payload ->> (x->>'key')) = '')
      or (jsonb_typeof(d.payload -> (x->>'key')) = 'array' and jsonb_array_length(d.payload -> (x->>'key')) = 0)
      or jsonb_typeof(d.payload -> (x->>'key')) = 'null')
$$;

-- 올리기(처음·반려 뒤 다시): 결재라인을 복사해 단계를 만든다
create or replace function public.approval_doc_submit(p_id uuid)
returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  v_me public.members := private.require_member();
  d public.approval_documents := private.approval_doc_mine(p_id, true);
  v_missing text[];
  v_line uuid;
  v_round integer := d.current_round + 1;
  v_order integer := 0;
  v_own integer;
  st record;
begin
  v_missing := private.approval_doc_missing(d);
  if array_length(v_missing, 1) > 0 then raise exception 'REQUIRED_MISSING' using detail = array_to_string(v_missing, ', '); end if;

  -- 대표 본인 문서: 바로 본인 승인
  if v_me.role = 'super_admin' then
    insert into public.approval_document_steps (document_id, company_id, round, step_order, step_kind, approver_member_id, status, acted_by_member_id, acted_by_name, acted_at)
    values (d.id, d.company_id, v_round, 1, 'final', null, 'skipped', v_me.id, v_me.name, now());
    update public.approval_documents set status = 'approved', self_approved = true, current_round = v_round, submitted_at = now(), decided_at = now(),
      rejection_reason = null, updated_at = now() where id = d.id;
    return 'approved';
  end if;

  -- 결재라인: 부서별 → 회사 기본 (지출결의서와 같음, D-039)
  select id into v_line from public.approval_lines where company_id = v_me.company_id and department_id = v_me.department_id;
  if v_line is null then select id into v_line from public.approval_lines where company_id = v_me.company_id and department_id is null; end if;
  if v_line is not null then
    for st in
      select s.step_order, s.approver_member_id, m.status as approver_status
        from public.approval_line_steps s
        join public.members m on m.id = s.approver_member_id and m.company_id = s.company_id
       where s.approval_line_id = v_line and s.company_id = v_me.company_id
       order by s.step_order
    loop
      if st.approver_status <> 'approved' then raise exception 'INACTIVE_REVIEWER'; end if;
      v_order := v_order + 1;
      insert into public.approval_document_steps (document_id, company_id, round, step_order, step_kind, approver_member_id, status)
      values (d.id, d.company_id, v_round, v_order, 'review', st.approver_member_id, 'waiting');
      if st.approver_member_id = v_me.id then v_own := v_order; end if;
    end loop;
  end if;
  v_order := v_order + 1;
  insert into public.approval_document_steps (document_id, company_id, round, step_order, step_kind, approver_member_id, status)
  values (d.id, d.company_id, v_round, v_order, 'final', null, 'waiting');
  if v_own is not null then
    update public.approval_document_steps set status = 'skipped' where document_id = d.id and round = v_round and step_order <= v_own;
  end if;
  update public.approval_document_steps set status = 'pending'
   where id = (select id from public.approval_document_steps where document_id = d.id and round = v_round and status = 'waiting' order by step_order limit 1);
  update public.approval_documents set status = 'submitted', current_round = v_round, submitted_at = now(), decided_at = null,
    rejection_reason = null, self_approved = false, updated_at = now()
   where id = d.id returning * into d;
  if private.approval_doc_notify_turn(d) then perform private.attendance_push_now(); end if;
  return 'submitted';
end;
$$;

-- 회수: 첫 결재자가 처리하기 전까지만 → 작성 중
create or replace function public.approval_doc_recall(p_id uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare d public.approval_documents := private.approval_doc_mine(p_id, false);
begin
  if d.status <> 'submitted' then raise exception 'INVALID_STATUS'; end if;
  if exists (select 1 from public.approval_document_steps where document_id = d.id and round = d.current_round and status in ('approved', 'rejected')) then
    raise exception 'ALREADY_PROCESSED';
  end if;
  update public.approval_document_steps set status = 'canceled' where document_id = d.id and round = d.current_round and status in ('waiting', 'pending');
  update public.approval_documents set status = 'draft', submitted_at = null, updated_at = now() where id = d.id;
end;
$$;

-- 지금 차례 단계를 잠그고 내가 처리할 수 있는지 확인
create or replace function private.approval_doc_lock_turn(p_id uuid, out o_doc public.approval_documents, out o_step public.approval_document_steps, out o_me public.members)
language plpgsql security definer
set search_path = ''
as $$
declare v_me public.members := private.require_member(); d public.approval_documents; s public.approval_document_steps;
begin
  select * into d from public.approval_documents where id = p_id and company_id = v_me.company_id for update;
  if d.id is null then raise exception 'NOT_FOUND' using errcode = '42501'; end if;
  if d.status <> 'submitted' then raise exception 'ALREADY_PROCESSED'; end if;
  select * into s from public.approval_document_steps where document_id = d.id and round = d.current_round and status = 'pending' for update;
  if s.id is null then raise exception 'ALREADY_PROCESSED'; end if;
  if s.step_kind = 'review' then
    if s.approver_member_id <> v_me.id then raise exception 'NOT_ALLOWED' using errcode = '42501'; end if;
  elsif v_me.role not in ('super_admin', 'admin') or d.member_id = v_me.id then
    raise exception 'NOT_ALLOWED' using errcode = '42501';
  end if;
  o_doc := d; o_step := s; o_me := v_me;
end;
$$;

create or replace function public.approval_doc_approve(p_id uuid, p_comment text default null)
returns text
language plpgsql security definer
set search_path = ''
as $$
declare lt record; d public.approval_documents; s public.approval_document_steps; v_me public.members; v_next uuid;
begin
  select * into lt from private.approval_doc_lock_turn(p_id);
  d := lt.o_doc; s := lt.o_step; v_me := lt.o_me;
  update public.approval_document_steps set status = 'approved', acted_by_member_id = v_me.id, acted_by_name = v_me.name, acted_at = now(),
    comment = nullif(left(trim(coalesce(p_comment, '')), 300), '')
   where id = s.id;
  select id into v_next from public.approval_document_steps where document_id = d.id and round = d.current_round and status = 'waiting' order by step_order limit 1;
  if v_next is not null then
    update public.approval_document_steps set status = 'pending' where id = v_next;
    update public.approval_documents set updated_at = now() where id = d.id;
    if private.approval_doc_notify_turn(d) then perform private.attendance_push_now(); end if;
    return 'submitted';
  end if;
  update public.approval_documents set status = 'approved', decided_at = now(), updated_at = now() where id = d.id;
  if private.approval_doc_notify(d, d.member_id, '결재 문서가 승인됐어요', '/workspace/' || d.company_id || '/employee/docs/' || d.id) then
    perform private.attendance_push_now();
  end if;
  return 'approved';
end;
$$;

create or replace function public.approval_doc_reject(p_id uuid, p_reason text)
returns text
language plpgsql security definer
set search_path = ''
as $$
declare lt record; d public.approval_documents; s public.approval_document_steps; v_me public.members; v_reason text := trim(coalesce(p_reason, ''));
begin
  if char_length(v_reason) not between 1 and 300 then raise exception 'REASON_REQUIRED'; end if;
  select * into lt from private.approval_doc_lock_turn(p_id);
  d := lt.o_doc; s := lt.o_step; v_me := lt.o_me;
  update public.approval_document_steps set status = 'rejected', acted_by_member_id = v_me.id, acted_by_name = v_me.name, acted_at = now(), comment = v_reason
   where id = s.id;
  update public.approval_document_steps set status = 'canceled' where document_id = d.id and round = d.current_round and status = 'waiting';
  update public.approval_documents set status = 'rejected', rejection_reason = v_reason, decided_at = now(), updated_at = now() where id = d.id;
  if private.approval_doc_notify(d, d.member_id, '결재 문서가 반려됐어요' || chr(10) || '사유: ' || v_reason, '/workspace/' || d.company_id || '/employee/docs/' || d.id) then
    perform private.attendance_push_now();
  end if;
  return 'rejected';
end;
$$;

revoke all on function private.approval_doc_mine(uuid, boolean), private.approval_doc_notify(public.approval_documents, uuid, text, text),
  private.approval_doc_notify_turn(public.approval_documents), private.approval_doc_missing(public.approval_documents), private.approval_doc_lock_turn(uuid)
  from public, anon, authenticated;
revoke all on function public.approval_doc_create(uuid), public.approval_doc_save(uuid, text, jsonb), public.approval_doc_delete(uuid),
  public.approval_doc_file_add(uuid, text, text, text, integer), public.approval_doc_file_remove(uuid), public.approval_doc_submit(uuid),
  public.approval_doc_recall(uuid), public.approval_doc_approve(uuid, text), public.approval_doc_reject(uuid, text)
  from public, anon;
grant execute on function public.approval_doc_create(uuid), public.approval_doc_save(uuid, text, jsonb), public.approval_doc_delete(uuid),
  public.approval_doc_file_add(uuid, text, text, text, integer), public.approval_doc_file_remove(uuid), public.approval_doc_submit(uuid),
  public.approval_doc_recall(uuid), public.approval_doc_approve(uuid, text), public.approval_doc_reject(uuid, text)
  to authenticated;
