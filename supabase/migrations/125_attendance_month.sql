-- =============================================================================
-- 125_attendance_month.sql — 근태 ④ 월 근태 현황 (D-237, spec/features/attendance.md §5)
-- 본인 기록만 한 달치 + 근무 요일·공휴일·"기록 없음"을 세기 시작하는 날(근태 켠 날과 가입 승인일 중 늦은 날)
-- =============================================================================
create or replace function public.my_attendance_month(p_month text)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_member uuid := private.current_member_id();
  v_company uuid := private.current_company_id();
  v_start date;
  v_end date;
  v_enabled_since date;
  v_approved date;
  s public.attendance_settings;
begin
  if v_member is null or v_company is null then raise exception 'NOT_ALLOWED' using errcode = '42501'; end if;
  if not private.feature_enabled(v_company, 'attendance') then raise exception 'FEATURE_DISABLED'; end if;
  if p_month !~ '^\d{4}-(0[1-9]|1[0-2])$' then raise exception 'INVALID'; end if;
  v_start := (p_month || '-01')::date;
  v_end := (v_start + interval '1 month')::date;
  s := private.attendance_settings_row(v_company);

  -- 근태를 처음 켠 날(이력), 없으면 첫 기록 날
  select min((h.at at time zone 'Asia/Seoul')::date) into v_enabled_since
  from public.attendance_history h
  where h.company_id = v_company and h.action = 'enabled' and h.changes -> 0 ->> 'to' = '켜짐';
  if v_enabled_since is null then
    select min(d.work_date) into v_enabled_since from public.attendance_days d where d.company_id = v_company;
  end if;
  select (coalesce(m.approved_at, m.created_at) at time zone 'Asia/Seoul')::date into v_approved from public.members m where m.id = v_member;

  return jsonb_build_object(
    'month', p_month,
    'today', (now() at time zone 'Asia/Seoul')::date,
    'since', greatest(coalesce(v_enabled_since, (now() at time zone 'Asia/Seoul')::date), coalesce(v_approved, v_start)),
    'work_days', to_jsonb(s.work_days),
    'holidays', coalesce((select jsonb_agg(jsonb_build_object('day', h.day, 'name', h.name) order by h.day) from public.kr_holidays h where h.day >= v_start and h.day < v_end), '[]'::jsonb),
    'days', coalesce((
      select jsonb_agg(jsonb_build_object(
        'work_date', d.work_date, 'in_at', d.in_at, 'out_at', d.out_at, 'out_method', d.out_method, 'holiday', d.holiday,
        'sched_end', to_char(d.sched_end, 'HH24:MI'),
        'in_terminal', (select t.name from public.attendance_terminals t where t.id = d.in_terminal_id),
        'out_terminal', (select t.name from public.attendance_terminals t where t.id = d.out_terminal_id)) order by d.work_date desc)
      from public.attendance_days d
      where d.member_id = v_member and d.company_id = v_company and d.work_date >= v_start and d.work_date < v_end), '[]'::jsonb));
end;
$$;
revoke all on function public.my_attendance_month(text) from public, anon;
grant execute on function public.my_attendance_month(text) to authenticated;
