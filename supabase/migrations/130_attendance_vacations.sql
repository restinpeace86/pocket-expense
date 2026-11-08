-- =============================================================================
-- 130_attendance_vacations.sql — 근태 ⑦ 휴가 신청 · 취소 (D-241, spec/features/attendance.md §8)
-- - 휴가 종류(근태코드 대신): 기본 9가지(법에서 주는 휴가) + 회사 추가. 연차는 항상 켜짐, 나머지는 회사가 켜고 끈다(앱은 막지 않고 알린다)
-- - 증빙: 연차·생리휴가는 받지 않음(고정), 나머지 기본 7가지는 필수(고정) — 나중에 첨부 가능, 첨부 전에는 승인 불가
--   비공개 버킷 leave-proofs, 열람은 본인·관리자만, 민감정보 동의 시각 기록, 휴가 끝난 날로부터 3년 뒤 자동 삭제(근로기준법 제42조)
-- - 신청: 근무일만 셈, 지난 날짜는 이번 달까지, 겹치면 막음. 연차 차감 종류는 확정된 연차 기간 안에서, 모자라면 회사 설정(막기/당겨쓰기)
-- - 승인자·알림은 정정 신청과 같다(직원 → 관리자·대표, 관리자 → 대표, 대표 → 바로 본인 승인 — 증빙이 필수면 첨부 뒤)
-- =============================================================================

alter table public.attendance_settings add column leave_shortage text not null default 'block' check (leave_shortage in ('block', 'borrow'));

alter table public.attendance_history drop constraint attendance_history_action_check;
alter table public.attendance_history add constraint attendance_history_action_check
  check (action in ('enabled', 'settings', 'terminal_add', 'terminal_rename', 'terminal_revoke', 'hire_date', 'leave_grant', 'leave_type'));

-- ── 휴가 종류 ───────────────────────────────────────────────────────────────
create table public.attendance_leave_types (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  builtin_key text check (builtin_key in ('annual', 'family_event', 'sick', 'public', 'menstrual', 'maternity', 'paternity', 'infertility', 'family_care')),
  name text not null check (char_length(btrim(name)) between 1 and 30),
  law_ref text check (law_ref is null or char_length(law_ref) <= 100),
  deducts boolean not null default false,
  paid text not null default 'paid' check (paid in ('paid', 'unpaid', 'partial')),
  allow_hours boolean not null default false,
  proof text not null default 'none' check (proof in ('none', 'optional', 'required')),
  proof_locked boolean not null default false,
  enabled boolean not null default true,
  sort smallint not null default 100,
  created_at timestamptz not null default now(),
  unique (company_id, builtin_key),
  unique (id, company_id)
);
alter table public.attendance_leave_types enable row level security;
alter table public.attendance_leave_types force row level security;
revoke all on public.attendance_leave_types from anon, authenticated;
grant select on public.attendance_leave_types to authenticated;
create policy attendance_leave_types_select on public.attendance_leave_types for select to authenticated
  using (company_id = (select private.current_company_id()));

