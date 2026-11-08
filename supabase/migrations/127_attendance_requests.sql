-- =============================================================================
-- 127_attendance_requests.sql — 근태 ⑤ 정정 신청 · 휴일 근무 상신 → 관리자 승인 (D-239, spec/features/attendance.md §6)
-- - 신청은 이번 달 기록만(오늘까지, 근태 켠 날·가입 승인일 이후). 하루 승인 대기 1건
-- - 승인자: 직원 신청 → 관리자·대표 누구나 / 관리자 신청 → 대표만 / 대표 신청 → 바로 본인 승인
-- - QR 기록 없는 휴일은 상신·정정 불가. 승인하면 기록이 바뀌고, 신청(원래 값·사유·처리자)은 고치거나 지울 수 없다
-- - 새 신청은 건마다 승인할 수 있는 관리자 [알림]방 + 휴대폰 알림, 결과는 신청자 [알림]방 + 휴대폰 알림
-- =============================================================================

-- ── 기록 표: 정정 표시 · 휴일 근무 인정 ────────────────────────────────────
alter table public.attendance_days add column in_method text not null default 'qr' check (in_method in ('qr', 'correction'));
alter table public.attendance_days drop constraint attendance_days_out_method_check;
alter table public.attendance_days add constraint attendance_days_out_method_check check (out_method in ('qr', 'auto', 'correction'));
alter table public.attendance_days add column holiday_approved_at timestamptz;

-- ── 신청 표 ─────────────────────────────────────────────────────────────────
create table public.attendance_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  member_id uuid not null,
  member_name text not null,
  member_role text not null check (member_role in ('employee', 'admin', 'super_admin')), -- 신청할 때 역할(승인자 판단)
  work_date date not null,
  kind text not null check (kind in ('correction', 'holiday')),
  new_in time not null,
  new_out time not null,
  reason text not null check (char_length(btrim(reason)) between 1 and 200),
  before jsonb not null, -- 신청할 때 그날 기록 {in_at, out_at, in_method, out_method} 또는 {}(기록 없음)
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'canceled')),
  self_approved boolean not null default false,
  decided_by uuid,
  decided_by_name text,
  decided_at timestamptz,
  reject_reason text check (reject_reason is null or char_length(btrim(reject_reason)) between 1 and 200),
  created_at timestamptz not null default now(),
  foreign key (member_id, company_id) references public.members (id, company_id) on delete cascade,
  check (new_in < new_out),
  check ((status = 'rejected') = (reject_reason is not null)),
  check ((status = 'pending') = (decided_at is null))
);
create unique index attendance_requests_one_pending on public.attendance_requests (member_id, work_date) where status = 'pending';
create index attendance_requests_company on public.attendance_requests (company_id, status, created_at desc);
create index attendance_requests_member on public.attendance_requests (member_id, work_date);

alter table public.attendance_requests enable row level security;
alter table public.attendance_requests force row level security;
revoke all on public.attendance_requests from anon, authenticated;
grant select on public.attendance_requests to authenticated;
create policy attendance_requests_select on public.attendance_requests for select to authenticated
  using (company_id = (select private.current_company_id()) and (member_id = (select private.current_member_id()) or (select private.is_admin())));

-- 처리된 신청은 고치거나 지울 수 없다. 대기 → 처리(승인·반려·취소) 한 번만. 회사·멤버가 지워질 때만 함께 지워진다
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
     or (new.id, new.company_id, new.member_id, new.member_name, new.member_role, new.work_date, new.kind, new.new_in, new.new_out, new.reason, new.before, new.created_at)
        is distinct from (old.id, old.company_id, old.member_id, old.member_name, old.member_role, old.work_date, old.kind, old.new_in, old.new_out, old.reason, old.before, old.created_at) then
    raise exception 'HISTORY_LOCKED' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger attendance_requests_guard before update or delete on public.attendance_requests
  for each row execute function private.attendance_requests_guard();

