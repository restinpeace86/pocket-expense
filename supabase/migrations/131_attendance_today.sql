-- =============================================================================
-- 131_attendance_today.sql — 근태 ⑧ 오늘 출근 현황 (D-242, spec/features/attendance.md §9)
-- - attendance_day_admin(날짜): 관리자만. 그날 멤버 전원 · 기록 · 승인된 휴가(종류까지) · 근무일 여부. 지각·조퇴 판단은 하지 않는다
-- - attendance_member_month(멤버, 달): 관리자가 보는 직원 월 근태(읽기 전용) — 직원 my_attendance_month와 같은 모양
--   두 함수가 같은 본문을 쓰도록 private.attendance_month_json으로 묶는다
-- =============================================================================

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
        'decided_at', r.decided_at, 'reject_reason', r.reject_reason, 'created_at', r.created_at) order by r.created_at)
      from public.attendance_requests r
      where r.member_id = p_member and r.company_id = p_company and r.work_date >= v_start and r.work_date < v_end and r.status <> 'canceled'), '[]'::jsonb),
    'leaves', coalesce((
      select jsonb_agg(jsonb_build_object('id', l.id, 'type_name', l.type_name, 'unit', l.unit, 'start_date', l.start_date, 'end_date', l.end_date,
        'start_time', to_char(l.start_time, 'HH24:MI'), 'hours', l.hours) order by l.start_date)
      from public.attendance_leaves l
      where l.member_id = p_member and l.company_id = p_company and l.status = 'approved' and l.start_date < v_end and l.end_date >= v_start), '[]'::jsonb));
end;
$$;

-- 직원 본인(130과 같은 결과)
create or replace function public.my_attendance_month(p_month text)
returns jsonb
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_member uuid := private.current_member_id();
  v_company uuid := private.current_company_id();
begin
  if v_member is null or v_company is null then raise exception 'NOT_ALLOWED' using errcode = '42501'; end if;
  if not private.feature_enabled(v_company, 'attendance') then raise exception 'FEATURE_DISABLED'; end if;
  return private.attendance_month_json(v_company, v_member, p_month);
end;
$$;

-- 관리자: 직원 월 근태(읽기 전용)
create or replace function public.attendance_member_month(p_member uuid, p_month text)
returns jsonb
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_me public.members := private.require_admin();
  m public.members;
begin
  if not private.feature_enabled(v_me.company_id, 'attendance') then raise exception 'FEATURE_DISABLED'; end if;
  select * into m from public.members where id = p_member and company_id = v_me.company_id;
  if not found then raise exception 'NOT_FOUND'; end if;
  return private.attendance_month_json(v_me.company_id, m.id, p_month)
    || jsonb_build_object('member', jsonb_build_object('id', m.id, 'name', m.name, 'role', m.role,
         'department', (select d.name from public.departments d where d.id = m.department_id)));
end;
$$;

-- 관리자: 그날 현황
create or replace function public.attendance_day_admin(p_date date)
returns jsonb
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_me public.members := private.require_admin();
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  s public.attendance_settings;
begin
  if not private.feature_enabled(v_me.company_id, 'attendance') then raise exception 'FEATURE_DISABLED'; end if;
  if p_date is null or p_date < v_today - 100 or p_date > v_today + 40 then raise exception 'OUT_OF_RANGE'; end if;
  s := private.attendance_settings_row(v_me.company_id);
  return jsonb_build_object(
    'date', p_date,
    'today', v_today,
    'now', now(),
    'work_start', to_char(s.work_start, 'HH24:MI'),
    'work_end', to_char(s.work_end, 'HH24:MI'),
    'workday', extract(isodow from p_date)::smallint = any (s.work_days) and not exists (select 1 from public.kr_holidays h where h.day = p_date),
    'holiday_name', (select h.name from public.kr_holidays h where h.day = p_date),
    'enabled_since', private.attendance_enabled_since(v_me.company_id),
    'members', coalesce((
      select jsonb_agg(jsonb_build_object('id', m.id, 'name', m.name, 'role', m.role,
        'department', (select d.name from public.departments d where d.id = m.department_id),
        'since', private.attendance_since(v_me.company_id, m.id)) order by (m.role = 'super_admin') desc, m.name)
      from public.members m where m.company_id = v_me.company_id and m.status = 'approved'), '[]'::jsonb),
    'days', coalesce((
      select jsonb_agg(jsonb_build_object('member_id', d.member_id, 'in_at', d.in_at, 'out_at', d.out_at, 'out_method', d.out_method, 'holiday', d.holiday,
        'holiday_approved', d.holiday_approved_at is not null,
        'in_terminal', (select t.name from public.attendance_terminals t where t.id = d.in_terminal_id),
        'out_terminal', (select t.name from public.attendance_terminals t where t.id = d.out_terminal_id)))
      from public.attendance_days d where d.company_id = v_me.company_id and d.work_date = p_date), '[]'::jsonb),
    'leaves', coalesce((
      select jsonb_agg(jsonb_build_object('member_id', l.member_id, 'type_name', l.type_name, 'unit', l.unit, 'start_time', to_char(l.start_time, 'HH24:MI'), 'hours', l.hours))
      from public.attendance_leaves l where l.company_id = v_me.company_id and l.status = 'approved' and l.start_date <= p_date and l.end_date >= p_date), '[]'::jsonb));
end;
$$;

revoke all on function private.attendance_month_json(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.my_attendance_month(text), public.attendance_member_month(uuid, text), public.attendance_day_admin(date) from public, anon;
grant execute on function public.my_attendance_month(text), public.attendance_member_month(uuid, text), public.attendance_day_admin(date) to authenticated;
