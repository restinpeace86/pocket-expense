-- 148: 휴가 신청할 때 남은 연차를 남긴다(회사 휴가신청서 '남은 연차(신청할 때)' 칸, 8-104 C). 연차를 차감하는 종류만, 이전 신청은 비어 있음
alter table public.attendance_leaves add column remaining_days numeric(6, 3);

create or replace function private.attendance_leaves_guard()
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
  if (new.id, new.company_id, new.member_id, new.type_id, new.type_name, new.deducts, new.unit, new.start_date, new.end_date, new.start_time, new.hours, new.workdays, new.deduct_days, new.reason, new.created_at, new.form_id, new.custom_payload, new.remaining_days)
     is distinct from (old.id, old.company_id, old.member_id, old.type_id, old.type_name, old.deducts, old.unit, old.start_date, old.end_date, old.start_time, old.hours, old.workdays, old.deduct_days, old.reason, old.created_at, old.form_id, old.custom_payload, old.remaining_days)
     or old.status in ('rejected', 'canceled') then
    raise exception 'HISTORY_LOCKED' using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function public.attendance_leave_create(p jsonb)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_me public.members := private.require_member();
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  s public.attendance_settings;
  t public.attendance_leave_types;
  g public.attendance_leave_grants;
  v_unit text := coalesce(p ->> 'unit', 'day');
  v_start date := (p ->> 'start_date')::date;
  v_end date := coalesce((p ->> 'end_date')::date, (p ->> 'start_date')::date);
  v_time time;
  v_hours smallint;
  v_reason text := nullif(btrim(coalesce(p ->> 'reason', '')), '');
  v_work integer;
  v_deduct numeric := 0;
  l public.attendance_leaves;
  v_form public.company_forms;
  v_custom jsonb := '{}'::jsonb;
  v_remain numeric;
begin
  if not private.feature_enabled(v_me.company_id, 'attendance') then raise exception 'FEATURE_DISABLED'; end if;
  s := private.attendance_settings_row(v_me.company_id);
  perform private.attendance_leave_types_ensure(v_me.company_id);
  select * into t from public.attendance_leave_types where id = (p ->> 'type_id')::uuid and company_id = v_me.company_id;
  if not found or not t.enabled then raise exception 'TYPE_OFF'; end if;
  if v_start is null or v_end < v_start or v_end > v_start + 366 then raise exception 'INVALID_DATE'; end if;
  if v_start < date_trunc('month', v_today)::date then raise exception 'OUT_OF_RANGE'; end if;
  if v_reason is not null and char_length(v_reason) > 200 then raise exception 'INVALID'; end if;
  if v_unit = 'hour' then
    if not t.allow_hours or (t.builtin_key = 'annual' and not s.hourly_leave) then raise exception 'HOURS_OFF'; end if;
    if v_end <> v_start or coalesce(p ->> 'start_time', '') !~ '^([01]\d|2[0-3]):[0-5]\d$' then raise exception 'INVALID'; end if;
    v_time := (p ->> 'start_time')::time;
    v_hours := (p ->> 'hours')::smallint;
    if v_hours is null or v_hours < 1 or v_hours >= s.daily_hours or extract(epoch from v_time) / 3600 + v_hours > 24 then raise exception 'INVALID_HOURS'; end if;
  elsif v_unit <> 'day' then raise exception 'INVALID';
  end if;
  v_work := private.attendance_workdays(v_start, v_end, s.work_days);
  if v_work = 0 then raise exception 'NO_WORKDAY'; end if;
  if exists (select 1 from public.attendance_leaves x where x.member_id = v_me.id and x.status in ('pending', 'approved')
             and x.start_date <= v_end and x.end_date >= v_start) then raise exception 'OVERLAP'; end if;
  if t.deducts then
    v_deduct := case when v_unit = 'hour' then round(v_hours::numeric / s.daily_hours, 3) else v_work end;
    select * into g from public.attendance_leave_grants
    where member_id = v_me.id and period_start <= v_start and period_end >= v_start order by period_start desc limit 1;
    if not found then raise exception 'NO_GRANT'; end if;
    if v_end > g.period_end then raise exception 'CROSS_PERIOD'; end if;
    v_remain := g.granted_days - private.attendance_leave_used(v_me.id, g.period_start); -- 신청할 때 남은 연차(휴가신청서 '남은 연차')
    if s.leave_shortage = 'block' and private.attendance_leave_used(v_me.id, g.period_start) + v_deduct > g.granted_days + 0.0001 then raise exception 'NOT_ENOUGH'; end if;
  end if;
  -- 회사 휴가신청서 양식(8-104 C): 직원 입력 칸 값 확인 → custom_payload + 쓴 양식 버전
  select * into v_form from public.company_forms where company_id = v_me.company_id and kind = 'leave' and status = 'active';
  if found then v_custom := private.form_custom_clean(v_form, coalesce(p -> 'custom', '{}'::jsonb), v_me.company_id); end if;
  insert into public.attendance_leaves (company_id, member_id, member_name, member_role, type_id, type_name, deducts, proof, unit, start_date, end_date, start_time, hours,
    workdays, deduct_days, period_start, reason, form_id, custom_payload, remaining_days)
  values (v_me.company_id, v_me.id, v_me.name, v_me.role, t.id, t.name, t.deducts, t.proof, v_unit, v_start, v_end, v_time, v_hours,
    case when v_unit = 'hour' then 0 else v_work end, v_deduct, case when t.deducts then g.period_start end, v_reason, v_form.id, v_custom, v_remain)
  returning * into l;
  if v_me.role = 'super_admin' then
    if private.attendance_leave_self_approve(l.id) then return jsonb_build_object('id', l.id, 'status', 'approved', 'self_approved', true); end if;
  else
    perform private.attendance_leave_notify_approvers(l, '휴가 신청이 왔어요',
      case when l.proof = 'required' then '증빙: 아직 없음(첨부되면 승인할 수 있어요)' end);
  end if;
  return jsonb_build_object('id', l.id, 'status', 'pending', 'self_approved', false);
end;
$$;
