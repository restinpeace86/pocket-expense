-- =============================================================================
-- 102_tax_requests_unified.sql — 확인 요청 하나로 (D-196, 8-45)
-- 사용자 결정(2026-11-01): 채팅이 아니라 "영수증(또는 달)에 붙는 확인 요청" 하나 — 질문 한 줄·답 한 줄·[확인함].
-- 회사 '세무사 확인 요청'(D-156, expense_items.tax_review_*)과 사무소 '자료 요청'(D-169, tax_office_requests)을 같은 표로.
-- - origin: 누가 시작했나(office / company). unread_for: 아직 안 본 쪽(상대가 쓰거나 바꾸면 그쪽, 열어 보면 비움)
-- - 회사 영수증 요청은 기존 칸(tax_review_*)을 그대로 쓰고 트리거가 확인 요청 표와 맞춘다 — 세무 엑셀 '확인 필요'·결재 화면은 그대로
-- - 답하기는 받은 쪽, [확인함]·다시 열기는 양쪽
-- =============================================================================

alter table public.tax_office_requests
  add column origin text not null default 'office' check (origin in ('office', 'company')),
  add column unread_for text check (unread_for in ('office', 'company'));
update public.tax_office_requests set unread_for = case status when 'open' then 'company' when 'answered' then 'office' end;
create index tax_office_requests_unread_idx on public.tax_office_requests (company_id, unread_for) where unread_for is not null;

-- 영수증 이름표(날짜 · 가맹점 · 금액)
create or replace function private.item_request_label(i public.expense_items)
returns text
language sql immutable
set search_path = ''
as $$
  select left(concat_ws(' · ', i.expense_date::text, i.merchant_name, case when i.amount is not null then to_char(i.amount, 'FM999,999,999,999') || '원' end), 200)
$$;

-- 기존 회사 영수증 요청을 확인 요청 표로
insert into public.tax_office_requests (company_id, office_id, month, item_id, item_label, body, requested_by_name, office_name, origin, status, resolved_at, unread_for, created_at)
select i.company_id, c.office_id, to_char(i.expense_date, 'YYYY-MM'), i.id, private.item_request_label(i), left(i.tax_review_request, 500),
       i.tax_review_requested_by, o.name, 'company',
       case when i.tax_review_resolved_at is not null then 'resolved' else 'open' end, i.tax_review_resolved_at,
       case when i.tax_review_resolved_at is null then 'office' end, coalesce(i.tax_review_requested_at, now())
  from public.expense_items i
  left join public.company_tax_offices c on c.company_id = i.company_id and c.released_at is null
  left join public.tax_offices o on o.id = c.office_id
 where i.tax_review_request is not null;

-- 영수증 칸(tax_review_*) → 확인 요청 표: 새로 쓰거나 고치면 열린 요청(회사 시작), 지우면 열린 요청 삭제, 처리되면(세무사가 계정과목을 고르거나 [이대로 확인]) 확인함
create or replace function private.item_review_to_request()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare v_office uuid; v_office_name text;
begin
  if new.tax_review_request is not null and new.tax_review_request is distinct from old.tax_review_request then
    update public.tax_office_requests
       set body = left(new.tax_review_request, 500), requested_by_name = new.tax_review_requested_by, status = 'open', answer = null,
           answered_by_name = null, answered_at = null, resolved_at = null, unread_for = 'office', item_label = private.item_request_label(new)
     where item_id = new.id and origin = 'company' and status <> 'resolved';
    if not found then
      select c.office_id, o.name into v_office, v_office_name
        from public.company_tax_offices c left join public.tax_offices o on o.id = c.office_id
       where c.company_id = new.company_id and c.released_at is null;
      insert into public.tax_office_requests (company_id, office_id, month, item_id, item_label, body, requested_by_name, office_name, origin, unread_for)
      values (new.company_id, v_office, to_char(new.expense_date, 'YYYY-MM'), new.id, private.item_request_label(new), left(new.tax_review_request, 500),
              new.tax_review_requested_by, v_office_name, 'company', 'office');
    end if;
  elsif new.tax_review_request is null and old.tax_review_request is not null then
    delete from public.tax_office_requests where item_id = new.id and origin = 'company' and status <> 'resolved';
  end if;
  if new.tax_review_resolved_at is not null and old.tax_review_resolved_at is null then
    update public.tax_office_requests set status = 'resolved', resolved_at = now(), unread_for = 'company'
     where item_id = new.id and origin = 'company' and status <> 'resolved';
  end if;
  return null;
