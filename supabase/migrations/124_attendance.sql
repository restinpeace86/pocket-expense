-- =============================================================================
-- 124_attendance.sql — 근태 1단계: 근태 설정 · 회사 QR(출근 단말) · QR 출퇴근 (D-236, spec/features/attendance.md)
-- - 회사별 스위치 company_features 'attendance'(관리자가 켬)
-- - 설정·단말 변경은 모두 attendance_history에 남고 고치거나 지울 수 없다
-- - 출퇴근 기록은 서버(service role)만 남긴다. 직원 권한으로는 표·적재 함수에 직접 쓰지 못한다
-- - 하루 출근 1번·퇴근 1번, QR은 한국 시간 06:00~24:00, 자정까지 퇴근 없으면 정규 퇴근 시각으로 자동 기록
-- =============================================================================

-- ── 표 ──────────────────────────────────────────────────────────────────────
create table public.attendance_settings (
  company_id uuid primary key references public.companies (id) on delete cascade,
  work_start time not null default '09:00',
  work_end time not null default '18:00',
  daily_hours smallint not null default 8 check (daily_hours between 1 and 12),
  work_days smallint[] not null default '{1,2,3,4,5}', -- ISO 요일 1=월 … 7=일
  missing_alert_minutes smallint not null default 60 check (missing_alert_minutes in (30, 60, 90, 120, 180)),
  leave_year_basis text not null default 'calendar' check (leave_year_basis in ('calendar', 'hire')),
  under_five boolean not null default false,
  updated_by_member_id uuid,
  updated_at timestamptz not null default now(),
  check (work_start < work_end),
  check (extract(minute from work_start)::int % 10 = 0 and extract(minute from work_end)::int % 10 = 0 and extract(second from work_start) = 0 and extract(second from work_end) = 0),
  check (cardinality(work_days) between 1 and 7 and work_days <@ '{1,2,3,4,5,6,7}'::smallint[])
);

create table public.attendance_history (
  id bigint generated always as identity primary key,
  company_id uuid not null references public.companies (id) on delete cascade,
  member_id uuid, -- 바꾼 사람(시스템이면 null)
  member_name text,
  at timestamptz not null default now(),
  action text not null check (action in ('enabled', 'settings', 'terminal_add', 'terminal_rename', 'terminal_revoke')),
  changes jsonb not null -- [{"label": "정규 퇴근", "from": "18:00", "to": "18:30"}, …]
);
create index attendance_history_company_at on public.attendance_history (company_id, at desc);

create table public.attendance_terminals (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 30),
  key_hash text not null unique,
  created_by_member_id uuid,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz,
  unique (id, company_id)
);
create index attendance_terminals_company on public.attendance_terminals (company_id) where revoked_at is null;

create table public.attendance_pair_codes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  code_hash text not null unique,
  name text not null check (char_length(btrim(name)) between 1 and 30),
  created_by_member_id uuid,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz,
  terminal_id uuid
);

create table public.attendance_days (
  company_id uuid not null references public.companies (id) on delete cascade,
  member_id uuid not null,
  work_date date not null,
  in_at timestamptz not null,
  out_at timestamptz,
  out_method text check (out_method in ('qr', 'auto')),
  in_terminal_id uuid,
  out_terminal_id uuid,
  holiday boolean not null default false,
  sched_end time not null, -- 출근할 때의 정규 퇴근 시각(설정을 바꿔도 이미 남은 기록은 그대로)
  alert_minutes smallint not null,
  alerted_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (member_id, work_date),
  foreign key (member_id, company_id) references public.members (id, company_id) on delete cascade,
  check ((out_at is null) = (out_method is null)),
  check (out_at is null or out_at >= in_at)
);
create index attendance_days_company_date on public.attendance_days (company_id, work_date);
create index attendance_days_open on public.attendance_days (work_date) where out_at is null;

create table public.attendance_attempts (
  id bigint generated always as identity primary key,
  company_id uuid,
  member_id uuid,
  terminal_id uuid,
  code text not null,
  ip text,
  user_agent text,
  at timestamptz not null default now()
);
create index attendance_attempts_at on public.attendance_attempts (at);
create index attendance_attempts_ip on public.attendance_attempts (ip, at) where ip is not null;

