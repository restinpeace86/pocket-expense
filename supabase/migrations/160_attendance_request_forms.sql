-- 160: 근태 정정 신청서 · 휴일·연장근무 신청서를 회사 양식으로 (9-33c, D-279 · spec/features/company-forms.md §G-1)
-- 휴가신청서(147)와 같은 방식: 직원은 지금 신청 화면 그대로, 회사 양식은 결재 끝난 문서의 모양 + [회사 추가 항목](직원 입력 최대 5칸)
-- company_forms.kind 에 correction·holiday 추가(근태 양식은 회사에 종류마다 하나), 정정·휴일 근무 신청 줄에 쓴 양식 버전·추가 항목 값

-- ── 양식 종류 ──────────────────────────────────────────────────────────────
alter table public.company_forms drop constraint if exists company_forms_kind_check;
alter table public.company_forms add constraint company_forms_kind_check check (kind in ('leave', 'correction', 'holiday', 'general'));
create unique index company_forms_one_attendance on public.company_forms (company_id, kind) where status = 'active' and kind in ('correction', 'holiday');

-- ── 신청 줄: 쓴 양식 버전 + 추가 항목 값 ─────────────────────────────────────
alter table public.attendance_requests
  add column form_id uuid,
  add column custom_payload jsonb not null default '{}'::jsonb check (jsonb_typeof(custom_payload) = 'object'),
  add constraint attendance_requests_form_fk foreign key (form_id, company_id) references public.company_forms (id, company_id);

-- 처리된 신청은 고치거나 지울 수 없다(양식·추가 항목 포함). 대기 → 처리 한 번만
create or replace function private.attendance_requests_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if not exists (select 1 from public.companies c where c.id = old.company_id)
       or not exists (select 1 from public.members m where m.id = old.member_id) then return old; end if;
    raise exception 'HISTORY_LOCKED' using errcode = '42501';
  end if;
  if old.status <> 'pending' or new.status = 'pending'
     or (new.id, new.company_id, new.member_id, new.member_name, new.member_role, new.work_date, new.kind, new.new_in, new.new_out, new.reason, new.before, new.created_at, new.form_id, new.custom_payload)
        is distinct from (old.id, old.company_id, old.member_id, old.member_name, old.member_role, old.work_date, old.kind, old.new_in, old.new_out, old.reason, old.before, old.created_at, old.form_id, old.custom_payload) then
    raise exception 'HISTORY_LOCKED' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- ── 신청: 회사 양식(정정·휴일근무)이 있으면 직원 입력 칸 값 확인 → custom_payload + 양식 버전 ──
drop function public.attendance_request_create(date, text, text, text, text);
create function public.attendance_request_create(p_date date, p_kind text, p_in text, p_out text, p_reason text, p_custom jsonb default '{}'::jsonb)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_me public.members := private.require_member();
  v_now timestamptz := now();
  v_today date := (v_now at time zone 'Asia/Seoul')::date;
  v_reason text := btrim(coalesce(p_reason, ''));
  s public.attendance_settings;
  d public.attendance_days;
  v_found boolean;
  r public.attendance_requests;
  v_title text;
  v_sent boolean := false;
  a record;
  v_form public.company_forms;
  v_custom jsonb := '{}'::jsonb;