-- 기본 9가지 만들기(없을 때만). 5인 미만 회사는 생리휴가를 꺼진 채로 만든다(근로기준법 제73조 미적용 안내)
create or replace function private.attendance_leave_types_ensure(p_company uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_under_five boolean := (private.attendance_settings_row(p_company)).under_five;
begin
  if exists (select 1 from public.attendance_leave_types where company_id = p_company and builtin_key = 'annual') then return; end if;
  insert into public.attendance_leave_types (company_id, builtin_key, name, law_ref, deducts, paid, allow_hours, proof, proof_locked, enabled, sort) values
    (p_company, 'annual', '연차', '근로기준법 제60조', true, 'paid', true, 'none', true, true, 1),
    (p_company, 'family_event', '경조사', '회사 규정', false, 'paid', false, 'required', true, true, 2),
    (p_company, 'sick', '병가', '회사 규정', false, 'unpaid', false, 'required', true, true, 3),
    (p_company, 'public', '공가(예비군·민방위 등)', '예비군법 제10조 · 민방위기본법 제27조', false, 'paid', true, 'required', true, true, 4),
    (p_company, 'menstrual', '생리휴가', '근로기준법 제73조', false, 'unpaid', false, 'none', true, not v_under_five, 5),
    (p_company, 'maternity', '출산전후휴가', '근로기준법 제74조', false, 'partial', false, 'required', true, true, 6),
    (p_company, 'paternity', '배우자 출산휴가', '남녀고용평등법 제18조의2', false, 'paid', false, 'required', true, true, 7),
    (p_company, 'infertility', '난임치료휴가', '남녀고용평등법 제18조의3', false, 'partial', false, 'required', true, true, 8),
    (p_company, 'family_care', '가족돌봄휴가', '남녀고용평등법 제22조의2', false, 'unpaid', false, 'required', true, true, 9)
  on conflict (company_id, builtin_key) do nothing;
end;
$$;

-- ── 휴가 ────────────────────────────────────────────────────────────────────
create table public.attendance_leaves (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  member_id uuid not null,
  member_name text not null,
  member_role text not null check (member_role in ('employee', 'admin', 'super_admin')),
  type_id uuid not null,
  type_name text not null,
  deducts boolean not null,
  proof text not null check (proof in ('none', 'optional', 'required')),
  unit text not null check (unit in ('day', 'hour')),
  start_date date not null,
  end_date date not null,
  start_time time,
  hours smallint check (hours is null or hours between 1 and 23),
  workdays integer not null check (workdays >= 0),
  deduct_days numeric(6, 3) not null default 0 check (deduct_days >= 0),
  period_start date, -- 차감한 연차 기간(attendance_leave_grants.period_start)
  reason text check (reason is null or char_length(btrim(reason)) between 1 and 200),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'canceled')),
  self_approved boolean not null default false,
  decided_by uuid,
  decided_by_name text,
  decided_at timestamptz,
  reject_reason text check (reject_reason is null or char_length(btrim(reject_reason)) between 1 and 200),
  cancel_status text check (cancel_status in ('pending', 'approved', 'rejected')),
  cancel_reason text check (cancel_reason is null or char_length(btrim(cancel_reason)) between 1 and 200),
  cancel_requested_at timestamptz,
  cancel_decided_by_name text,
  cancel_decided_at timestamptz,
  cancel_reject_reason text check (cancel_reject_reason is null or char_length(btrim(cancel_reject_reason)) between 1 and 200),
  created_at timestamptz not null default now(),
  foreign key (member_id, company_id) references public.members (id, company_id) on delete cascade,
  foreign key (type_id, company_id) references public.attendance_leave_types (id, company_id),
  check (end_date >= start_date),
  check ((unit = 'hour') = (hours is not null and start_time is not null)),
  check (unit = 'day' or start_date = end_date)
);
create index attendance_leaves_member on public.attendance_leaves (member_id, start_date);
create index attendance_leaves_company on public.attendance_leaves (company_id, status, created_at desc);
alter table public.attendance_leaves enable row level security;
alter table public.attendance_leaves force row level security;
revoke all on public.attendance_leaves from anon, authenticated;
grant select on public.attendance_leaves to authenticated;
create policy attendance_leaves_select on public.attendance_leaves for select to authenticated
  using (company_id = (select private.current_company_id()) and (member_id = (select private.current_member_id()) or (select private.is_admin())));

-- 신청 내용은 바꿀 수 없고 지울 수 없다(상태만 함수로). 회사·멤버가 지워질 때만 함께
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
  if (new.id, new.company_id, new.member_id, new.type_id, new.type_name, new.deducts, new.unit, new.start_date, new.end_date, new.start_time, new.hours, new.workdays, new.deduct_days, new.reason, new.created_at)
     is distinct from (old.id, old.company_id, old.member_id, old.type_id, old.type_name, old.deducts, old.unit, old.start_date, old.end_date, old.start_time, old.hours, old.workdays, old.deduct_days, old.reason, old.created_at)
     or old.status in ('rejected', 'canceled') then
    raise exception 'HISTORY_LOCKED' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger attendance_leaves_guard before update or delete on public.attendance_leaves
  for each row execute function private.attendance_leaves_guard();

-- ── 증빙 파일 ───────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('leave-proofs', 'leave-proofs', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create table public.attendance_leave_files (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  member_id uuid not null,
  leave_id uuid not null references public.attendance_leaves (id) on delete cascade,
  path text not null unique,
  name text not null check (char_length(name) between 1 and 200),
  mime text not null,
  size integer not null check (size > 0 and size <= 10485760),
  consented_at timestamptz not null, -- 민감정보 수집·이용 동의 시각
  delete_after date not null, -- 휴가 끝난 날 + 3년
  purged_at timestamptz,
  created_at timestamptz not null default now()
);
create index attendance_leave_files_leave on public.attendance_leave_files (leave_id);
create index attendance_leave_files_due on public.attendance_leave_files (delete_after) where purged_at is null;
alter table public.attendance_leave_files enable row level security;
alter table public.attendance_leave_files force row level security;
revoke all on public.attendance_leave_files from anon, authenticated;
grant select on public.attendance_leave_files to authenticated;
create policy attendance_leave_files_select on public.attendance_leave_files for select to authenticated
  using (company_id = (select private.current_company_id()) and (member_id = (select private.current_member_id()) or (select private.is_admin())));

-- 저장소: {company}/{member}/{leave}/{파일} — 올리기는 본인·자기 휴가(대기·승인)만, 보기는 본인·같은 회사 관리자, 지우기는 본인·대기 중만
create policy leave_proofs_select on storage.objects for select to authenticated
using (
  bucket_id = 'leave-proofs'
  and (storage.foldername(name))[1] = private.current_company_id()::text
  and ((storage.foldername(name))[2] = private.current_member_id()::text or private.is_admin())
);
create policy leave_proofs_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'leave-proofs'
  and (storage.foldername(name))[1] = private.current_company_id()::text
  and (storage.foldername(name))[2] = private.current_member_id()::text
  and exists (select 1 from public.attendance_leaves l
              where l.id::text = (storage.foldername(name))[3] and l.member_id = private.current_member_id() and l.status in ('pending', 'approved'))
);
create policy leave_proofs_delete on storage.objects for delete to authenticated
using (
  bucket_id = 'leave-proofs'
  and (storage.foldername(name))[1] = private.current_company_id()::text
  and (storage.foldername(name))[2] = private.current_member_id()::text
  and exists (select 1 from public.attendance_leaves l
              where l.id::text = (storage.foldername(name))[3] and l.member_id = private.current_member_id() and l.status = 'pending')
);