-- ── 권한: 읽기만 RLS로, 쓰기는 모두 함수로 ──────────────────────────────────
alter table public.attendance_settings enable row level security;
alter table public.attendance_settings force row level security;
alter table public.attendance_history enable row level security;
alter table public.attendance_history force row level security;
alter table public.attendance_terminals enable row level security;
alter table public.attendance_terminals force row level security;
alter table public.attendance_pair_codes enable row level security;
alter table public.attendance_pair_codes force row level security;
alter table public.attendance_days enable row level security;
alter table public.attendance_days force row level security;
alter table public.attendance_attempts enable row level security;
alter table public.attendance_attempts force row level security;

revoke all on public.attendance_settings, public.attendance_history, public.attendance_terminals, public.attendance_pair_codes, public.attendance_days, public.attendance_attempts from anon, authenticated;
grant select on public.attendance_settings, public.attendance_history, public.attendance_terminals, public.attendance_days to authenticated;

create policy attendance_settings_select on public.attendance_settings for select to authenticated
  using (company_id = (select private.current_company_id()));
create policy attendance_history_select on public.attendance_history for select to authenticated
  using (company_id = (select private.current_company_id()) and (select private.is_admin()));
create policy attendance_terminals_select on public.attendance_terminals for select to authenticated
  using (company_id = (select private.current_company_id()) and (select private.is_admin()));
create policy attendance_days_select on public.attendance_days for select to authenticated
  using (company_id = (select private.current_company_id()) and (member_id = (select private.current_member_id()) or (select private.is_admin())));

-- 변경 이력은 고치거나 지울 수 없다(관리자·서버도). 회사가 지워질 때만 함께 지워진다
create or replace function private.attendance_history_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and not exists (select 1 from public.companies c where c.id = old.company_id) then return old; end if;
  raise exception 'HISTORY_LOCKED' using errcode = '42501';
end;
$$;
create trigger attendance_history_guard before update or delete on public.attendance_history
  for each row execute function private.attendance_history_guard();

-- ── 공통 ────────────────────────────────────────────────────────────────────
create or replace function private.attendance_settings_row(p_company uuid)
returns public.attendance_settings
language plpgsql security definer
set search_path = ''
as $$
declare v public.attendance_settings;
begin
  select * into v from public.attendance_settings where company_id = p_company;
  if not found then
    insert into public.attendance_settings (company_id) values (p_company) on conflict (company_id) do nothing;
    select * into v from public.attendance_settings where company_id = p_company;
  end if;
  return v;
end;
$$;

create or replace function private.attendance_settings_json(v public.attendance_settings)
returns jsonb
language sql immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'work_start', to_char(v.work_start, 'HH24:MI'), 'work_end', to_char(v.work_end, 'HH24:MI'),
    'daily_hours', v.daily_hours, 'work_days', to_jsonb(v.work_days), 'missing_alert_minutes', v.missing_alert_minutes,
    'leave_year_basis', v.leave_year_basis, 'under_five', v.under_five)
$$;

create or replace function private.attendance_log(p_company uuid, p_member uuid, p_action text, p_changes jsonb)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.attendance_history (company_id, member_id, member_name, action, changes)
  values (p_company, p_member, (select m.name from public.members m where m.id = p_member), p_action, p_changes);
end;
$$;

create or replace function private.attendance_days_label(p_days smallint[])
returns text
language sql immutable
set search_path = ''
as $$
  select coalesce(string_agg((array['월','화','수','목','금','토','일'])[d], '·' order by d), '') from unnest(p_days) d
$$;

-- ── 관리자: 켜기·끄기 ───────────────────────────────────────────────────────
create or replace function public.attendance_set_enabled(p_enabled boolean)
returns boolean
language plpgsql security definer
set search_path = ''
as $$
declare
  v_me public.members := private.require_admin();
  v_old boolean := private.feature_enabled(v_me.company_id, 'attendance');
