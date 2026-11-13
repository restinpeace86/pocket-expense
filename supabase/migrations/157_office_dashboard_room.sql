-- =============================================================================
-- 157_office_dashboard_room.sql — 세무사무소 현황판·일괄 처리 + 세무 알림방 (9-18·9-19, D-268·D-269)
-- 사용자 결정(2026-11-13): 현황판(왼쪽 고객사 목록) · 여러 곳 ZIP·자료 요청 / 세무 알림방 = 회사 대표·관리자만, 맨 위 고정 없이 알림 오면 뜸,
--   세무사무소가 공지·메시지도 보낼 수 있음 / 마감 리마인드는 이미 있어 그대로(D-161)
-- ① 현황판: tax_office_client_status에 확인할 것(영수증 없는 지출·승인 대기·홈택스 안 올림)·마지막 올림·사무소 확인·회사 확인 수
-- ② 사무소 확인(달별, 사무소 안에서만 보임): office_client_checks
-- ③ 세무 알림방: 관리자마다 사무소별 [알림] 방(kind notice + office_id). 자료 요청·답변·사무소 공지가 여기로
--    카드에 요청 번호(office_request_id) → [자료 올리기]·[확인했어요]·[문의 남기기]
-- =============================================================================

-- ── ② 사무소 확인 ─────────────────────────────────────────────────────────
create table public.office_client_checks (
  office_id uuid not null references public.tax_offices (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  month text not null check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  checked_by_name text,
  checked_at timestamptz not null default now(),
  primary key (office_id, company_id, month)
);
alter table public.office_client_checks enable row level security;
alter table public.office_client_checks force row level security;
revoke all on public.office_client_checks from anon, authenticated;

create or replace function public.office_set_client_check(p_company uuid, p_month text, p_on boolean)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare v public.tax_office_members := private.my_tax_office_member();
begin
  if v.id is null then raise exception 'NOT_A_TAX_OFFICE_MEMBER' using errcode = '42501'; end if;
  perform private.require_tax_office_company(p_company);
  if p_month !~ '^\d{4}-(0[1-9]|1[0-2])$' then raise exception 'INVALID_MONTH'; end if;
  if p_on then
    insert into public.office_client_checks (office_id, company_id, month, checked_by_name) values (v.office_id, p_company, p_month, v.name)
    on conflict (office_id, company_id, month) do update set checked_by_name = excluded.checked_by_name, checked_at = now();
  else
    delete from public.office_client_checks where office_id = v.office_id and company_id = p_company and month = p_month;
  end if;
end;
$$;

-- ── 요청 [확인했어요](회사) ──────────────────────────────────────────────
alter table public.tax_office_requests add column acked_at timestamptz, add column acked_by_name text;

create or replace function public.company_ack_tax_request(p_id uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare v_admin public.members := private.require_admin();
begin
  update public.tax_office_requests set acked_at = coalesce(acked_at, now()), acked_by_name = coalesce(acked_by_name, v_admin.name)
   where id = p_id and company_id = v_admin.company_id;
  if not found then raise exception 'NOT_FOUND'; end if;
end;
$$;

-- ── ① 현황판 ─────────────────────────────────────────────────────────────
create or replace function public.tax_office_client_status(p_month text)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare v public.tax_office_members := private.my_tax_office_member();
begin
  if (select auth.uid()) is null then raise exception 'NOT_AUTHENTICATED' using errcode = '42501'; end if;
  if p_month is null or p_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then raise exception 'INVALID_MONTH'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'company_id', c.id,
             'closed', mc.status is not distinct from 'closed',
             'closed_at', case when mc.status = 'closed' then mc.closed_at end,
             'requests_open', (select count(*) from public.tax_office_requests r where r.company_id = c.id and r.status = 'open'),
             'requests_answered', (select count(*) from public.tax_office_requests r where r.company_id = c.id and r.status = 'answered'),
             'requests_acked', (select count(*) from public.tax_office_requests r where r.company_id = c.id and r.status = 'open' and r.origin = 'office' and r.acked_at is not null),
             'unread', (select count(*) from public.tax_office_requests r where r.company_id = c.id and r.unread_for = 'office'),
             -- 그 달 승인·지급된 지출 중 영수증 사진이 없는 것(자차·일비처럼 영수증이 없는 항목은 뺌)
             'missing_receipts', (
               select count(*) from public.expense_items i join public.expense_claims cl on cl.id = i.claim_id
               where i.company_id = c.id and cl.status in ('approved', 'paid') and i.receipt_path is null
                 and to_char(i.expense_date, 'YYYY-MM') = p_month
                 and not (i.category = 'trip' and i.trip_type = 'own_car')),
             'pending_claims', (
               select count(distinct cl.id) from public.expense_claims cl join public.expense_items i on i.claim_id = cl.id
               where cl.company_id = c.id and cl.status = 'submitted' and to_char(i.expense_date, 'YYYY-MM') = p_month),
             'hometax_missing', not exists (select 1 from public.hometax_uploads h where h.company_id = c.id and h.month = p_month),
             'last_upload_at', (select max(cl.submitted_at) from public.expense_claims cl where cl.company_id = c.id),
             'office_checked_at', (select k.checked_at from public.office_client_checks k where k.office_id = v.office_id and k.company_id = c.id and k.month = p_month),
             'office_checked_by', (select k.checked_by_name from public.office_client_checks k where k.office_id = v.office_id and k.company_id = c.id and k.month = p_month)))
      from public.companies c
      left join public.monthly_closings mc on mc.company_id = c.id and mc.year_month = p_month
     where c.id in (select private.tax_office_company_ids())
  ), '[]'::jsonb);