-- ── 공통 ────────────────────────────────────────────────────────────────────
-- 근무일 세기(근무 요일 · 공휴일 제외)
create or replace function private.attendance_workdays(p_start date, p_end date, p_days smallint[])
returns integer
language sql stable
set search_path = ''
as $$
  select count(*)::integer from generate_series(p_start, p_end, interval '1 day') g(d)
  where extract(isodow from g.d)::smallint = any (p_days)
    and not exists (select 1 from public.kr_holidays h where h.day = g.d::date)
$$;

-- 이 휴가를 처리할 수 있나(정정 신청과 같은 규칙)
create or replace function private.attendance_leave_can_decide(l public.attendance_leaves, p_me public.members)
returns boolean
language sql stable
set search_path = ''
as $$
  select p_me.status = 'approved' and p_me.company_id = l.company_id and p_me.id <> l.member_id
     and p_me.role in ('admin', 'super_admin')
     and (l.member_role = 'employee' or p_me.role = 'super_admin')
$$;

-- 연차 잔여: 그 기간 확정 일수 − (대기·승인 차감 합, 취소 승인된 것 제외)
create or replace function private.attendance_leave_used(p_member uuid, p_period_start date, p_except uuid default null)
returns numeric
language sql stable
set search_path = ''
as $$
  select coalesce(sum(l.deduct_days), 0) from public.attendance_leaves l
  where l.member_id = p_member and l.period_start = p_period_start and l.status in ('pending', 'approved')
    and (p_except is null or l.id <> p_except)
$$;

create or replace function private.attendance_leave_label(l public.attendance_leaves)
returns text
language sql immutable
set search_path = ''
as $$
  select private.attendance_date_label(l.start_date)
    || case when l.end_date > l.start_date then ' ~ ' || private.attendance_date_label(l.end_date) else '' end
    || case when l.unit = 'hour' then ' · ' || to_char(l.start_time, 'HH24:MI') || '부터 ' || l.hours || '시간' else ' · 근무일 ' || l.workdays || '일' end
$$;

-- 승인자에게 건마다 알림
create or replace function private.attendance_leave_notify_approvers(l public.attendance_leaves, p_title text, p_extra text)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare a record; v_sent boolean := false;
begin
  for a in
    select m.id from public.members m
    where m.company_id = l.company_id and m.status = 'approved' and m.id <> l.member_id
      and (m.role = 'super_admin' or (m.role = 'admin' and l.member_role = 'employee'))
  loop
    v_sent := private.attendance_notify(l.company_id, a.id,
      p_title || chr(10) || '이름: ' || l.member_name || chr(10) || '종류: ' || l.type_name || chr(10) || '날짜: ' || private.attendance_leave_label(l)
        || coalesce(chr(10) || p_extra, ''),
      '/workspace/' || l.company_id || '/admin/attendance') or v_sent;
  end loop;
  if v_sent then perform private.attendance_push_now(); end if;
end;
$$;

create or replace function private.attendance_leave_has_proof(p_leave uuid)
returns boolean
language sql stable
set search_path = ''
as $$ select exists (select 1 from public.attendance_leave_files f where f.leave_id = p_leave and f.purged_at is null) $$;

-- 대표 본인 신청: 증빙이 필요 없거나 첨부됐으면 바로 본인 승인
create or replace function private.attendance_leave_self_approve(p_id uuid)
returns boolean
language plpgsql security definer
set search_path = ''
as $$
declare l public.attendance_leaves;
begin
  select * into l from public.attendance_leaves where id = p_id for update;
  if l.status <> 'pending' or l.member_role <> 'super_admin' then return false; end if;
  if l.proof = 'required' and not private.attendance_leave_has_proof(l.id) then return false; end if;
  update public.attendance_leaves set status = 'approved', self_approved = true, decided_by = l.member_id, decided_by_name = l.member_name, decided_at = now() where id = l.id;
  return true;
end;
$$;

-- ── 관리자: 휴가 종류 ───────────────────────────────────────────────────────
create or replace function public.attendance_leave_types_list()
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare v_company uuid := private.current_company_id();
begin
  if v_company is null or private.current_member_id() is null then raise exception 'NOT_ALLOWED' using errcode = '42501'; end if;
  perform private.attendance_leave_types_ensure(v_company);
  return jsonb_build_object(
    'types', coalesce((select jsonb_agg(to_jsonb(t) - 'company_id' order by t.sort, t.created_at) from public.attendance_leave_types t where t.company_id = v_company), '[]'::jsonb),
    'shortage', (private.attendance_settings_row(v_company)).leave_shortage,
    'hourly_leave', (private.attendance_settings_row(v_company)).hourly_leave,
    'under_five', (private.attendance_settings_row(v_company)).under_five,
    'used', coalesce((select jsonb_agg(distinct l.type_id) from public.attendance_leaves l where l.company_id = v_company), '[]'::jsonb));