begin
  if p_enabled is null then raise exception 'INVALID'; end if;
  perform private.attendance_settings_row(v_me.company_id);
  insert into public.company_features (company_id, feature, enabled, updated_at)
  values (v_me.company_id, 'attendance', p_enabled, now())
  on conflict (company_id, feature) do update set enabled = excluded.enabled, updated_at = now();
  if v_old is distinct from p_enabled then
    perform private.attendance_log(v_me.company_id, v_me.id, 'enabled',
      jsonb_build_array(jsonb_build_object('label', '근태 사용', 'from', case when v_old then '켜짐' else '꺼짐' end, 'to', case when p_enabled then '켜짐' else '꺼짐' end)));
  end if;
  return p_enabled;
end;
$$;

-- ── 관리자: 설정 저장(바뀐 항목마다 이전 값 → 새 값을 이력에) ───────────────
create or replace function public.attendance_settings_save(p jsonb)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_me public.members := private.require_admin();
  v_old public.attendance_settings;
  v_new public.attendance_settings;
  v_changes jsonb := '[]'::jsonb;
  v_days smallint[];
begin
  v_old := private.attendance_settings_row(v_me.company_id);
  v_new := v_old;
  begin
    v_new.work_start := (p ->> 'work_start')::time;
    v_new.work_end := (p ->> 'work_end')::time;
    v_new.daily_hours := (p ->> 'daily_hours')::smallint;
    select array_agg(distinct x::smallint order by x::smallint) into v_days from jsonb_array_elements_text(p -> 'work_days') x;
    v_new.work_days := v_days;
    v_new.missing_alert_minutes := (p ->> 'missing_alert_minutes')::smallint;
    v_new.leave_year_basis := p ->> 'leave_year_basis';
    v_new.under_five := (p ->> 'under_five')::boolean;
  exception when others then
    raise exception 'INVALID';
  end;
  if v_new.work_start is null or v_new.work_end is null or v_new.daily_hours is null or v_new.work_days is null
     or v_new.missing_alert_minutes is null or v_new.leave_year_basis is null or v_new.under_five is null then
    raise exception 'INVALID';
  end if;
  if v_new.work_start >= v_new.work_end then raise exception 'WORK_TIME_ORDER'; end if;

  if v_new.work_start <> v_old.work_start then v_changes := v_changes || jsonb_build_object('label', '정규 출근', 'from', to_char(v_old.work_start, 'HH24:MI'), 'to', to_char(v_new.work_start, 'HH24:MI')); end if;
  if v_new.work_end <> v_old.work_end then v_changes := v_changes || jsonb_build_object('label', '정규 퇴근', 'from', to_char(v_old.work_end, 'HH24:MI'), 'to', to_char(v_new.work_end, 'HH24:MI')); end if;
  if v_new.daily_hours <> v_old.daily_hours then v_changes := v_changes || jsonb_build_object('label', '1일 소정근로시간', 'from', v_old.daily_hours || '시간', 'to', v_new.daily_hours || '시간'); end if;
  if v_new.work_days <> v_old.work_days then v_changes := v_changes || jsonb_build_object('label', '근무 요일', 'from', private.attendance_days_label(v_old.work_days), 'to', private.attendance_days_label(v_new.work_days)); end if;
  if v_new.missing_alert_minutes <> v_old.missing_alert_minutes then v_changes := v_changes || jsonb_build_object('label', '퇴근 누락 알림', 'from', '정규 퇴근 ' || v_old.missing_alert_minutes || '분 뒤', 'to', '정규 퇴근 ' || v_new.missing_alert_minutes || '분 뒤'); end if;
  if v_new.leave_year_basis <> v_old.leave_year_basis then v_changes := v_changes || jsonb_build_object('label', '연차 연도 기준',
    'from', case v_old.leave_year_basis when 'calendar' then '1월 1일~12월 31일' else '직원별 입사일' end,
    'to', case v_new.leave_year_basis when 'calendar' then '1월 1일~12월 31일' else '직원별 입사일' end); end if;
  if v_new.under_five <> v_old.under_five then v_changes := v_changes || jsonb_build_object('label', '5인 미만 회사', 'from', case when v_old.under_five then '예' else '아니요' end, 'to', case when v_new.under_five then '예' else '아니요' end); end if;

  if jsonb_array_length(v_changes) > 0 then
    update public.attendance_settings set
      work_start = v_new.work_start, work_end = v_new.work_end, daily_hours = v_new.daily_hours, work_days = v_new.work_days,
      missing_alert_minutes = v_new.missing_alert_minutes, leave_year_basis = v_new.leave_year_basis, under_five = v_new.under_five,
      updated_by_member_id = v_me.id, updated_at = now()
    where company_id = v_me.company_id
    returning * into v_new;
    perform private.attendance_log(v_me.company_id, v_me.id, 'settings', v_changes);
  end if;
  return private.attendance_settings_json(v_new);
