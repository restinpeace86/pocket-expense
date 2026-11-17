-- 165: 회사 양식 칸 = 결재 문서만 센다 + 플랜별 칸 수(D-289, 9-33f, D-279 §G-4 · 사용자 2026-11-14 "29,000원은 지출결의서 외엔 없고, 49,000원은 3개, 89,000원은 5개")
-- 스타터 = 지출결의서만(회사 양식 없음) / 프로 = 근태 양식(휴가·정정·휴일근무) + 결재 문서 3개 / 비즈니스 = 근태 양식 + 결재 문서 5개
-- 근태 양식은 칸 수에 안 센다(종류마다 하나는 그대로). 결제 연동 전에는 지금처럼 모든 회사 = 프로(private.effective_plan)
-- 이미 칸보다 많이 등록한 회사는 그대로 쓰고(지우지 않음), 새 결재 문서만 막는다
update public.billing_plans set
  form_slots = case code when 'starter' then 0 when 'standard' then 3 when 'pro' then 5 end,
  form_slots_unlimited = false,
  updated_at = now()
where code in ('starter', 'standard', 'pro');

-- 쓰는 칸 = 지금 쓰는(등록된) 결재 문서 묶음 수
create or replace function private.form_slot_used(p_company uuid)
returns integer
language sql stable security definer
set search_path = ''
as $$
  select count(distinct group_id)::integer from public.company_forms where company_id = p_company and status = 'active' and kind = 'general'
$$;

-- 새 양식을 못 올리나: 칸이 0(스타터)이면 회사 양식 전부, 아니면 결재 문서만 칸 수까지
create or replace function private.form_slot_blocked(p_company uuid, p_kind text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select case when private.form_slot_limit(p_company) <= 0 then true
              when p_kind = 'general' then private.form_slot_used(p_company) >= private.form_slot_limit(p_company)
              else false end
$$;
revoke all on function private.form_slot_used(uuid), private.form_slot_blocked(uuid, text) from public, anon, authenticated;

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
  if v_new and private.form_slot_blocked(v_admin.company_id, p_kind) then
    raise exception 'SLOTS_FULL';
  end if;
  update public.company_forms set kind = p_kind, doc_type = case when p_kind = 'general' then doc_type end, updated_at = now() where id = p_id;
  return jsonb_build_object('path', v_row.source_path, 'mime', v_row.mime, 'removed', v_removed);
end;
$$;

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
  if v_inputs > (case when v_row.kind in ('leave', 'correction', 'holiday') then 5 else 15 end) then raise exception 'TOO_MANY_INPUTS'; end if;
  -- 같은 회사 양식을 동시에 등록할 때 칸 수가 넘지 않게 회사 줄을 잠근다
  perform 1 from public.companies where id = v_admin.company_id for update;
  v_new := not exists (select 1 from public.company_forms where group_id = v_row.group_id and status = 'active');
  if v_new and private.form_slot_blocked(v_admin.company_id, v_row.kind) then
    raise exception 'SLOTS_FULL';
  end if;
  if v_new and v_row.kind in ('leave', 'correction', 'holiday')
     and exists (select 1 from public.company_forms where company_id = v_admin.company_id and status = 'active' and kind = v_row.kind) then
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