end;
$$;


-- p: {id?, name, deducts, paid, allow_hours, proof, enabled} — 기본 종류의 증빙은 고정(proof_locked), 연차는 바꿀 수 없음
create or replace function public.attendance_leave_type_save(p jsonb)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_me public.members := private.require_admin();
  o public.attendance_leave_types;
  t public.attendance_leave_types;
  v_name text := btrim(coalesce(p ->> 'name', ''));
  v_paid text := coalesce(p ->> 'paid', 'paid');
  v_proof text := coalesce(p ->> 'proof', 'none');
  v_changes jsonb := '[]'::jsonb;
  pl jsonb := '{"paid":"유급","unpaid":"무급","partial":"일부 유급"}';
  prl jsonb := '{"none":"받지 않음","optional":"선택","required":"필수"}';
  yn text[] := array['아니요', '예'];
  oo text[] := array['꺼짐', '켜짐'];
begin
  perform private.attendance_leave_types_ensure(v_me.company_id);
  if char_length(v_name) not between 1 and 30 then raise exception 'NAME_LENGTH'; end if;
  if v_paid not in ('paid', 'unpaid', 'partial') or v_proof not in ('none', 'optional', 'required') then raise exception 'INVALID'; end if;
  if p ->> 'id' is null then
    if (select count(*) from public.attendance_leave_types where company_id = v_me.company_id) >= 40 then raise exception 'TYPE_LIMIT'; end if;
    insert into public.attendance_leave_types (company_id, name, law_ref, deducts, paid, allow_hours, proof, enabled, sort)
    values (v_me.company_id, v_name, '회사 규정', coalesce((p ->> 'deducts')::boolean, false), v_paid, coalesce((p ->> 'allow_hours')::boolean, false), v_proof,
      coalesce((p ->> 'enabled')::boolean, true), 100)
    returning * into t;
    perform private.attendance_log(v_me.company_id, v_me.id, 'leave_type', jsonb_build_array(jsonb_build_object('label', '휴가 종류 추가', 'from', null, 'to', v_name)));
    return t.id;
  end if;
  select * into o from public.attendance_leave_types where id = (p ->> 'id')::uuid and company_id = v_me.company_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if o.builtin_key = 'annual' then raise exception 'ANNUAL_LOCKED'; end if;
  update public.attendance_leave_types set
    name = v_name,
    deducts = coalesce((p ->> 'deducts')::boolean, deducts),
    paid = v_paid,
    allow_hours = coalesce((p ->> 'allow_hours')::boolean, allow_hours),
    proof = case when proof_locked then proof else v_proof end,
    enabled = coalesce((p ->> 'enabled')::boolean, enabled)
  where id = o.id returning * into t;
  if t.enabled <> o.enabled then v_changes := v_changes || jsonb_build_object('label', o.name || ' 사용', 'from', oo[o.enabled::int + 1], 'to', oo[t.enabled::int + 1]); end if;
  if t.name <> o.name then v_changes := v_changes || jsonb_build_object('label', '휴가 이름', 'from', o.name, 'to', t.name); end if;
  if t.deducts <> o.deducts then v_changes := v_changes || jsonb_build_object('label', t.name || ' 연차 차감', 'from', yn[o.deducts::int + 1], 'to', yn[t.deducts::int + 1]); end if;
  if t.paid <> o.paid then v_changes := v_changes || jsonb_build_object('label', t.name || ' 급여', 'from', pl ->> o.paid, 'to', pl ->> t.paid); end if;
  if t.allow_hours <> o.allow_hours then v_changes := v_changes || jsonb_build_object('label', t.name || ' 시간 단위', 'from', yn[o.allow_hours::int + 1], 'to', yn[t.allow_hours::int + 1]); end if;
  if t.proof <> o.proof then v_changes := v_changes || jsonb_build_object('label', t.name || ' 증빙', 'from', prl ->> o.proof, 'to', prl ->> t.proof); end if;
  if jsonb_array_length(v_changes) > 0 then perform private.attendance_log(v_me.company_id, v_me.id, 'leave_type', v_changes); end if;
  return t.id;
end;
$$;

create or replace function public.attendance_leave_shortage_save(p_mode text)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_me public.members := private.require_admin();
  v_old text := (private.attendance_settings_row(v_me.company_id)).leave_shortage;
  lb jsonb := '{"block":"막기","borrow":"당겨쓰기 허용"}';
begin
  if p_mode not in ('block', 'borrow') then raise exception 'INVALID'; end if;
  update public.attendance_settings set leave_shortage = p_mode, updated_by_member_id = v_me.id, updated_at = now() where company_id = v_me.company_id;
  if v_old <> p_mode then
    perform private.attendance_log(v_me.company_id, v_me.id, 'settings', jsonb_build_array(jsonb_build_object('label', '연차가 모자랄 때', 'from', lb ->> v_old, 'to', lb ->> p_mode)));
  end if;