end;
$$;
revoke all on function private.item_review_to_request() from public, anon, authenticated;
create trigger expense_items_review_request after update of tax_review_request, tax_review_resolved_at on public.expense_items
  for each row execute function private.item_review_to_request();

-- 확인 요청 표 → 영수증 칸: 회사 시작 영수증 요청을 [확인함]하면 영수증도 처리됨(엑셀 '확인 필요'에서 빠짐), 다시 열면 처리 전으로
create or replace function private.request_to_item_review()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if new.origin = 'company' and new.item_id is not null and new.status is distinct from old.status then
    if new.status = 'resolved' then
      update public.expense_items set tax_review_resolved_at = now() where id = new.item_id and tax_review_request is not null and tax_review_resolved_at is null;
    elsif old.status = 'resolved' then
      update public.expense_items set tax_review_resolved_at = null where id = new.item_id and tax_review_resolved_at is not null;
    end if;
  end if;
  return null;
end;
$$;
revoke all on function private.request_to_item_review() from public, anon, authenticated;
create trigger tax_office_requests_item_review after update of status on public.tax_office_requests
  for each row execute function private.request_to_item_review();

-- 세무사무소가 시작: 받는 쪽(회사)이 안 본 상태로
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
    v_label := private.item_request_label(i);
  end if;
  insert into public.tax_office_requests (company_id, office_id, month, item_id, item_label, body, requested_by_name, office_name, origin, unread_for)
  values (p_company_id, v.office_id, p_month, p_item_id, v_label, btrim(p_body), v.name, (select name from public.tax_offices where id = v.office_id), 'office', 'company')
  returning id into v_id;
  return v_id;
end;
$$;

-- 회사가 시작(달 전체 또는 영수증). 영수증이면 기존 영수증 칸에 써서 트리거가 요청을 만든다(엑셀 '확인 필요'와 같은 길)
create or replace function public.create_company_tax_request(p_month text, p_item_id uuid, p_body text)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_admin public.members := private.require_admin();
  v_office uuid;
  v_office_name text;
  v_body text := btrim(coalesce(p_body, ''));
  v_id uuid;
begin
  select c.office_id, o.name into v_office, v_office_name
    from public.company_tax_offices c join public.tax_offices o on o.id = c.office_id
   where c.company_id = v_admin.company_id and c.released_at is null;
  if v_office is null then raise exception 'NO_TAX_OFFICE'; end if;
  if p_month is null or p_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then raise exception 'INVALID_MONTH'; end if;
  if p_item_id is not null then
    if char_length(v_body) not between 1 and 200 then raise exception 'INVALID_TEXT_LENGTH'; end if;
    update public.expense_items
       set tax_review_request = v_body, tax_review_requested_by = v_admin.name, tax_review_requested_at = now(), tax_review_resolved_at = null, updated_at = now()
     where id = p_item_id and company_id = v_admin.company_id;
    if not found then raise exception 'NOT_FOUND'; end if;
    select id into v_id from public.tax_office_requests where item_id = p_item_id and origin = 'company' and status <> 'resolved' order by created_at desc limit 1;
    return v_id;
  end if;
  if char_length(v_body) not between 1 and 500 then raise exception 'INVALID_REQUEST'; end if;
  insert into public.tax_office_requests (company_id, office_id, month, body, requested_by_name, office_name, origin, unread_for)
  values (v_admin.company_id, v_office, p_month, v_body, v_admin.name, v_office_name, 'company', 'office')
  returning id into v_id;
  return v_id;
end;
$$;

