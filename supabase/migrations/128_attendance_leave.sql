-- =============================================================================
-- 128_attendance_leave.sql — 근태 ⑥ 직원별 연차 일수 (D-240, spec/features/attendance.md §7)
-- - 입사일(members.hire_date): 직원이 가입할 때 한 번 입력(그 뒤 본인은 못 바꿈), 관리자는 사유를 적고 고침 → 이력 + 직원 [알림]방
-- - 연차 설정: 시간차 허용 · 비례 연차 소수점(1일 올림 기본 / 0.5일 올림 / 시간 단위) — 버림은 없음
-- - 연차 확정(attendance_leave_grants): 법 기준 추천값(앱 계산)과 회사가 확정한 일수. 법 기준보다 적으면 사유 필수(막지는 않음)
-- - 모든 변경은 attendance_history(고치거나 지울 수 없음)
-- =============================================================================

alter table public.members add column hire_date date check (hire_date is null or hire_date >= date '1950-01-01');

alter table public.attendance_settings add column hourly_leave boolean not null default false;
alter table public.attendance_settings add column leave_rounding text not null default 'day' check (leave_rounding in ('day', 'half', 'hour'));
alter table public.attendance_settings add constraint attendance_settings_rounding_hour check (leave_rounding <> 'hour' or hourly_leave);

alter table public.attendance_history drop constraint attendance_history_action_check;
alter table public.attendance_history add constraint attendance_history_action_check
  check (action in ('enabled', 'settings', 'terminal_add', 'terminal_rename', 'terminal_revoke', 'hire_date', 'leave_grant'));

create table public.attendance_leave_grants (
  company_id uuid not null references public.companies (id) on delete cascade,
  member_id uuid not null,
  period_start date not null,
  period_end date not null,
  recommended_days numeric(6, 3), -- 확정할 때의 법 기준 추천값(대표·5인 미만·입사일 없음이면 null)
  granted_days numeric(6, 3) not null check (granted_days >= 0 and granted_days <= 60),
  reason text check (reason is null or char_length(btrim(reason)) between 1 and 200),
  confirmed_by uuid,
  confirmed_by_name text,
  confirmed_at timestamptz not null default now(),
  primary key (member_id, period_start),
  foreign key (member_id, company_id) references public.members (id, company_id) on delete cascade,
  check (period_end >= period_start)
);
create index attendance_leave_grants_company on public.attendance_leave_grants (company_id, period_start);
alter table public.attendance_leave_grants enable row level security;
alter table public.attendance_leave_grants force row level security;
revoke all on public.attendance_leave_grants from anon, authenticated;
grant select on public.attendance_leave_grants to authenticated;
create policy attendance_leave_grants_select on public.attendance_leave_grants for select to authenticated
  using (company_id = (select private.current_company_id()) and (member_id = (select private.current_member_id()) or (select private.is_admin())));

-- 근태를 처음 켠 날(회사)
create or replace function private.attendance_enabled_since(p_company uuid)
returns date
language sql stable security definer
set search_path = ''
as $$
  select coalesce(
    (select min((h.at at time zone 'Asia/Seoul')::date) from public.attendance_history h
      where h.company_id = p_company and h.action = 'enabled' and h.changes -> 0 ->> 'to' = '켜짐'),
    (select min(d.work_date) from public.attendance_days d where d.company_id = p_company))
$$;

-- ── 직원: 내 입사일(처음 한 번만) ───────────────────────────────────────────
create or replace function public.set_my_hire_date(p_date date)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  m public.members;
begin
  select * into m from public.members
  where auth_user_id = (select auth.uid()) and status in ('pending', 'approved')
  order by created_at desc limit 1
  for update;
  if not found then raise exception 'NOT_A_MEMBER' using errcode = '42501'; end if;
  if p_date is null or p_date > (now() at time zone 'Asia/Seoul')::date or p_date < date '1950-01-01' then raise exception 'INVALID_HIRE_DATE'; end if;
  if m.hire_date is not null then raise exception 'ALREADY_SET'; end if;
  update public.members set hire_date = p_date where id = m.id;
  perform private.attendance_log(m.company_id, m.id, 'hire_date',
    jsonb_build_array(jsonb_build_object('label', '입사일 · ' || m.name || '(본인 입력)', 'from', null, 'to', to_char(p_date, 'YYYY-MM-DD'))));
end;
$$;

create or replace function public.my_hire_date()
returns date
language sql stable security definer
set search_path = ''
as $$
  select m.hire_date from public.members m where m.id = private.current_member_id()
$$;

-- ── 관리자: 입사일 고치기(사유 필수 · 이력 · 직원 알림) ─────────────────────
create or replace function public.attendance_member_hire_date_set(p_member uuid, p_date date, p_reason text)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_me public.members := private.require_admin();
  v_reason text := btrim(coalesce(p_reason, ''));
  m public.members;