-- ── 공통 ────────────────────────────────────────────────────────────────────
-- "기록 없음"·신청 가능 시작일: 근태를 처음 켠 날과 가입 승인일 중 늦은 날
create or replace function private.attendance_since(p_company uuid, p_member uuid)
returns date
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_enabled date;
  v_approved date;
begin
  select min((h.at at time zone 'Asia/Seoul')::date) into v_enabled
  from public.attendance_history h
  where h.company_id = p_company and h.action = 'enabled' and h.changes -> 0 ->> 'to' = '켜짐';
  if v_enabled is null then
    select min(d.work_date) into v_enabled from public.attendance_days d where d.company_id = p_company;
  end if;
  select (coalesce(m.approved_at, m.created_at) at time zone 'Asia/Seoul')::date into v_approved from public.members m where m.id = p_member;
  return greatest(coalesce(v_enabled, v_today), coalesce(v_approved, v_today));
end;
$$;

create or replace function private.attendance_hm(p timestamptz)
returns text
language sql immutable
set search_path = ''
as $$ select to_char(p at time zone 'Asia/Seoul', 'HH24:MI') $$;

create or replace function private.attendance_date_label(p date)
returns text
language sql immutable
set search_path = ''
as $$ select extract(month from p)::int || '/' || extract(day from p)::int || ' (' || (array['월','화','수','목','금','토','일'])[extract(isodow from p)::int] || ')' $$;

-- 이 사람이 이 신청을 처리할 수 있나: 직원 신청 → 관리자·대표, 관리자 신청 → 대표만, 본인 신청은 불가
create or replace function private.attendance_can_decide(r public.attendance_requests, p_me public.members)
returns boolean
language sql stable
set search_path = ''
as $$
  select p_me.status = 'approved' and p_me.company_id = r.company_id and p_me.id <> r.member_id
     and p_me.role in ('admin', 'super_admin')
     and (r.member_role = 'employee' or p_me.role = 'super_admin')
$$;

-- 바뀌는 내용 한 줄씩("퇴근: 18:00(자동) → 20:30")
create or replace function private.attendance_request_lines(r public.attendance_requests)
returns text
language plpgsql stable
set search_path = ''
as $$
declare
  v_in text := r.before ->> 'in_at';
  v_out text := r.before ->> 'out_at';
  v_old_in text := case when v_in is null then '기록 없음' else private.attendance_hm(v_in::timestamptz) end;
  v_old_out text := case when v_out is null then '기록 없음'
    else private.attendance_hm(v_out::timestamptz) || case r.before ->> 'out_method' when 'auto' then '(자동)' else '' end end;
  v_lines text := '';
begin
  if v_old_in <> to_char(r.new_in, 'HH24:MI') then v_lines := v_lines || chr(10) || '출근: ' || v_old_in || ' → ' || to_char(r.new_in, 'HH24:MI'); end if;
  if v_out is null or private.attendance_hm(v_out::timestamptz) <> to_char(r.new_out, 'HH24:MI') then
    v_lines := v_lines || chr(10) || '퇴근: ' || v_old_out || ' → ' || to_char(r.new_out, 'HH24:MI');
  end if;
  if v_lines = '' then v_lines := chr(10) || '시각: ' || v_old_in || ' – ' || v_old_out; end if;
  return v_lines;
end;
$$;

-- [알림]방에 글 하나(메신저 켠 회사만). 넣었으면 true
create or replace function private.attendance_notify(p_company uuid, p_member uuid, p_body text, p_link text)
returns boolean
language plpgsql security definer
set search_path = ''
as $$
declare v_room uuid;
begin
  if not private.feature_enabled(p_company, 'messenger') then return false; end if;
  v_room := private.chat_notice_room(p_company, p_member);
  insert into public.chat_messages (room_id, company_id, sender_member_id, kind, body, link)
  values (v_room, p_company, null, 'notice', p_body, p_link);
  return true;
end;
$$;

