-- 161: 결재 문서 종류(9-33d, D-279 · spec/features/company-forms.md §G-2)
-- 일반 결재 문서(kind general)에 종류(품의서·구매요청서 …)를 남긴다. 종류별 표준 칸 목록은 앱(src/lib/company-forms/doc-types.ts)에 있고,
-- 칸(fields)의 직원 입력에 표준 칸 키(std)가 붙는다. AI 읽기 결과 저장·초안 저장·고치기(초안 복사)가 종류를 함께 다룬다

alter table public.company_forms
  add column doc_type text check (doc_type is null or doc_type in ('pumui', 'purchase', 'trip', 'outside', 'remote', 'early', 'incident', 'resign', 'absence', 'other')),
  add constraint company_forms_doc_type_general check (doc_type is null or kind is null or kind = 'general');
update public.company_forms set doc_type = 'other' where kind = 'general' and doc_type is null;

-- AI가 읽은 결과 저장(읽은 횟수 +1) + 종류(결재 문서만, 없으면 기타)
drop function public.company_form_read_done(uuid, text, jsonb, jsonb);
create function public.company_form_read_done(p_id uuid, p_name text, p_sheets jsonb, p_fields jsonb, p_doc_type text default null)
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
         doc_type = case when kind = 'general' then coalesce(p_doc_type, doc_type, 'other') else null end,
         -- 새 양식만 AI가 읽은 제목으로 이름(새 버전은 원래 이름 그대로)
         name = case when not exists (select 1 from public.company_forms a where a.group_id = company_forms.group_id and a.status = 'active')
                     then left(coalesce(nullif(trim(p_name), ''), name), 60) else name end
   where id = p_id and company_id = v_admin.company_id and status = 'draft' and reads < 3;
  if not found then raise exception 'READS_USED'; end if;
end;
$$;

-- 고친 표·칸·이름(·종류) 저장(초안). 종류를 안 넘기면 그대로
drop function public.company_form_save(uuid, text, jsonb, jsonb);
create function public.company_form_save(p_id uuid, p_name text, p_sheets jsonb, p_fields jsonb, p_doc_type text default null)
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
  update public.company_forms set sheets = p_sheets, fields = p_fields, name = trim(p_name), updated_at = now(),
         doc_type = case when kind = 'general' then coalesce(p_doc_type, doc_type, 'other') else null end
   where id = p_id and company_id = v_admin.company_id and status = 'draft';
  if not found then raise exception 'NOT_FOUND'; end if;
end;
$$;

-- 고치기: 지금 쓰는 버전을 초안으로 복사(종류 포함). AI 읽기 없음
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
  insert into public.company_forms (id, company_id, group_id, kind, doc_type, name, sheets, fields, source_path, mime, source_name, reads, created_by, created_by_name)
  values (v_id, v_admin.company_id, p_group, v_active.kind, v_active.doc_type, v_active.name, v_active.sheets, v_active.fields, v_active.source_path,
    v_active.mime, v_active.source_name, 3, v_admin.id, v_admin.name); -- 같은 파일이라 AI 다시 읽기는 없음
  return v_id;
end;
$$;

revoke all on function public.company_form_read_done(uuid, text, jsonb, jsonb, text), public.company_form_save(uuid, text, jsonb, jsonb, text) from public, anon;
grant execute on function public.company_form_read_done(uuid, text, jsonb, jsonb, text), public.company_form_save(uuid, text, jsonb, jsonb, text) to authenticated;

-- 읽기 시작: 종류를 바꾸면(결재 문서 → 근태 양식) 결재 문서 종류는 비운다
create or replace function public.company_form_read_begin(p_id uuid, p_kind text)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_admin public.members := private.require_admin();
  v_row public.company_forms;
  v_one public.company_forms;
  v_old public.company_forms;
  v_removed text;
  v_new boolean;
begin
  if p_kind not in ('leave', 'correction', 'holiday', 'general') then raise exception 'INVALID_KIND'; end if;
  select * into v_row from public.company_forms where id = p_id and company_id = v_admin.company_id and status = 'draft' for update;
  if v_row.id is null then raise exception 'NOT_FOUND'; end if;
  if v_row.reads >= 3 then raise exception 'READS_USED'; end if;
  v_new := not exists (select 1 from public.company_forms where group_id = v_row.group_id and status = 'active');
  if v_new and p_kind in ('leave', 'correction', 'holiday') then
    select * into v_one from public.company_forms where company_id = v_admin.company_id and status = 'active' and kind = p_kind;
    if v_one.id is not null then
      -- 근태 양식은 종류마다 하나: 이미 있는 양식의 새 버전으로 옮긴다(무료)
      select * into v_old from public.company_forms where group_id = v_one.group_id and status = 'draft';
      if v_old.id is not null then
        delete from public.company_forms where id = v_old.id;
        v_removed := private.form_orphan_path(v_old.source_path, v_old.id);
      end if;
      update public.company_forms set group_id = v_one.group_id, name = v_one.name where id = p_id;
      v_new := false;
    end if;
  end if;
  if not v_new and p_kind <> coalesce((select kind from public.company_forms where group_id = (select group_id from public.company_forms where id = p_id) and status = 'active'), p_kind) then
    raise exception 'KIND_MISMATCH';
  end if;
  if v_new and private.form_slot_used(v_admin.company_id) >= private.form_slot_limit(v_admin.company_id) then
    raise exception 'SLOTS_FULL';
  end if;
  update public.company_forms set kind = p_kind, doc_type = case when p_kind = 'general' then doc_type end, updated_at = now() where id = p_id;
  return jsonb_build_object('path', v_row.source_path, 'mime', v_row.mime, 'removed', v_removed);
end;
$$;