begin
  select * into m from public.members where id = p_member and company_id = v_me.company_id and status = 'approved' for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if p_date is null or p_date > (now() at time zone 'Asia/Seoul')::date or p_date < date '1950-01-01' then raise exception 'INVALID_HIRE_DATE'; end if;
  if char_length(v_reason) < 1 then raise exception 'REASON_REQUIRED'; end if;
  if char_length(v_reason) > 200 then raise exception 'INVALID'; end if;
  if m.hire_date = p_date then raise exception 'NO_CHANGE'; end if;
  update public.members set hire_date = p_date where id = m.id;
  perform private.attendance_log(v_me.company_id, v_me.id, 'hire_date',
    jsonb_build_array(jsonb_build_object('label', '입사일 · ' || m.name, 'from', coalesce(to_char(m.hire_date, 'YYYY-MM-DD'), '없음'), 'to', to_char(p_date, 'YYYY-MM-DD'), 'reason', v_reason)));
  if m.id <> v_me.id and private.attendance_notify(v_me.company_id, m.id,
       '입사일이 바뀌었어요' || chr(10) || '이전: ' || coalesce(to_char(m.hire_date, 'YYYY-MM-DD'), '없음') || chr(10) || '이후: ' || to_char(p_date, 'YYYY-MM-DD')
         || chr(10) || '사유: ' || v_reason || chr(10) || '변경: ' || v_me.name,
       '/workspace/' || v_me.company_id || '/employee/attendance') then
    perform private.attendance_push_now();
  end if;
end;
$$;

-- ── 관리자: 연차 설정(시간차 · 소수점) ──────────────────────────────────────
create or replace function public.attendance_leave_settings_save(p_hourly boolean, p_rounding text)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_me public.members := private.require_admin();
  v_old public.attendance_settings := private.attendance_settings_row(v_me.company_id);
  v_changes jsonb := '[]'::jsonb;
  v_label text[] := array['1일 단위 올림', '0.5일 단위 올림', '시간 단위'];
begin
  if p_hourly is null or p_rounding not in ('day', 'half', 'hour') then raise exception 'INVALID'; end if;
  if p_rounding = 'hour' and not p_hourly then raise exception 'HOUR_NEEDS_HOURLY'; end if;
  update public.attendance_settings set hourly_leave = p_hourly, leave_rounding = p_rounding, updated_by_member_id = v_me.id, updated_at = now()
  where company_id = v_me.company_id;
  if v_old.hourly_leave <> p_hourly then
    v_changes := v_changes || jsonb_build_object('label', '시간차 허용', 'from', case when v_old.hourly_leave then '켜짐' else '꺼짐' end, 'to', case when p_hourly then '켜짐' else '꺼짐' end);
  end if;
  if v_old.leave_rounding <> p_rounding then
    v_changes := v_changes || jsonb_build_object('label', '비례 연차 소수점',
      'from', v_label[array_position(array['day', 'half', 'hour'], v_old.leave_rounding)], 'to', v_label[array_position(array['day', 'half', 'hour'], p_rounding)]);
  end if;
  if jsonb_array_length(v_changes) > 0 then perform private.attendance_log(v_me.company_id, v_me.id, 'settings', v_changes); end if;
end;
$$;