end;
$$;

-- ── ③ 세무 알림방 ─────────────────────────────────────────────────────────
alter table public.chat_rooms add column office_id uuid references public.tax_offices (id) on delete cascade;
alter table public.chat_rooms drop constraint chat_rooms_notice_unique;
create unique index chat_rooms_notice_unique on public.chat_rooms (company_id, notice_member_id, office_id) nulls not distinct where notice_member_id is not null;
alter table public.chat_rooms add constraint chat_rooms_office_notice check (office_id is null or kind = 'notice');

alter table public.chat_messages add column office_request_id uuid references public.tax_office_requests (id) on delete set null;

-- 개인 [알림]방: 사무소 방이 아닌 것
create or replace function private.chat_notice_room(p_company uuid, p_member uuid)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_room uuid;
begin
  select id into v_room from public.chat_rooms where company_id = p_company and notice_member_id = p_member and office_id is null;
  if v_room is null then
    insert into public.chat_rooms (company_id, kind, title, notice_member_id) values (p_company, 'notice', '알림', p_member)
      on conflict do nothing returning id into v_room;
    if v_room is null then select id into v_room from public.chat_rooms where company_id = p_company and notice_member_id = p_member and office_id is null; end if;
    insert into public.chat_members (room_id, company_id, member_id) values (v_room, p_company, p_member) on conflict do nothing;
  end if;
  return v_room;
end;
$$;

-- 세무사무소 알림방(관리자마다, 사무소마다). 이름 = "○○ 알림"
create or replace function private.chat_office_room(p_company uuid, p_member uuid, p_office uuid)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_room uuid;
  v_title text := left(coalesce((select name from public.tax_offices where id = p_office), '세무사무소') || ' 알림', 60);
begin
  select id into v_room from public.chat_rooms where company_id = p_company and notice_member_id = p_member and office_id = p_office;
  if v_room is null then
    insert into public.chat_rooms (company_id, kind, title, notice_member_id, office_id) values (p_company, 'notice', v_title, p_member, p_office)
      on conflict do nothing returning id into v_room;
    if v_room is null then select id into v_room from public.chat_rooms where company_id = p_company and notice_member_id = p_member and office_id = p_office; end if;
    insert into public.chat_members (room_id, company_id, member_id) values (v_room, p_company, p_member) on conflict do nothing;
  end if;
  return v_room;
end;
$$;
revoke all on function private.chat_notice_room(uuid, uuid), private.chat_office_room(uuid, uuid, uuid) from public, anon, authenticated;

-- 회사 대표·관리자 각자의 사무소 알림방에 카드(메신저가 꺼진 회사는 넣지 않음). p_pushed = 서버가 이미 앱 알림을 보냈으면 true
create or replace function private.office_room_post_all(p_company uuid, p_office uuid, p_body text, p_link text, p_request uuid, p_pushed boolean)
returns integer
language plpgsql security definer
set search_path = ''
as $$
declare r record; v_n integer := 0;
begin
  if p_company is null or p_office is null or btrim(coalesce(p_body, '')) = '' then return 0; end if;
  if not private.feature_enabled(p_company, 'messenger') then return 0; end if;
  for r in select id from public.members where company_id = p_company and status = 'approved' and role in ('admin', 'super_admin') loop
    insert into public.chat_messages (room_id, company_id, sender_member_id, kind, body, link, office_request_id, pushed_at)
    values (private.chat_office_room(p_company, r.id, p_office), p_company, null, 'notice', left(p_body, 2000), left(p_link, 300), p_request, case when p_pushed then now() end);
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;
revoke all on function private.office_room_post_all(uuid, uuid, text, text, uuid, boolean) from public, anon, authenticated;

-- 서버(service role): 자료 요청·답변 알림을 사무소 알림방으로(앱 알림은 서버가 보냄)
create or replace function public.office_room_post(p_company uuid, p_office uuid, p_body text, p_link text, p_request uuid)
returns integer
language sql security definer
set search_path = ''
as $$
  select private.office_room_post_all(p_company, p_office, p_body, p_link, p_request, true)
$$;
revoke all on function public.office_room_post(uuid, uuid, text, text, uuid) from public, anon, authenticated;
grant execute on function public.office_room_post(uuid, uuid, text, text, uuid) to service_role;