end;
$$;

-- ── 직원: 휴가 신청 ─────────────────────────────────────────────────────────
-- p: {type_id, unit:'day'|'hour', start_date, end_date, start_time('HH:MI'), hours, reason}
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
    if s.leave_shortage = 'block' and private.attendance_leave_used(v_me.id, g.period_start) + v_deduct > g.granted_days + 0.0001 then raise exception 'NOT_ENOUGH'; end if;
  end if;
  insert into public.attendance_leaves (company_id, member_id, member_name, member_role, type_id, type_name, deducts, proof, unit, start_date, end_date, start_time, hours,
    workdays, deduct_days, period_start, reason)
  values (v_me.company_id, v_me.id, v_me.name, v_me.role, t.id, t.name, t.deducts, t.proof, v_unit, v_start, v_end, v_time, v_hours,
    case when v_unit = 'hour' then 0 else v_work end, v_deduct, case when t.deducts then g.period_start end, v_reason)
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

-- 증빙 등록(저장소에 올린 뒤). 민감정보 동의 필수, 휴가 끝난 날 + 3년 뒤 지움
create or replace function public.attendance_leave_file_add(p_leave uuid, p_path text, p_name text, p_mime text, p_size integer, p_consent boolean)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_me public.members := private.require_member();
  l public.attendance_leaves;
  v_approved boolean := false;
begin
  select * into l from public.attendance_leaves where id = p_leave and member_id = v_me.id and company_id = v_me.company_id;
  if not found or l.status not in ('pending', 'approved') then raise exception 'NOT_FOUND'; end if;
  if l.proof = 'none' then raise exception 'NO_PROOF_TYPE'; end if;
  if not coalesce(p_consent, false) then raise exception 'CONSENT_REQUIRED'; end if;
  if p_path not like v_me.company_id || '/' || v_me.id || '/' || l.id || '/%'
     or not exists (select 1 from storage.objects o where o.bucket_id = 'leave-proofs' and o.name = p_path) then raise exception 'INVALID_FILE'; end if;
  if (select count(*) from public.attendance_leave_files where leave_id = l.id and purged_at is null) >= 5 then raise exception 'FILE_LIMIT'; end if;
  insert into public.attendance_leave_files (company_id, member_id, leave_id, path, name, mime, size, consented_at, delete_after)
  values (v_me.company_id, v_me.id, l.id, p_path, left(coalesce(nullif(btrim(p_name), ''), '증빙'), 200), p_mime, p_size, now(), (l.end_date + interval '3 years')::date);
  if v_me.role = 'super_admin' then v_approved := private.attendance_leave_self_approve(l.id);
  elsif l.status = 'pending' and l.proof = 'required' and (select count(*) from public.attendance_leave_files where leave_id = l.id and purged_at is null) = 1 then
    perform private.attendance_leave_notify_approvers(l, '휴가 증빙이 올라왔어요', '이제 승인할 수 있어요');
  end if;
  return jsonb_build_object('ok', true, 'self_approved', v_approved);
end;
$$;

-- 증빙 빼기(대기 중만, 본인). 저장소 파일은 화면이 함께 지운다
create or replace function public.attendance_leave_file_remove(p_file uuid)
returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  v_me public.members := private.require_member();
  f public.attendance_leave_files;
begin
  select f2.* into f from public.attendance_leave_files f2 join public.attendance_leaves l on l.id = f2.leave_id
  where f2.id = p_file and f2.member_id = v_me.id and l.status = 'pending';
  if not found then raise exception 'NOT_FOUND'; end if;
  delete from public.attendance_leave_files where id = f.id;
  return f.path;
end;
$$;

-- 취소: 대기 중이면 바로, 승인됐으면 취소 신청(이번 달 이후 휴가만)
create or replace function public.attendance_leave_cancel(p_id uuid, p_reason text)
returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  v_me public.members := private.require_member();
  l public.attendance_leaves;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_today date := (now() at time zone 'Asia/Seoul')::date;
begin
  select * into l from public.attendance_leaves where id = p_id and member_id = v_me.id and company_id = v_me.company_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if v_reason is not null and char_length(v_reason) > 200 then raise exception 'INVALID'; end if;
  if l.status = 'pending' then
    update public.attendance_leaves set status = 'canceled', decided_by = v_me.id, decided_by_name = v_me.name, decided_at = now() where id = l.id;
    return 'canceled';
  end if;
  if l.status <> 'approved' or l.cancel_status = 'pending' then raise exception 'NOT_FOUND'; end if;
  if l.end_date < date_trunc('month', v_today)::date then raise exception 'OUT_OF_RANGE'; end if;
  update public.attendance_leaves set cancel_status = 'pending', cancel_reason = v_reason, cancel_requested_at = now(),
    cancel_decided_by_name = null, cancel_decided_at = null, cancel_reject_reason = null where id = l.id returning * into l;
  if v_me.role = 'super_admin' then
    update public.attendance_leaves set status = 'canceled', cancel_status = 'approved', cancel_decided_by_name = v_me.name, cancel_decided_at = now() where id = l.id;
    return 'canceled';
  end if;
  perform private.attendance_leave_notify_approvers(l, '휴가 취소 신청이 왔어요', case when v_reason is not null then '사유: ' || v_reason end);
  return 'cancel_pending';