-- 휴대폰 알림 보내기 요청(10분 예약 작업과 같은 주소)
create or replace function private.attendance_push_now()
returns void
language plpgsql security definer
set search_path = ''
as $$
declare v_url text; v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'reminder_push_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'reminder_push_secret';
  if v_url is not null and v_secret is not null then
    perform net.http_post(url := v_url, body := '{}'::jsonb,
      headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret, 'Content-Type', 'application/json'), timeout_milliseconds := 10000);
  end if;
end;
$$;

-- 승인 반영: 신청할 때 기록과 지금 기록이 같아야 한다(그 사이 바뀌었으면 RECORD_CHANGED)
create or replace function private.attendance_request_apply(r public.attendance_requests)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  d public.attendance_days;
  s public.attendance_settings := private.attendance_settings_row(r.company_id);
  v_in timestamptz := (r.work_date + r.new_in) at time zone 'Asia/Seoul';
  v_out timestamptz := (r.work_date + r.new_out) at time zone 'Asia/Seoul';
begin
  select * into d from public.attendance_days where member_id = r.member_id and work_date = r.work_date for update;
  if not found then
    if r.before <> '{}'::jsonb then raise exception 'RECORD_CHANGED'; end if;
    insert into public.attendance_days (company_id, member_id, work_date, in_at, out_at, in_method, out_method, holiday, sched_end, alert_minutes, alerted_at)
    values (r.company_id, r.member_id, r.work_date, v_in, v_out, 'correction', 'correction', false, s.work_end, s.missing_alert_minutes, now());
    return;
  end if;
  -- 신청 뒤 자정 자동 퇴근이 붙은 것은 바뀐 것으로 보지 않는다(퇴근 전에 낸 신청)
  if r.before = '{}'::jsonb or d.in_at <> (r.before ->> 'in_at')::timestamptz
     or (d.out_at is distinct from (r.before ->> 'out_at')::timestamptz and not (r.before ->> 'out_at' is null and d.out_method = 'auto')) then
    raise exception 'RECORD_CHANGED';
  end if;
  update public.attendance_days set
    in_at = case when private.attendance_hm(d.in_at) = to_char(r.new_in, 'HH24:MI') then d.in_at else v_in end,
    in_method = case when private.attendance_hm(d.in_at) = to_char(r.new_in, 'HH24:MI') then d.in_method else 'correction' end,
    out_at = case when d.out_at is not null and private.attendance_hm(d.out_at) = to_char(r.new_out, 'HH24:MI') then d.out_at else v_out end,
    out_method = case when d.out_at is not null and private.attendance_hm(d.out_at) = to_char(r.new_out, 'HH24:MI') then d.out_method else 'correction' end,
    alerted_at = coalesce(d.alerted_at, now()),
    holiday_approved_at = case when r.kind = 'holiday' then now() else d.holiday_approved_at end
  where member_id = r.member_id and work_date = r.work_date;
end;
$$;

-- ── 직원: 신청 ──────────────────────────────────────────────────────────────
create or replace function public.attendance_request_create(p_date date, p_kind text, p_in text, p_out text, p_reason text)
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

  insert into public.attendance_requests (company_id, member_id, member_name, member_role, work_date, kind, new_in, new_out, reason, before)
  values (v_me.company_id, v_me.id, v_me.name, v_me.role, p_date, p_kind, p_in::time, p_out::time, v_reason,
    case when v_found then jsonb_build_object('in_at', d.in_at, 'out_at', d.out_at, 'in_method', d.in_method, 'out_method', d.out_method) else '{}'::jsonb end)
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

