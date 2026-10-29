-- =============================================================================
-- 092_office_notice_requests.sql — 회사 마감 → 세무사무소 알림 + 세무사 → 회사 자료 요청 (D-168, D-169)
-- D-168(사용자 결정 2026-10-29): 회사가 세무 마감을 하면 담당 세무사(없으면 사무소 관리자)에게 알림톡 + 웹푸시.
--   세무사무소 계정용 웹푸시 구독 표를 따로 둔다(회사 멤버 구독과 섞지 않음, 서버만 읽고 씀).
-- D-169: 시스템 확인(확인 필요·카드 대조)과 회사 메모가 있어도 자료가 없거나 부족하면 세무사가 회사에 "자료 요청".
--   달 단위 또는 영수증 단위, 상태 열림 → 회사 답변 → 해결. 회사 관리자와 그 회사를 볼 수 있는 사무소 구성원만 본다.
-- =============================================================================

create table public.tax_office_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  office_member_id uuid not null references public.tax_office_members (id) on delete cascade,
  endpoint text not null unique check (endpoint ~ '^https://' and char_length(endpoint) <= 1000),
  p256dh text not null check (char_length(p256dh) between 20 and 200),
  auth text not null check (char_length(auth) between 10 and 100),
  user_agent text check (char_length(user_agent) <= 300),
  created_at timestamptz not null default now(),
  last_sent_at timestamptz
);
create index tax_office_push_member_idx on public.tax_office_push_subscriptions (office_member_id);
alter table public.tax_office_push_subscriptions enable row level security;
alter table public.tax_office_push_subscriptions force row level security; -- 정책 없음 = 서버(service role)만
revoke all on public.tax_office_push_subscriptions from anon, authenticated;

alter table public.notification_logs drop constraint notification_logs_template_code_check;
alter table public.notification_logs add constraint notification_logs_template_code_check
  check (template_code in ('APPROVAL_REQUEST', 'APPROVAL_COMPLETED', 'APPROVAL_REJECTED', 'PAYOUT_COMPLETED', 'INVITE', 'REMINDER', 'RECURRING_READY', 'CLOSING',
                           'TAX_CLOSED', 'TAX_REQUEST', 'TAX_OFFICE_INVITE'));

-- ── 자료 요청 ────────────────────────────────────────────────────────────────
create table public.tax_office_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  office_id uuid references public.tax_offices (id) on delete set null,
  month text not null check (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  item_id uuid references public.expense_items (id) on delete set null,
  item_label text check (item_label is null or char_length(item_label) <= 200),
  body text not null check (char_length(btrim(body)) between 1 and 500),
  requested_by_name text,
  office_name text,
  status text not null default 'open' check (status in ('open', 'answered', 'resolved')),
  answer text check (answer is null or char_length(answer) <= 500),
  answered_by_name text,
  answered_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index tax_office_requests_company_idx on public.tax_office_requests (company_id, status, created_at desc);
alter table public.tax_office_requests enable row level security;
alter table public.tax_office_requests force row level security;
revoke all on public.tax_office_requests from anon, authenticated;
grant select on public.tax_office_requests to authenticated;
create policy tax_office_requests_select on public.tax_office_requests for select to authenticated
  using ((company_id = (select private.current_company_id()) and (select private.is_admin())) or company_id in (select private.tax_office_company_ids()));

-- 세무사: 요청 남기기(영수증 단위면 그 회사·그 달 영수증이어야 함)
create or replace function public.create_tax_office_request(p_company_id uuid, p_month text, p_item_id uuid, p_body text)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v public.tax_office_members := private.my_tax_office_member();
  v_label text;
  v_id uuid;
  i public.expense_items;
begin
  if v.id is null then raise exception 'NOT_A_TAX_OFFICE_MEMBER' using errcode = '42501'; end if;
  perform private.require_tax_office_company(p_company_id);
  if p_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then raise exception 'INVALID_MONTH'; end if;
  if char_length(btrim(coalesce(p_body, ''))) not between 1 and 500 then raise exception 'INVALID_REQUEST'; end if;
  if p_item_id is not null then
    select * into i from public.expense_items where id = p_item_id and company_id = p_company_id;
    if i.id is null then raise exception 'NOT_FOUND'; end if;
    v_label := left(concat_ws(' · ', i.expense_date::text, i.merchant_name, case when i.amount is not null then to_char(i.amount, 'FM999,999,999,999') || '원' end), 200);
  end if;
  insert into public.tax_office_requests (company_id, office_id, month, item_id, item_label, body, requested_by_name, office_name)
  values (p_company_id, v.office_id, p_month, p_item_id, v_label, btrim(p_body), v.name, (select name from public.tax_offices where id = v.office_id))
  returning id into v_id;
  return v_id;
end;
$$;

-- 회사 관리자: 답변(상태 → 회사 답변)
create or replace function public.answer_tax_office_request(p_id uuid, p_answer text)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare v_admin public.members := private.require_admin();
begin
  if char_length(btrim(coalesce(p_answer, ''))) not between 1 and 500 then raise exception 'INVALID_REQUEST'; end if;
  update public.tax_office_requests
     set answer = btrim(p_answer), answered_by_name = v_admin.name, answered_at = now(), status = 'answered', resolved_at = null
   where id = p_id and company_id = v_admin.company_id and status <> 'resolved';
  if not found then raise exception 'NOT_FOUND'; end if;
end;
$$;

-- 세무사: 해결 / 다시 열기
create or replace function public.set_tax_office_request_status(p_id uuid, p_resolved boolean)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v public.tax_office_members := private.my_tax_office_member();
  r public.tax_office_requests;
begin
  if v.id is null then raise exception 'NOT_A_TAX_OFFICE_MEMBER' using errcode = '42501'; end if;
  select * into r from public.tax_office_requests where id = p_id;
  if r.id is null or not exists (select 1 from private.tax_office_company_ids() c where c = r.company_id) then raise exception 'NOT_FOUND'; end if;
  update public.tax_office_requests
     set status = case when p_resolved then 'resolved' when answer is not null then 'answered' else 'open' end,
         resolved_at = case when p_resolved then now() end
   where id = p_id;
end;
$$;

-- 마감 알림 받는 사람: 담당 세무사, 없으면 사무소 관리자들(서버가 부름)
create or replace function public.tax_office_notice_targets(p_company_id uuid)
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('member_id', m.id, 'name', m.name, 'phone', m.phone, 'office_name', o.name)), '[]'::jsonb)
    from public.company_tax_offices c
    join public.tax_offices o on o.id = c.office_id
    join public.tax_office_members m on m.office_id = c.office_id and m.status = 'active'
   where c.company_id = p_company_id and c.released_at is null
     and (m.id = c.assigned_member_id or (c.assigned_member_id is null and m.role = 'admin'));
$$;

revoke all on function public.create_tax_office_request(uuid, text, uuid, text), public.answer_tax_office_request(uuid, text), public.set_tax_office_request_status(uuid, boolean) from public, anon;
grant execute on function public.create_tax_office_request(uuid, text, uuid, text), public.answer_tax_office_request(uuid, text), public.set_tax_office_request_status(uuid, boolean) to authenticated;
revoke all on function public.tax_office_notice_targets(uuid) from public, anon, authenticated;
grant execute on function public.tax_office_notice_targets(uuid) to service_role;