-- 세무사무소 공지·메시지(여러 고객사에 한 번에). 기록을 남기고 알림방에 카드(앱 알림은 알림 푸시 작업이 가져감)
create table public.tax_office_notices (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.tax_offices (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  sent_by_name text,
  created_at timestamptz not null default now()
);
create index tax_office_notices_office_idx on public.tax_office_notices (office_id, created_at desc);
alter table public.tax_office_notices enable row level security;
alter table public.tax_office_notices force row level security;
revoke all on public.tax_office_notices from anon, authenticated;

create or replace function public.tax_office_send_notice(p_companies uuid[], p_body text)
returns integer
language plpgsql security definer
set search_path = ''
as $$
declare
  v public.tax_office_members := private.my_tax_office_member();
  v_company uuid;
  v_n integer := 0;
  v_office text;
begin
  if v.id is null then raise exception 'NOT_A_TAX_OFFICE_MEMBER' using errcode = '42501'; end if;
  if char_length(btrim(coalesce(p_body, ''))) not between 1 and 1000 then raise exception 'INVALID_REQUEST'; end if;
  if coalesce(cardinality(p_companies), 0) not between 1 and 50 then raise exception 'INVALID_REQUEST'; end if;
  v_office := (select name from public.tax_offices where id = v.office_id);
  foreach v_company in array p_companies loop
    perform private.require_tax_office_company(v_company);
    insert into public.tax_office_notices (office_id, company_id, body, sent_by_name) values (v.office_id, v_company, btrim(p_body), v.name);
    perform private.office_room_post_all(v_company, v.office_id, format('%s 공지', coalesce(v_office, '세무사무소')) || E'\n' || btrim(p_body) || E'\n' || format('보낸 사람: %s', v.name), null, null, false);
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;

-- 사무소: 보낸 공지 기록(최근 50)
create or replace function public.tax_office_notice_list(p_company uuid)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare v public.tax_office_members := private.my_tax_office_member();
begin
  if v.id is null then raise exception 'NOT_A_TAX_OFFICE_MEMBER' using errcode = '42501'; end if;
  perform private.require_tax_office_company(p_company);
  return coalesce((select jsonb_agg(jsonb_build_object('id', id, 'body', body, 'sent_by_name', sent_by_name, 'created_at', created_at) order by created_at desc)
    from (select * from public.tax_office_notices where office_id = v.office_id and company_id = p_company order by created_at desc limit 50) x), '[]'::jsonb);
end;
$$;

-- 메시지 JSON: 사무소 요청 카드면 요청 상태도(버튼 상태)
create or replace function private.chat_message_json(p public.chat_messages)
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p.id, 'room_id', p.room_id, 'sender_member_id', p.sender_member_id,
    'sender_name', (select m.name from public.members m where m.id = p.sender_member_id),
    'kind', p.kind,
    'body', case when p.deleted_at is null then p.body end,
    'link', p.link,
    'attachment_path', case when p.deleted_at is null and p.attachment_purged_at is null then p.attachment_path end,
    'attachment_thumb_path', case when p.deleted_at is null and p.attachment_purged_at is null then p.attachment_thumb_path end,
    'attachment_name', case when p.deleted_at is null then p.attachment_name end,
    'attachment_size', case when p.deleted_at is null then p.attachment_size end,
    'attachment_mime', case when p.deleted_at is null then p.attachment_mime end,
    'width', p.width, 'height', p.height,
    'created_at', p.created_at, 'deleted', p.deleted_at is not null,
    'expired', p.deleted_at is null and p.attachment_purged_at is not null,
    'thread_id', p.thread_id,
    'thread', (select private.chat_thread_json(t) from public.chat_threads t where t.root_message_id = p.id),
    'office_request', (select jsonb_build_object('id', r.id, 'status', r.status, 'origin', r.origin, 'month', r.month, 'acked_by_name', r.acked_by_name, 'answer', r.answer)
                       from public.tax_office_requests r where r.id = p.office_request_id)
  )
$$;

-- 방 정보: 사무소 알림방이면 사무소 id
create or replace function public.chat_room_detail(p_room uuid)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_me public.members := private.require_chat();
  v_room public.chat_rooms;
begin
  if not private.is_chat_member(p_room) then raise exception 'NOT_FOUND'; end if;
  select * into v_room from public.chat_rooms where id = p_room;
  return jsonb_build_object(
    'id', v_room.id, 'kind', v_room.kind, 'title', v_room.title, 'claim_id', v_room.claim_id,
    'office_id', v_room.office_id,
    'claim', (select jsonb_build_object('id', c.id, 'title', c.title, 'status', c.status, 'total_amount', c.total_amount, 'member_id', c.member_id)
              from public.expense_claims c where c.id = v_room.claim_id),
    'members', private.chat_room_members_json(p_room)
  );
end;
$$;

revoke all on function public.office_set_client_check(uuid, text, boolean), public.company_ack_tax_request(uuid), public.tax_office_send_notice(uuid[], text), public.tax_office_notice_list(uuid) from public, anon;
grant execute on function public.office_set_client_check(uuid, text, boolean), public.company_ack_tax_request(uuid), public.tax_office_send_notice(uuid[], text), public.tax_office_notice_list(uuid) to authenticated;