end;
$$;

-- ── 관리자: 승인 · 반려(휴가 · 휴가 취소) ───────────────────────────────────
create or replace function public.attendance_leave_decide(p_id uuid, p_approve boolean, p_reason text)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_me public.members := private.require_admin();
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  l public.attendance_leaves;
  g public.attendance_leave_grants;
  v_body text;
begin
  if not private.feature_enabled(v_me.company_id, 'attendance') then raise exception 'FEATURE_DISABLED'; end if;
  if p_approve is null then raise exception 'INVALID'; end if;
  select * into l from public.attendance_leaves where id = p_id and company_id = v_me.company_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if not private.attendance_leave_can_decide(l, v_me) then raise exception 'NOT_ALLOWED' using errcode = '42501'; end if;
  if not p_approve and v_reason is null then raise exception 'REASON_REQUIRED'; end if;
  if v_reason is not null and char_length(v_reason) > 200 then raise exception 'INVALID'; end if;

  if l.status = 'pending' then
    if p_approve then
      if l.proof = 'required' and not private.attendance_leave_has_proof(l.id) then raise exception 'PROOF_REQUIRED'; end if;
      if l.deducts and (private.attendance_settings_row(l.company_id)).leave_shortage = 'block' then
        select * into g from public.attendance_leave_grants where member_id = l.member_id and period_start = l.period_start;
        if not found or private.attendance_leave_used(l.member_id, l.period_start, l.id) + l.deduct_days > g.granted_days + 0.0001 then raise exception 'NOT_ENOUGH'; end if;
      end if;
      update public.attendance_leaves set status = 'approved', decided_by = v_me.id, decided_by_name = v_me.name, decided_at = now() where id = l.id;
      v_body := '휴가가 승인됐어요' || chr(10) || '종류: ' || l.type_name || chr(10) || '날짜: ' || private.attendance_leave_label(l) || chr(10) || '승인: ' || v_me.name;
    else
      update public.attendance_leaves set status = 'rejected', reject_reason = v_reason, decided_by = v_me.id, decided_by_name = v_me.name, decided_at = now() where id = l.id;
      v_body := '휴가가 반려됐어요' || chr(10) || '종류: ' || l.type_name || chr(10) || '날짜: ' || private.attendance_leave_label(l) || chr(10) || '반려 사유: ' || v_reason || chr(10) || '반려: ' || v_me.name;
    end if;
  elsif l.status = 'approved' and l.cancel_status = 'pending' then
    if p_approve then
      update public.attendance_leaves set status = 'canceled', cancel_status = 'approved', cancel_decided_by_name = v_me.name, cancel_decided_at = now() where id = l.id;
      v_body := '휴가 취소가 승인됐어요' || chr(10) || '종류: ' || l.type_name || chr(10) || '날짜: ' || private.attendance_leave_label(l)
        || case when l.deducts then chr(10) || '연차: ' || trim(to_char(l.deduct_days, 'FM990.###'), '.') || '일 돌려받음' else '' end;
    else
      update public.attendance_leaves set cancel_status = 'rejected', cancel_reject_reason = v_reason, cancel_decided_by_name = v_me.name, cancel_decided_at = now() where id = l.id;
      v_body := '휴가 취소가 반려됐어요' || chr(10) || '날짜: ' || private.attendance_leave_label(l) || chr(10) || '반려 사유: ' || v_reason;
    end if;
  else
    raise exception 'ALREADY_DECIDED';
  end if;
  if private.attendance_notify(l.company_id, l.member_id, v_body, '/workspace/' || l.company_id || '/employee/vacation') then perform private.attendance_push_now(); end if;
  return jsonb_build_object('id', l.id);
end;
$$;

-- 휴가 한 건 JSON(파일·잔여 포함)
create or replace function private.attendance_leave_json(l public.attendance_leaves, p_me public.members)
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select to_jsonb(l) - 'company_id' || jsonb_build_object(
    'start_time', to_char(l.start_time, 'HH24:MI'),
    'can_decide', (l.status = 'pending' or l.cancel_status = 'pending') and private.attendance_leave_can_decide(l, p_me),
    'mine', l.member_id = p_me.id,
    'has_proof', private.attendance_leave_has_proof(l.id),
    'files', coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 'name', f.name, 'mime', f.mime, 'size', f.size, 'path', case when f.purged_at is null then f.path end, 'purged', f.purged_at is not null) order by f.created_at)
                       from public.attendance_leave_files f where f.leave_id = l.id), '[]'::jsonb),
    'granted', (select g.granted_days from public.attendance_leave_grants g where g.member_id = l.member_id and g.period_start = l.period_start),
    'used_other', case when l.period_start is null then null else private.attendance_leave_used(l.member_id, l.period_start, l.id) end)