-- 회사가 답함(세무사무소가 시작한 요청만) → 사무소가 안 본 상태
create or replace function public.answer_tax_office_request(p_id uuid, p_answer text)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare v_admin public.members := private.require_admin();
begin
  if char_length(btrim(coalesce(p_answer, ''))) not between 1 and 500 then raise exception 'INVALID_REQUEST'; end if;
  update public.tax_office_requests
     set answer = btrim(p_answer), answered_by_name = v_admin.name, answered_at = now(), status = 'answered', resolved_at = null, unread_for = 'office'
   where id = p_id and company_id = v_admin.company_id and origin = 'office' and status <> 'resolved';
  if not found then raise exception 'NOT_FOUND'; end if;
end;
$$;

-- 세무사무소가 답함(회사가 시작한 요청만) → 회사가 안 본 상태
create or replace function public.office_answer_tax_request(p_id uuid, p_answer text)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v public.tax_office_members := private.my_tax_office_member();
  r public.tax_office_requests;
begin
  if v.id is null then raise exception 'NOT_A_TAX_OFFICE_MEMBER' using errcode = '42501'; end if;
  if char_length(btrim(coalesce(p_answer, ''))) not between 1 and 500 then raise exception 'INVALID_REQUEST'; end if;
  select * into r from public.tax_office_requests where id = p_id;
  if r.id is null or r.origin <> 'company' or r.status = 'resolved' or not exists (select 1 from private.tax_office_company_ids() c where c = r.company_id) then
    raise exception 'NOT_FOUND';
  end if;
  update public.tax_office_requests
     set answer = btrim(p_answer), answered_by_name = v.name, answered_at = now(), status = 'answered', unread_for = 'company'
   where id = p_id;
end;
$$;

-- 세무사무소: [확인함] / 다시 열기 → 회사가 안 본 상태
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
         resolved_at = case when p_resolved then now() end,
         unread_for = 'company'
   where id = p_id;
end;
$$;

-- 회사 관리자: [확인함] / 다시 열기 → 사무소가 안 본 상태
create or replace function public.company_set_tax_request_status(p_id uuid, p_resolved boolean)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare v_admin public.members := private.require_admin();
begin
  update public.tax_office_requests
     set status = case when p_resolved then 'resolved' when answer is not null then 'answered' else 'open' end,
         resolved_at = case when p_resolved then now() end,
         unread_for = 'office'
   where id = p_id and company_id = v_admin.company_id;
  if not found then raise exception 'NOT_FOUND'; end if;
end;
$$;

-- 열어 봤음: 그 회사의 내 쪽 안 읽음 표시를 지운다(사무소 구성원이면 office, 그 회사 관리자면 company)
create or replace function public.mark_tax_requests_seen(p_company_id uuid)
returns integer
language plpgsql security definer
set search_path = ''
as $$
declare v_side text; n integer;
begin
  if (select auth.uid()) is null then raise exception 'NOT_AUTHENTICATED' using errcode = '42501'; end if;
  if exists (select 1 from private.tax_office_company_ids() c where c = p_company_id) then v_side := 'office';
  elsif private.current_company_id() = p_company_id and private.is_admin() then v_side := 'company';
  else raise exception 'NOT_FOUND';
  end if;
  update public.tax_office_requests set unread_for = null where company_id = p_company_id and unread_for = v_side;
  get diagnostics n = row_count;
  return n;
end;
$$;

-- 고객사 현황(D-193)에 안 읽은 확인 요청 수
create or replace function public.tax_office_client_status(p_month text)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
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
             'unread', (select count(*) from public.tax_office_requests r where r.company_id = c.id and r.unread_for = 'office')))
      from public.companies c
      left join public.monthly_closings mc on mc.company_id = c.id and mc.year_month = p_month
     where c.id in (select private.tax_office_company_ids())
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.create_company_tax_request(text, uuid, text), public.office_answer_tax_request(uuid, text), public.company_set_tax_request_status(uuid, boolean), public.mark_tax_requests_seen(uuid) from public, anon;
grant execute on function public.create_company_tax_request(text, uuid, text), public.office_answer_tax_request(uuid, text), public.company_set_tax_request_status(uuid, boolean), public.mark_tax_requests_seen(uuid) to authenticated;