begin
  if not private.feature_enabled(v_me.company_id, 'attendance') then raise exception 'FEATURE_DISABLED'; end if;
  if p_kind not in ('correction', 'holiday') or p_date is null then raise exception 'INVALID'; end if;
  -- 이번 달 기록만(오늘까지), 근태 켠 날·가입 승인일 이후
  if p_date > v_today or p_date < date_trunc('month', v_today)::date or p_date < private.attendance_since(v_me.company_id, v_me.id) then
    raise exception 'OUT_OF_RANGE';
  end if;
  if coalesce(p_in, '') !~ '^([01]\d|2[0-3]):[0-5]\d$' or coalesce(p_out, '') !~ '^([01]\d|2[0-3]):[0-5]\d$' then raise exception 'INVALID_TIME'; end if;
  if p_in::time >= p_out::time then raise exception 'INVALID_TIME'; end if;
  if p_date = v_today and (p_date + p_out::time) > (v_now at time zone 'Asia/Seoul') then raise exception 'FUTURE_TIME'; end if;
  if char_length(v_reason) < 1 then raise exception 'REASON_REQUIRED'; end if;
  if char_length(v_reason) > 200 then raise exception 'INVALID'; end if;
  s := private.attendance_settings_row(v_me.company_id);

  select * into d from public.attendance_days where member_id = v_me.id and work_date = p_date for update;
  v_found := found;
  if p_kind = 'holiday' then
    if not v_found or not d.holiday then raise exception 'NOT_HOLIDAY'; end if;
    if d.out_at is null then raise exception 'NOT_DONE'; end if;
    if d.holiday_approved_at is not null then raise exception 'ALREADY_APPROVED'; end if;
  else
    if not v_found then
      -- QR 기록 없는 휴일은 정정으로도 넣을 수 없다(D-239)
      if private.attendance_is_holiday(v_me.company_id, p_date, s.work_days) then raise exception 'NO_RECORD_HOLIDAY'; end if;
    elsif private.attendance_hm(d.in_at) = p_in and d.out_at is not null and private.attendance_hm(d.out_at) = p_out then
      raise exception 'NO_CHANGE';
    end if;
  end if;
  if exists (select 1 from public.attendance_requests q where q.member_id = v_me.id and q.work_date = p_date and q.status = 'pending') then
    raise exception 'PENDING_EXISTS';
  end if;
  -- 회사 양식(9-33c): 직원 입력 칸 값 확인 → custom_payload + 쓴 양식 버전
  select * into v_form from public.company_forms where company_id = v_me.company_id and kind = p_kind and status = 'active';
  if found then v_custom := private.form_custom_clean(v_form, coalesce(p_custom, '{}'::jsonb), v_me.company_id); end if;

  insert into public.attendance_requests (company_id, member_id, member_name, member_role, work_date, kind, new_in, new_out, reason, before, form_id, custom_payload)
  values (v_me.company_id, v_me.id, v_me.name, v_me.role, p_date, p_kind, p_in::time, p_out::time, v_reason,
    case when v_found then jsonb_build_object('in_at', d.in_at, 'out_at', d.out_at, 'in_method', d.in_method, 'out_method', d.out_method) else '{}'::jsonb end,
    v_form.id, v_custom)
  returning * into r;

  -- 대표 본인 신청은 바로 본인 승인(D-026과 같은 방식)
  if v_me.role = 'super_admin' then
    perform private.attendance_request_apply(r);
    update public.attendance_requests set status = 'approved', self_approved = true, decided_by = v_me.id, decided_by_name = v_me.name, decided_at = now()
    where id = r.id returning * into r;
    return jsonb_build_object('id', r.id, 'status', r.status, 'self_approved', true);
  end if;

  -- 건마다 승인할 수 있는 관리자 각자에게
  v_title := case when p_kind = 'holiday' then '휴일 근무 상신이 왔어요' else '근태 정정 신청이 왔어요' end;
  for a in
    select m.id from public.members m
    where m.company_id = v_me.company_id and m.status = 'approved' and m.id <> v_me.id
      and (m.role = 'super_admin' or (m.role = 'admin' and v_me.role = 'employee'))
  loop
    v_sent := private.attendance_notify(v_me.company_id, a.id,
      v_title || chr(10) || '이름: ' || v_me.name || chr(10) || '날짜: ' || private.attendance_date_label(p_date)
        || private.attendance_request_lines(r) || chr(10) || case when p_kind = 'holiday' then '한 일: ' else '사유: ' end || v_reason,
      '/workspace/' || v_me.company_id || '/admin/attendance') or v_sent;
  end loop;
  if v_sent then perform private.attendance_push_now(); end if;
  return jsonb_build_object('id', r.id, 'status', r.status, 'self_approved', false);
end;
$$;
revoke all on function public.attendance_request_create(date, text, text, text, text, jsonb) from public, anon;
grant execute on function public.attendance_request_create(date, text, text, text, text, jsonb) to authenticated;