$$;

create or replace function public.attendance_leaves_admin()
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare v_me public.members := private.require_admin();
begin
  return jsonb_build_object(
    'pending', coalesce((select jsonb_agg(private.attendance_leave_json(l, v_me) order by coalesce(l.cancel_requested_at, l.created_at))
      from public.attendance_leaves l where l.company_id = v_me.company_id and (l.status = 'pending' or l.cancel_status = 'pending')), '[]'::jsonb),
    'done', coalesce((select jsonb_agg(private.attendance_leave_json(x, v_me) order by greatest(x.decided_at, x.cancel_decided_at) desc)
      from (select * from public.attendance_leaves l where l.company_id = v_me.company_id and l.status in ('approved', 'rejected', 'canceled')
              and l.cancel_status is distinct from 'pending' and greatest(l.decided_at, l.cancel_decided_at) > now() - interval '3 months'
              and not (l.status = 'canceled' and l.cancel_status is null) -- 직원이 대기 중에 스스로 취소한 건은 뺌
            order by greatest(l.decided_at, l.cancel_decided_at) desc limit 200) x), '[]'::jsonb));
end;
$$;

-- 메뉴 숫자: 정정·휴일 근무 + 휴가·휴가 취소 중 내가 처리할 수 있는 대기 건
create or replace function public.attendance_pending_count()
returns integer
language plpgsql stable security definer
set search_path = ''
as $$
declare v_me public.members;
begin
  select * into v_me from public.members where auth_user_id = (select auth.uid()) and status = 'approved';
  if not found or v_me.role not in ('admin', 'super_admin') or not private.feature_enabled(v_me.company_id, 'attendance') then return 0; end if;
  return (select count(*) from public.attendance_requests r where r.company_id = v_me.company_id and r.status = 'pending' and private.attendance_can_decide(r, v_me))
       + (select count(*) from public.attendance_leaves l where l.company_id = v_me.company_id and (l.status = 'pending' or l.cancel_status = 'pending') and private.attendance_leave_can_decide(l, v_me));
end;
$$;

-- ── 직원: 내 휴가(연도) ─────────────────────────────────────────────────────
create or replace function public.my_vacation(p_year integer)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_me public.members := private.require_member();
  s public.attendance_settings;
  v_from date;
  v_to date;
begin
  if not private.feature_enabled(v_me.company_id, 'attendance') then raise exception 'FEATURE_DISABLED'; end if;
  if p_year is null or p_year < 2000 or p_year > 2100 then raise exception 'INVALID'; end if;
  v_from := make_date(p_year, 1, 1);
  v_to := make_date(p_year, 12, 31);
  s := private.attendance_settings_row(v_me.company_id);
  perform private.attendance_leave_types_ensure(v_me.company_id);
  return jsonb_build_object(
    'year', p_year,
    'today', (now() at time zone 'Asia/Seoul')::date,
    'settings', jsonb_build_object('hourly_leave', s.hourly_leave, 'daily_hours', s.daily_hours, 'shortage', s.leave_shortage, 'work_days', to_jsonb(s.work_days)),
    'types', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'key', t.builtin_key, 'name', t.name, 'deducts', t.deducts, 'paid', t.paid, 'allow_hours', t.allow_hours, 'proof', t.proof) order by t.sort, t.created_at)
      from public.attendance_leave_types t where t.company_id = v_me.company_id and t.enabled), '[]'::jsonb),
    'grants', coalesce((select jsonb_agg(jsonb_build_object('period_start', g.period_start, 'period_end', g.period_end, 'granted', g.granted_days,
        'used', private.attendance_leave_used(v_me.id, g.period_start),
        'approved', coalesce((select sum(l.deduct_days) from public.attendance_leaves l where l.member_id = v_me.id and l.period_start = g.period_start and l.status = 'approved'), 0)) order by g.period_start)
      from public.attendance_leave_grants g where g.member_id = v_me.id and g.period_start <= v_to and g.period_end >= v_from), '[]'::jsonb),
    'leaves', coalesce((select jsonb_agg(private.attendance_leave_json(l, v_me) order by l.start_date desc, l.created_at desc)
      from public.attendance_leaves l where l.member_id = v_me.id and l.start_date <= v_to and l.end_date >= v_from), '[]'::jsonb),
    'holidays', coalesce((select jsonb_agg(h.day order by h.day) from public.kr_holidays h where h.day between v_from - 31 and v_to + 400), '[]'::jsonb));
end;
$$;