-- ── 직원: 대기 중 신청 취소 ─────────────────────────────────────────────────
create or replace function public.attendance_request_cancel(p_id uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_me public.members := private.require_member();
begin
  update public.attendance_requests set status = 'canceled', decided_by = v_me.id, decided_by_name = v_me.name, decided_at = now()
  where id = p_id and member_id = v_me.id and company_id = v_me.company_id and status = 'pending';
  if not found then raise exception 'NOT_FOUND'; end if;
end;
$$;

-- ── 관리자: 승인 · 반려 ─────────────────────────────────────────────────────
create or replace function public.attendance_request_decide(p_id uuid, p_approve boolean, p_reason text)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_me public.members := private.require_admin();
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  r public.attendance_requests;
  v_body text;
begin
  if not private.feature_enabled(v_me.company_id, 'attendance') then raise exception 'FEATURE_DISABLED'; end if;
  if p_approve is null then raise exception 'INVALID'; end if;
  select * into r from public.attendance_requests where id = p_id and company_id = v_me.company_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if r.status <> 'pending' then raise exception 'ALREADY_DECIDED'; end if;
  if not private.attendance_can_decide(r, v_me) then raise exception 'NOT_ALLOWED' using errcode = '42501'; end if;

  if p_approve then
    perform private.attendance_request_apply(r);
    update public.attendance_requests set status = 'approved', decided_by = v_me.id, decided_by_name = v_me.name, decided_at = now()
    where id = r.id returning * into r;
    v_body := case when r.kind = 'holiday' then '휴일 근무가 인정됐어요' else '정정 신청이 승인됐어요' end
      || chr(10) || '날짜: ' || private.attendance_date_label(r.work_date) || private.attendance_request_lines(r)
      || chr(10) || '승인: ' || v_me.name;
  else
    if v_reason is null then raise exception 'REASON_REQUIRED'; end if;
    if char_length(v_reason) > 200 then raise exception 'INVALID'; end if;
    update public.attendance_requests set status = 'rejected', reject_reason = v_reason, decided_by = v_me.id, decided_by_name = v_me.name, decided_at = now()
    where id = r.id returning * into r;
    v_body := case when r.kind = 'holiday' then '휴일 근무 상신이 반려됐어요' else '정정 신청이 반려됐어요' end
      || chr(10) || '날짜: ' || private.attendance_date_label(r.work_date)
      || chr(10) || '반려 사유: ' || v_reason || chr(10) || '반려: ' || v_me.name;
  end if;
  if private.attendance_notify(r.company_id, r.member_id, v_body,
       '/workspace/' || r.company_id || '/employee/attendance?month=' || to_char(r.work_date, 'YYYY-MM')) then
    perform private.attendance_push_now();
  end if;
  return jsonb_build_object('id', r.id, 'status', r.status);
end;
$$;

-- ── 관리자: 승인 화면 ───────────────────────────────────────────────────────
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
    'can_decide', r.status = 'pending' and private.attendance_can_decide(r, p_me))
$$;

create or replace function public.attendance_requests_admin()
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_me public.members := private.require_admin();
begin
  return jsonb_build_object(
    'pending', coalesce((
      select jsonb_agg(private.attendance_request_json(r, v_me) order by r.created_at)
      from public.attendance_requests r where r.company_id = v_me.company_id and r.status = 'pending'), '[]'::jsonb),
    'done', coalesce((
      select jsonb_agg(private.attendance_request_json(x, v_me) order by x.decided_at desc)
      from (select * from public.attendance_requests r
            where r.company_id = v_me.company_id and r.status in ('approved', 'rejected') and r.decided_at > now() - interval '3 months'
            order by r.decided_at desc limit 200) x), '[]'::jsonb));
end;
$$;

-- 메뉴 숫자: 내가 처리할 수 있는 대기 건
create or replace function public.attendance_pending_count()
returns integer
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_me public.members;
begin
  select * into v_me from public.members where auth_user_id = (select auth.uid()) and status = 'approved';
  if not found or v_me.role not in ('admin', 'super_admin') or not private.feature_enabled(v_me.company_id, 'attendance') then return 0; end if;
  return (select count(*) from public.attendance_requests r
          where r.company_id = v_me.company_id and r.status = 'pending' and private.attendance_can_decide(r, v_me));
end;
$$;