end;
$$;

-- ── 관리자: 출근 단말 연결 코드(10분, 한 번만) · 이름 바꾸기 · 해제 ─────────
-- 코드는 서버가 만들고 해시만 넘긴다(관리자 화면에 한 번만 보임)
create or replace function public.attendance_pair_code_create(p_name text, p_code_hash text)
returns timestamptz
language plpgsql security definer
set search_path = ''
as $$
declare
  v_me public.members := private.require_admin();
  v_exp timestamptz := now() + interval '10 minutes';
begin
  if not private.feature_enabled(v_me.company_id, 'attendance') then raise exception 'FEATURE_DISABLED'; end if;
  if p_name is null or char_length(btrim(p_name)) not between 1 and 30 then raise exception 'NAME_LENGTH'; end if;
  if p_code_hash is null or char_length(p_code_hash) <> 64 then raise exception 'INVALID'; end if;
  if (select count(*) from public.attendance_terminals t where t.company_id = v_me.company_id and t.revoked_at is null) >= 20 then raise exception 'TERMINAL_LIMIT'; end if;
  -- 쓰지 않은 앞 코드는 무효(한 번에 하나)
  update public.attendance_pair_codes set expires_at = now() where company_id = v_me.company_id and used_at is null and expires_at > now();
  insert into public.attendance_pair_codes (company_id, code_hash, name, created_by_member_id, expires_at)
  values (v_me.company_id, p_code_hash, btrim(p_name), v_me.id, v_exp);
  return v_exp;
end;
$$;

create or replace function public.attendance_terminal_rename(p_id uuid, p_name text)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_me public.members := private.require_admin();
  v_old text;
begin
  if p_name is null or char_length(btrim(p_name)) not between 1 and 30 then raise exception 'NAME_LENGTH'; end if;
  select name into v_old from public.attendance_terminals where id = p_id and company_id = v_me.company_id and revoked_at is null for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if v_old = btrim(p_name) then return; end if;
  update public.attendance_terminals set name = btrim(p_name) where id = p_id;
  perform private.attendance_log(v_me.company_id, v_me.id, 'terminal_rename', jsonb_build_array(jsonb_build_object('label', '출근 단말 이름', 'from', v_old, 'to', btrim(p_name))));
end;
$$;