-- ── 월 근태 현황(127을 넓힘): 승인된 휴가 ───────────────────────────────────
create or replace function public.my_attendance_month(p_month text)
returns jsonb
language plpgsql volatile security definer
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
      where d.member_id = v_member and d.company_id = v_company and d.work_date >= v_start and d.work_date < v_end), '[]'::jsonb),
    'requests', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'work_date', r.work_date, 'kind', r.kind, 'new_in', to_char(r.new_in, 'HH24:MI'), 'new_out', to_char(r.new_out, 'HH24:MI'),
        'reason', r.reason, 'before', r.before, 'status', r.status, 'self_approved', r.self_approved, 'decided_by_name', r.decided_by_name,
        'decided_at', r.decided_at, 'reject_reason', r.reject_reason, 'created_at', r.created_at) order by r.created_at)
      from public.attendance_requests r
      where r.member_id = v_member and r.company_id = v_company and r.work_date >= v_start and r.work_date < v_end and r.status <> 'canceled'), '[]'::jsonb),
    'leaves', coalesce((
      select jsonb_agg(jsonb_build_object('id', l.id, 'type_name', l.type_name, 'unit', l.unit, 'start_date', l.start_date, 'end_date', l.end_date,
        'start_time', to_char(l.start_time, 'HH24:MI'), 'hours', l.hours) order by l.start_date)
      from public.attendance_leaves l
      where l.member_id = v_member and l.status = 'approved' and l.start_date < v_end and l.end_date >= v_start), '[]'::jsonb));
end;
$$;

-- ── 캘린더: 승인된 휴가(다른 직원에게는 "휴가"만, 관리자·본인은 종류까지) ────
create or replace function public.calendar_leaves_range(p_from date, p_to date, p_members uuid[])
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_company uuid := private.current_company_id();
  v_me uuid := private.current_member_id();
  v_admin boolean := private.is_admin();
begin
  if v_company is null or v_me is null then raise exception 'NOT_ALLOWED' using errcode = '42501'; end if;
  if not private.feature_enabled(v_company, 'attendance') then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', l.id, 'member_id', l.member_id, 'name', l.member_name,
      'label', case when v_admin or l.member_id = v_me then l.type_name else '휴가' end,
      'start_date', l.start_date, 'end_date', l.end_date, 'unit', l.unit, 'start_time', to_char(l.start_time, 'HH24:MI'), 'hours', l.hours) order by l.start_date)
    from public.attendance_leaves l
    where l.company_id = v_company and l.status = 'approved' and l.start_date <= p_to and l.end_date >= p_from
      and (p_members is null or l.member_id = any (p_members))), '[]'::jsonb);
end;
$$;

-- ── 새벽 정리(서버 전용): 보관 기간(휴가 끝난 날 + 3년)이 지난 증빙 ───────────
create or replace function public.leave_files_due(p_limit integer default 200)
returns table (id uuid, path text)
language sql stable security definer
set search_path = ''
as $$
  select f.id, f.path from public.attendance_leave_files f
  where f.purged_at is null and f.delete_after < (now() at time zone 'Asia/Seoul')::date
  order by f.delete_after limit greatest(1, least(p_limit, 1000))
$$;
create or replace function public.leave_files_mark_purged(p_ids uuid[])
returns integer
language sql security definer
set search_path = ''
as $$
  with u as (update public.attendance_leave_files set purged_at = now() where id = any (p_ids) and purged_at is null returning 1)
  select count(*)::integer from u
$$;

-- ── 권한 ────────────────────────────────────────────────────────────────────
revoke all on function private.attendance_leave_types_ensure(uuid), private.attendance_leaves_guard(), private.attendance_workdays(date, date, smallint[]),
  private.attendance_leave_can_decide(public.attendance_leaves, public.members), private.attendance_leave_used(uuid, date, uuid),
  private.attendance_leave_label(public.attendance_leaves), private.attendance_leave_notify_approvers(public.attendance_leaves, text, text),
  private.attendance_leave_has_proof(uuid), private.attendance_leave_self_approve(uuid), private.attendance_leave_json(public.attendance_leaves, public.members)
  from public, anon, authenticated;
revoke all on function public.attendance_leave_types_list(), public.attendance_leave_type_save(jsonb), public.attendance_leave_shortage_save(text),
  public.attendance_leave_create(jsonb), public.attendance_leave_file_add(uuid, text, text, text, integer, boolean), public.attendance_leave_file_remove(uuid),
  public.attendance_leave_cancel(uuid, text), public.attendance_leave_decide(uuid, boolean, text), public.attendance_leaves_admin(), public.attendance_pending_count(),
  public.my_vacation(integer), public.my_attendance_month(text), public.calendar_leaves_range(date, date, uuid[]) from public, anon;
grant execute on function public.attendance_leave_types_list(), public.attendance_leave_type_save(jsonb), public.attendance_leave_shortage_save(text),
  public.attendance_leave_create(jsonb), public.attendance_leave_file_add(uuid, text, text, text, integer, boolean), public.attendance_leave_file_remove(uuid),
  public.attendance_leave_cancel(uuid, text), public.attendance_leave_decide(uuid, boolean, text), public.attendance_leaves_admin(), public.attendance_pending_count(),
  public.my_vacation(integer), public.my_attendance_month(text), public.calendar_leaves_range(date, date, uuid[]) to authenticated;
revoke all on function public.leave_files_due(integer), public.leave_files_mark_purged(uuid[]) from public, anon, authenticated;
grant execute on function public.leave_files_due(integer), public.leave_files_mark_purged(uuid[]) to service_role;