-- ── 화면용 JSON: 양식으로 낸 신청이면 form_id(받기 버튼) ───────────────────────
create or replace function private.attendance_request_json(r public.attendance_requests, p_me public.members)
returns jsonb
language sql stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', r.id, 'member_name', r.member_name, 'member_role', r.member_role, 'work_date', r.work_date, 'kind', r.kind,
    'new_in', to_char(r.new_in, 'HH24:MI'), 'new_out', to_char(r.new_out, 'HH24:MI'), 'reason', r.reason, 'before', r.before,
    'status', r.status, 'self_approved', r.self_approved, 'decided_by_name', r.decided_by_name, 'decided_at', r.decided_at,
    'reject_reason', r.reject_reason, 'created_at', r.created_at, 'mine', r.member_id = p_me.id,
    'can_decide', r.status = 'pending' and private.attendance_can_decide(r, p_me), 'form_id', r.form_id)
$$;

create or replace function private.attendance_month_json(p_company uuid, p_member uuid, p_month text)
returns jsonb
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_start date;
  v_end date;
  v_since date;
  s public.attendance_settings;
begin
  if p_month !~ '^\d{4}-(0[1-9]|1[0-2])$' then raise exception 'INVALID'; end if;
  v_start := (p_month || '-01')::date;
  v_end := (v_start + interval '1 month')::date;
  s := private.attendance_settings_row(p_company);
  v_since := private.attendance_since(p_company, p_member);
  return jsonb_build_object(
    'month', p_month,
    'today', v_today,
    'since', v_since,
    'request_from', greatest(date_trunc('month', v_today)::date, v_since),
    'work_days', to_jsonb(s.work_days),
    'daily_hours', s.daily_hours,
    'holidays', coalesce((select jsonb_agg(jsonb_build_object('day', h.day, 'name', h.name) order by h.day) from public.kr_holidays h where h.day >= v_start and h.day < v_end), '[]'::jsonb),
    'days', coalesce((
      select jsonb_agg(jsonb_build_object(
        'work_date', d.work_date, 'in_at', d.in_at, 'out_at', d.out_at, 'in_method', d.in_method, 'out_method', d.out_method, 'holiday', d.holiday,
        'holiday_approved', d.holiday_approved_at is not null,
        'sched_end', to_char(d.sched_end, 'HH24:MI'),
        'in_terminal', (select t.name from public.attendance_terminals t where t.id = d.in_terminal_id),
        'out_terminal', (select t.name from public.attendance_terminals t where t.id = d.out_terminal_id)) order by d.work_date desc)
      from public.attendance_days d
      where d.member_id = p_member and d.company_id = p_company and d.work_date >= v_start and d.work_date < v_end), '[]'::jsonb),
    'requests', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'work_date', r.work_date, 'kind', r.kind, 'new_in', to_char(r.new_in, 'HH24:MI'), 'new_out', to_char(r.new_out, 'HH24:MI'),
        'reason', r.reason, 'before', r.before, 'status', r.status, 'self_approved', r.self_approved, 'decided_by_name', r.decided_by_name,
        'decided_at', r.decided_at, 'reject_reason', r.reject_reason, 'created_at', r.created_at, 'form_id', r.form_id) order by r.created_at)
      from public.attendance_requests r
      where r.member_id = p_member and r.company_id = p_company and r.work_date >= v_start and r.work_date < v_end and r.status <> 'canceled'), '[]'::jsonb),
    'leaves', coalesce((
      select jsonb_agg(jsonb_build_object('id', l.id, 'type_name', l.type_name, 'unit', l.unit, 'start_date', l.start_date, 'end_date', l.end_date,
        'start_time', to_char(l.start_time, 'HH24:MI'), 'hours', l.hours) order by l.start_date)
      from public.attendance_leaves l
      where l.member_id = p_member and l.company_id = p_company and l.status = 'approved' and l.start_date < v_end and l.end_date >= v_start), '[]'::jsonb));
end;
$$;

-- ── 등록: 근태 양식(휴가·정정·휴일근무)은 회사에 종류마다 하나 → 이미 있으면 새 버전으로 ──
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
  update public.company_forms set kind = p_kind, updated_at = now() where id = p_id;
  return jsonb_build_object('path', v_row.source_path, 'mime', v_row.mime, 'removed', v_removed);
end;
$$;

-- 등록: 모든 칸이 정해졌는지, 직원 입력 칸 수(근태 양식 5·일반 15), 근태 양식은 종류마다 하나
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
  if v_new and private.form_slot_used(v_admin.company_id) >= private.form_slot_limit(v_admin.company_id) then
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