create or replace function public.attendance_terminal_revoke(p_id uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_me public.members := private.require_admin();
  v_name text;
begin
  update public.attendance_terminals set revoked_at = now()
  where id = p_id and company_id = v_me.company_id and revoked_at is null
  returning name into v_name;
  if v_name is null then raise exception 'NOT_FOUND'; end if;
  perform private.attendance_log(v_me.company_id, v_me.id, 'terminal_revoke', jsonb_build_array(jsonb_build_object('label', '출근 단말 해제', 'from', v_name, 'to', null)));
end;
$$;

-- ── 서버 전용(service role): 단말 연결 · 단말 확인 · 출퇴근 ─────────────────
create or replace function public.attendance_terminal_pair(p_code_hash text, p_key_hash text, p_ip text)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  c public.attendance_pair_codes;
  v_id uuid;
begin
  -- 같은 곳에서 10분에 10번 넘게 틀리면 잠시 막는다(6자리 코드 맞히기 방지)
  if p_ip is not null and (select count(*) from public.attendance_attempts a where a.ip = p_ip and a.code = 'PAIR_FAIL' and a.at > now() - interval '10 minutes') >= 10 then
    raise exception 'TOO_MANY';
  end if;
  select * into c from public.attendance_pair_codes where code_hash = p_code_hash and used_at is null and expires_at > now() for update;
  if not found then
    insert into public.attendance_attempts (code, ip) values ('PAIR_FAIL', p_ip);
    raise exception 'CODE_INVALID';
  end if;
  if not private.feature_enabled(c.company_id, 'attendance') then raise exception 'FEATURE_DISABLED'; end if;
  if (select count(*) from public.attendance_terminals t where t.company_id = c.company_id and t.revoked_at is null) >= 20 then raise exception 'TERMINAL_LIMIT'; end if;
  insert into public.attendance_terminals (company_id, name, key_hash, created_by_member_id, last_used_at)
  values (c.company_id, c.name, p_key_hash, c.created_by_member_id, now()) returning id into v_id;
  update public.attendance_pair_codes set used_at = now(), terminal_id = v_id where id = c.id;
  perform private.attendance_log(c.company_id, c.created_by_member_id, 'terminal_add', jsonb_build_array(jsonb_build_object('label', '출근 단말 등록', 'from', null, 'to', c.name)));
  return jsonb_build_object('terminal_id', v_id, 'company_id', c.company_id, 'name', c.name);
end;
$$;

-- 단말 열쇠 확인: 해제·스위치·회사 이름. 마지막 사용은 1분에 한 번만 적는다
create or replace function public.attendance_terminal_auth(p_key_hash text)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  t public.attendance_terminals;
begin
  select * into t from public.attendance_terminals where key_hash = p_key_hash;
  if not found or t.revoked_at is not null then return jsonb_build_object('status', 'revoked'); end if;
  if t.last_used_at is null or t.last_used_at < now() - interval '1 minute' then
    update public.attendance_terminals set last_used_at = now() where id = t.id;
  end if;
  return jsonb_build_object(
    'status', case when private.feature_enabled(t.company_id, 'attendance') then 'ok' else 'disabled' end,
    'terminal_id', t.id, 'company_id', t.company_id, 'name', t.name,
    'company_name', (select c.name from public.companies c where c.id = t.company_id),
    'recent', coalesce((
      select jsonb_agg(jsonb_build_object('name', r.name, 'kind', r.kind, 'at', r.at) order by r.at desc)
      from (
        select m.name, 'in' as kind, d.in_at as at from public.attendance_days d join public.members m on m.id = d.member_id
        where d.in_terminal_id = t.id and d.in_at > now() - interval '12 seconds'
        union all
        select m.name, 'out', d.out_at from public.attendance_days d join public.members m on m.id = d.member_id
        where d.out_terminal_id = t.id and d.out_method = 'qr' and d.out_at > now() - interval '12 seconds'
      ) r), '[]'::jsonb));
end;
$$;

create or replace function private.attendance_is_holiday(p_company uuid, p_day date, p_days smallint[])
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select not (extract(isodow from p_day)::smallint = any (p_days)) or exists (select 1 from public.kr_holidays h where h.day = p_day)
$$;

-- 출퇴근: 서버가 QR 서명·로그인을 확인한 뒤 부른다. 하루 출근 1번·퇴근 1번
-- 결과 result: in | confirm_out | out | already
create or replace function public.attendance_punch(p_company uuid, p_terminal uuid, p_member uuid, p_confirm_out boolean)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_now timestamptz := now();
  v_local timestamp := v_now at time zone 'Asia/Seoul';
  v_day date := (v_now at time zone 'Asia/Seoul')::date;
  m public.members;
  s public.attendance_settings;
  d public.attendance_days;
begin
  select * into m from public.members where id = p_member and company_id = p_company;
  if not found or m.status <> 'approved' then raise exception 'NOT_MEMBER'; end if;
  if not private.feature_enabled(p_company, 'attendance') then raise exception 'FEATURE_DISABLED'; end if;
  if not exists (select 1 from public.attendance_terminals t where t.id = p_terminal and t.company_id = p_company and t.revoked_at is null) then
    raise exception 'TERMINAL_REVOKED';
  end if;
  if extract(hour from v_local) < 6 then raise exception 'CLOSED_HOURS'; end if;
  s := private.attendance_settings_row(p_company);

  select * into d from public.attendance_days where member_id = p_member and work_date = v_day for update;
  if not found then
    insert into public.attendance_days (company_id, member_id, work_date, in_at, in_terminal_id, holiday, sched_end, alert_minutes)
    values (p_company, p_member, v_day, v_now, p_terminal, private.attendance_is_holiday(p_company, v_day, s.work_days), s.work_end, s.missing_alert_minutes)
    returning * into d;
    return jsonb_build_object('result', 'in', 'in_at', d.in_at, 'holiday', d.holiday, 'work_date', d.work_date);
  end if;
  if d.out_at is not null then
    return jsonb_build_object('result', 'already', 'in_at', d.in_at, 'out_at', d.out_at, 'holiday', d.holiday, 'work_date', d.work_date);
  end if;
  -- 출근 직후 1분 안에 또 찍으면 출근 화면을 다시 보여 준다(실수로 두 번)
  if v_now < d.in_at + interval '1 minute' then
    return jsonb_build_object('result', 'in', 'in_at', d.in_at, 'holiday', d.holiday, 'work_date', d.work_date);
  end if;
  if not coalesce(p_confirm_out, false) then
    return jsonb_build_object('result', 'confirm_out', 'in_at', d.in_at, 'now', v_now, 'holiday', d.holiday, 'work_date', d.work_date);
  end if;
  update public.attendance_days set out_at = v_now, out_method = 'qr', out_terminal_id = p_terminal
  where member_id = p_member and work_date = v_day returning * into d;
  return jsonb_build_object('result', 'out', 'in_at', d.in_at, 'out_at', d.out_at, 'holiday', d.holiday, 'work_date', d.work_date);
end;
$$;

create or replace function public.attendance_log_attempt(p_company uuid, p_member uuid, p_terminal uuid, p_code text, p_ip text, p_ua text)
returns void
language sql security definer
set search_path = ''
as $$
  insert into public.attendance_attempts (company_id, member_id, terminal_id, code, ip, user_agent)
  values (p_company, p_member, p_terminal, left(p_code, 40), left(p_ip, 64), left(p_ua, 300))
$$;

-- ── 직원: 오늘 내 출퇴근(홈 카드) ───────────────────────────────────────────
create or replace function public.my_attendance_today()
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select case when not private.feature_enabled(private.current_company_id(), 'attendance') then null else
    coalesce((
      select jsonb_build_object('in_at', d.in_at, 'out_at', d.out_at, 'out_method', d.out_method, 'holiday', d.holiday)
      from public.attendance_days d
      where d.member_id = private.current_member_id() and d.work_date = (now() at time zone 'Asia/Seoul')::date
    ), '{}'::jsonb) end
$$;

-- ── 관리자 화면 한 번에: 설정 · 단말 · 이력(최근 100) ───────────────────────
create or replace function public.attendance_admin_view()
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_me public.members := private.require_admin();
begin
  return jsonb_build_object(
    'enabled', private.feature_enabled(v_me.company_id, 'attendance'),
    'settings', private.attendance_settings_json(private.attendance_settings_row(v_me.company_id)),
    'terminals', coalesce((
      select jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'created_at', t.created_at, 'last_used_at', t.last_used_at,
        'created_by', (select m.name from public.members m where m.id = t.created_by_member_id)) order by t.created_at)
      from public.attendance_terminals t where t.company_id = v_me.company_id and t.revoked_at is null), '[]'::jsonb),
    'history', coalesce((
      select jsonb_agg(jsonb_build_object('id', h.id, 'at', h.at, 'member_name', h.member_name, 'action', h.action, 'changes', h.changes) order by h.at desc, h.id desc)
      from (select * from public.attendance_history where company_id = v_me.company_id order by at desc, id desc limit 100) h), '[]'::jsonb));