-- ── 직원: 월 근태 현황(125를 넓힘) — 정정·휴일 인정 표시 · 그 달 신청 · 신청 가능 기간 ──
create or replace function public.my_attendance_month(p_month text)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_member uuid := private.current_member_id();
  v_company uuid := private.current_company_id();
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_start date;
  v_end date;
  v_since date;
  s public.attendance_settings;
begin
  if v_member is null or v_company is null then raise exception 'NOT_ALLOWED' using errcode = '42501'; end if;
  if not private.feature_enabled(v_company, 'attendance') then raise exception 'FEATURE_DISABLED'; end if;
  if p_month !~ '^\d{4}-(0[1-9]|1[0-2])$' then raise exception 'INVALID'; end if;
  v_start := (p_month || '-01')::date;
  v_end := (v_start + interval '1 month')::date;
  s := private.attendance_settings_row(v_company);
  v_since := private.attendance_since(v_company, v_member);

  return jsonb_build_object(
    'month', p_month,
    'today', v_today,
    'since', v_since,
    'request_from', greatest(date_trunc('month', v_today)::date, v_since),
    'work_days', to_jsonb(s.work_days),
    'holidays', coalesce((select jsonb_agg(jsonb_build_object('day', h.day, 'name', h.name) order by h.day) from public.kr_holidays h where h.day >= v_start and h.day < v_end), '[]'::jsonb),
    'days', coalesce((
      select jsonb_agg(jsonb_build_object(
        'work_date', d.work_date, 'in_at', d.in_at, 'out_at', d.out_at, 'in_method', d.in_method, 'out_method', d.out_method, 'holiday', d.holiday,
        'holiday_approved', d.holiday_approved_at is not null,
        'sched_end', to_char(d.sched_end, 'HH24:MI'),
        'in_terminal', (select t.name from public.attendance_terminals t where t.id = d.in_terminal_id),
        'out_terminal', (select t.name from public.attendance_terminals t where t.id = d.out_terminal_id)) order by d.work_date desc)
      from public.attendance_days d
      where d.member_id = v_member and d.company_id = v_company and d.work_date >= v_start and d.work_date < v_end), '[]'::jsonb),
    'requests', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'work_date', r.work_date, 'kind', r.kind, 'new_in', to_char(r.new_in, 'HH24:MI'), 'new_out', to_char(r.new_out, 'HH24:MI'),
        'reason', r.reason, 'before', r.before, 'status', r.status, 'self_approved', r.self_approved, 'decided_by_name', r.decided_by_name,
        'decided_at', r.decided_at, 'reject_reason', r.reject_reason, 'created_at', r.created_at) order by r.created_at)
      from public.attendance_requests r
      where r.member_id = v_member and r.company_id = v_company and r.work_date >= v_start and r.work_date < v_end and r.status <> 'canceled'), '[]'::jsonb));
end;
$$;

-- ── 함수 권한 ───────────────────────────────────────────────────────────────
revoke all on function private.attendance_requests_guard(), private.attendance_since(uuid, uuid), private.attendance_hm(timestamptz),
  private.attendance_date_label(date), private.attendance_can_decide(public.attendance_requests, public.members),
  private.attendance_request_lines(public.attendance_requests), private.attendance_notify(uuid, uuid, text, text), private.attendance_push_now(),
  private.attendance_request_apply(public.attendance_requests), private.attendance_request_json(public.attendance_requests, public.members)
  from public, anon, authenticated;
revoke all on function public.attendance_request_create(date, text, text, text, text), public.attendance_request_cancel(uuid),
  public.attendance_request_decide(uuid, boolean, text), public.attendance_requests_admin(), public.attendance_pending_count(),
  public.my_attendance_month(text) from public, anon;
grant execute on function public.attendance_request_create(date, text, text, text, text), public.attendance_request_cancel(uuid),
  public.attendance_request_decide(uuid, boolean, text), public.attendance_requests_admin(), public.attendance_pending_count(),
  public.my_attendance_month(text) to authenticated;