-- ── 관리자: 연차 확정(여러 명 한 번에) ──────────────────────────────────────
-- p_items: [{member_id, period_start, period_end, recommended(숫자|null), granted(숫자), reason(글|null)}]
create or replace function public.attendance_leave_confirm(p_items jsonb)
returns integer
language plpgsql security definer
set search_path = ''
as $$
declare
  v_me public.members := private.require_admin();
  it jsonb;
  m public.members;
  g public.attendance_leave_grants;
  v_start date;
  v_end date;
  v_rec numeric;
  v_granted numeric;
  v_reason text;
  v_n integer := 0;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 500 then raise exception 'INVALID'; end if;
  for it in select * from jsonb_array_elements(p_items) loop
    select * into m from public.members where id = (it ->> 'member_id')::uuid and company_id = v_me.company_id and status = 'approved';
    if not found then raise exception 'NOT_FOUND'; end if;
    v_start := (it ->> 'period_start')::date;
    v_end := (it ->> 'period_end')::date;
    v_rec := nullif(it ->> 'recommended', '')::numeric;
    v_granted := (it ->> 'granted')::numeric;
    v_reason := nullif(btrim(coalesce(it ->> 'reason', '')), '');
    if v_start is null or v_end is null or v_end < v_start or v_end > v_start + interval '1 year' then raise exception 'INVALID'; end if;
    if v_granted is null or v_granted < 0 or v_granted > 60 then raise exception 'INVALID_DAYS'; end if;
    if v_reason is not null and char_length(v_reason) > 200 then raise exception 'INVALID'; end if;
    -- 법 기준보다 적게: 막지 않고 사유만 받는다(D-240)
    if v_rec is not null and v_granted < v_rec and v_reason is null then raise exception 'REASON_REQUIRED'; end if;
    select * into g from public.attendance_leave_grants where member_id = m.id and period_start = v_start;
    insert into public.attendance_leave_grants (company_id, member_id, period_start, period_end, recommended_days, granted_days, reason, confirmed_by, confirmed_by_name, confirmed_at)
    values (v_me.company_id, m.id, v_start, v_end, v_rec, v_granted, v_reason, v_me.id, v_me.name, now())
    on conflict (member_id, period_start) do update set period_end = excluded.period_end, recommended_days = excluded.recommended_days,
      granted_days = excluded.granted_days, reason = excluded.reason, confirmed_by = excluded.confirmed_by,
      confirmed_by_name = excluded.confirmed_by_name, confirmed_at = excluded.confirmed_at;
    if g.member_id is null or g.granted_days <> v_granted then
      perform private.attendance_log(v_me.company_id, v_me.id, 'leave_grant', jsonb_build_array(jsonb_build_object(
        'label', '연차 · ' || m.name || ' · ' || to_char(v_start, 'YYYY-MM-DD') || '~' || to_char(v_end, 'YYYY-MM-DD')
          || case when v_rec is null then '' else ' (법 기준 추천 ' || trim(to_char(v_rec, 'FM990.###'), '.') || '일)' end,
        'from', case when g.member_id is null then '확정 전' else trim(to_char(g.granted_days, 'FM990.###'), '.') || '일' end,
        'to', trim(to_char(v_granted, 'FM990.###'), '.') || '일',
        'reason', v_reason)));
    end if;
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;

-- ── 관리자: 직원별 연차 화면 한 번에 ────────────────────────────────────────
create or replace function public.attendance_leave_admin(p_year integer)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_me public.members := private.require_admin();
  s public.attendance_settings := private.attendance_settings_row(v_me.company_id);
begin
  if p_year is null or p_year < 2000 or p_year > 2100 then raise exception 'INVALID'; end if;
  return jsonb_build_object(
    'year', p_year,
    'today', (now() at time zone 'Asia/Seoul')::date,
    'enabled', private.feature_enabled(v_me.company_id, 'attendance'),
    'enabled_since', private.attendance_enabled_since(v_me.company_id),
    'settings', jsonb_build_object('basis', s.leave_year_basis, 'under_five', s.under_five, 'hourly_leave', s.hourly_leave,
      'rounding', s.leave_rounding, 'daily_hours', s.daily_hours, 'work_days', to_jsonb(s.work_days)),
    'members', coalesce((
      select jsonb_agg(jsonb_build_object('id', m.id, 'name', m.name, 'role', m.role, 'hire_date', m.hire_date) order by (m.role = 'super_admin') desc, m.name)
      from public.members m where m.company_id = v_me.company_id and m.status = 'approved'), '[]'::jsonb),
    'grants', coalesce((
      select jsonb_agg(jsonb_build_object('member_id', g.member_id, 'period_start', g.period_start, 'period_end', g.period_end,
        'recommended', g.recommended_days, 'granted', g.granted_days, 'reason', g.reason, 'confirmed_by_name', g.confirmed_by_name, 'confirmed_at', g.confirmed_at))
      from public.attendance_leave_grants g
      where g.company_id = v_me.company_id and extract(year from g.period_start) = p_year), '[]'::jsonb),
    -- 입사 1년 안 출근 기록(월차 개근 참고) — 최근 입사자만
    'days', coalesce((
      select jsonb_agg(jsonb_build_object('member_id', d.member_id, 'work_date', d.work_date))
      from public.attendance_days d join public.members m on m.id = d.member_id
      where d.company_id = v_me.company_id and m.hire_date is not null and m.hire_date > make_date(p_year - 2, 1, 1)
        and d.work_date >= m.hire_date and d.work_date < m.hire_date + interval '1 year'), '[]'::jsonb),
    'holidays', coalesce((
      select jsonb_agg(h.day order by h.day) from public.kr_holidays h where h.day >= make_date(p_year - 2, 1, 1) and h.day <= make_date(p_year + 1, 12, 31)), '[]'::jsonb));
end;
$$;

revoke all on function private.attendance_enabled_since(uuid) from public, anon, authenticated;
revoke all on function public.set_my_hire_date(date), public.my_hire_date(), public.attendance_member_hire_date_set(uuid, date, text),
  public.attendance_leave_settings_save(boolean, text), public.attendance_leave_confirm(jsonb), public.attendance_leave_admin(integer) from public, anon;
grant execute on function public.set_my_hire_date(date), public.my_hire_date(), public.attendance_member_hire_date_set(uuid, date, text),
  public.attendance_leave_settings_save(boolean, text), public.attendance_leave_confirm(jsonb), public.attendance_leave_admin(integer) to authenticated;