end;
$$;

-- ── 예약 작업(10분마다): 퇴근 누락 알림 · 자정 자동 퇴근 · 오래된 기록 정리 ──
create or replace function private.attendance_tick()
returns integer
language plpgsql security definer
set search_path = ''
as $$
declare
  v_now timestamptz := now();
  v_today date := (v_now at time zone 'Asia/Seoul')::date;
  r record;
  v_room uuid;
  v_n integer := 0;
  v_url text;
  v_secret text;
begin
  -- ① 자정이 지난 날 중 퇴근이 없는 날 → 정규 퇴근 시각으로 자동 기록(출근이 더 늦으면 출근 시각)
  update public.attendance_days d
  set out_at = greatest(d.in_at, (d.work_date + d.sched_end) at time zone 'Asia/Seoul'), out_method = 'auto'
  where d.work_date < v_today and d.out_at is null;

  -- ② 오늘 정규 퇴근 + 설정 시간(늦어도 23:50)이 지났는데 퇴근을 안 찍은 사람 → 본인 [알림]방 한 번(휴일 제외)
  for r in
    select d.company_id, d.member_id, d.work_date, d.in_at, d.sched_end
    from public.attendance_days d join public.members m on m.id = d.member_id
    where d.work_date = v_today and d.out_at is null and d.alerted_at is null and not d.holiday and m.status = 'approved'
      -- 분 단위로 비교(time + interval은 자정을 넘으면 0시로 돌아가므로)
      and extract(epoch from (v_now at time zone 'Asia/Seoul')::time) / 60
          >= least(extract(epoch from d.sched_end) / 60 + d.alert_minutes, 23 * 60 + 50)
    for update of d skip locked
  loop
    update public.attendance_days set alerted_at = v_now where member_id = r.member_id and work_date = r.work_date;
    if not private.feature_enabled(r.company_id, 'attendance') or not private.feature_enabled(r.company_id, 'messenger') then continue; end if;
    v_room := private.chat_notice_room(r.company_id, r.member_id);
    insert into public.chat_messages (room_id, company_id, sender_member_id, kind, body, link)
    values (v_room, r.company_id, null, 'notice',
      '오늘 퇴근을 안 찍었어요. 자정 전에 회사 QR을 찍어 주세요.' || chr(10)
        || '안 찍으면 ' || to_char(r.sched_end, 'HH24:MI') || '(정규 퇴근)으로 기록돼요.' || chr(10)
        || '출근 ' || to_char(r.in_at at time zone 'Asia/Seoul', 'HH24:MI'),
      '/workspace/' || r.company_id || '/employee');
    v_n := v_n + 1;
  end loop;

  -- ③ 실패 기록 90일, 쓴·지난 연결 코드 1일
  delete from public.attendance_attempts where at < v_now - interval '90 days';
  delete from public.attendance_pair_codes where expires_at < v_now - interval '1 day';

  if v_n > 0 then
    select decrypted_secret into v_url from vault.decrypted_secrets where name = 'reminder_push_url';
    select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'reminder_push_secret';
    if v_url is not null and v_secret is not null then
      perform net.http_post(url := v_url, body := '{}'::jsonb,
        headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret, 'Content-Type', 'application/json'), timeout_milliseconds := 10000);
    end if;
  end if;
  return v_n;
end;
$$;

-- ── 함수 권한 ───────────────────────────────────────────────────────────────
revoke all on function private.attendance_history_guard(), private.attendance_settings_row(uuid), private.attendance_settings_json(public.attendance_settings),
  private.attendance_log(uuid, uuid, text, jsonb), private.attendance_days_label(smallint[]), private.attendance_is_holiday(uuid, date, smallint[]),
  private.attendance_tick() from public, anon, authenticated;

revoke all on function public.attendance_set_enabled(boolean), public.attendance_settings_save(jsonb), public.attendance_pair_code_create(text, text),
  public.attendance_terminal_rename(uuid, text), public.attendance_terminal_revoke(uuid), public.my_attendance_today(), public.attendance_admin_view() from public, anon;
grant execute on function public.attendance_set_enabled(boolean), public.attendance_settings_save(jsonb), public.attendance_pair_code_create(text, text),
  public.attendance_terminal_rename(uuid, text), public.attendance_terminal_revoke(uuid), public.my_attendance_today(), public.attendance_admin_view() to authenticated;

revoke all on function public.attendance_terminal_pair(text, text, text), public.attendance_terminal_auth(text),
  public.attendance_punch(uuid, uuid, uuid, boolean), public.attendance_log_attempt(uuid, uuid, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.attendance_terminal_pair(text, text, text), public.attendance_terminal_auth(text),
  public.attendance_punch(uuid, uuid, uuid, boolean), public.attendance_log_attempt(uuid, uuid, uuid, text, text, text) to service_role;

select cron.schedule('attendance-tick', '*/10 * * * *', 'select private.attendance_tick()');
