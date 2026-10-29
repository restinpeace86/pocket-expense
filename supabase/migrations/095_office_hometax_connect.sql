-- =============================================================================
-- 095_office_hometax_connect.sql — 사무소도 홈택스 자료 올리기(D-172) · 세무사무소 연결 코드 초대(D-173) · 정기 결제 보정(D-171)
-- D-172(사용자 결정 2026-10-29): 세무대리 수임으로 홈택스 자료를 직접 받는 사무소도 고객사 달별 [홈택스 자료]에 올린다.
--   회사·사무소가 올린 파일이 같은 목록에 쌓이고 누가 올렸는지 표시. 지우기는 올린 쪽만.
-- D-173: 회사가 세무사무소를 지정하면 그 회사 전용 연결 코드가 생기고, 알림톡·안내 링크(/for-tax-office/코드)로 들어온 사무소 관리자는
--   어떤 계정(이메일)으로 로그인했든 그 고객사와 연결된다. 사무소를 바꾸면(이메일·이름) 코드가 새로 바뀌어 예전 링크는 못 쓴다.
-- D-171 보정: 개인카드 정기 결제 알림은 결제일 당일에만, 같은 기간 판단은 월(연) 단위
-- =============================================================================

-- ── D-172 ────────────────────────────────────────────────────────────────────
alter table public.hometax_uploads add column uploaded_by_kind text not null default 'company' check (uploaded_by_kind in ('company', 'tax_office'));

create or replace function public.add_hometax_upload_office(p_company_id uuid, p_month text, p_kind text, p_file_path text, p_file_name text, p_file_size integer, p_header jsonb, p_preview jsonb, p_row_count integer, p_memo text)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v public.tax_office_members := private.my_tax_office_member();
  v_id uuid;
begin
  if v.id is null then raise exception 'NOT_A_TAX_OFFICE_MEMBER' using errcode = '42501'; end if;
  perform private.require_tax_office_company(p_company_id);
  if p_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then raise exception 'INVALID_MONTH'; end if;
  if split_part(coalesce(p_file_path, ''), '/', 1) <> p_company_id::text then raise exception 'INVALID_HOMETAX'; end if;
  if (select count(*) from public.hometax_uploads where company_id = p_company_id and month = p_month) >= 30 then raise exception 'HOMETAX_LIMIT'; end if;
  begin
    insert into public.hometax_uploads (company_id, month, kind, file_path, file_name, file_size, header, preview, row_count, memo, uploaded_by_name, uploaded_by_kind)
    values (p_company_id, p_month, p_kind, p_file_path, left(p_file_name, 200), p_file_size, coalesce(p_header, '[]'::jsonb), coalesce(p_preview, '[]'::jsonb),
            greatest(coalesce(p_row_count, 0), 0), nullif(btrim(coalesce(p_memo, '')), ''),
            v.name || ' (' || (select name from public.tax_offices where id = v.office_id) || ')', 'tax_office')
    returning id into v_id;
  exception when check_violation then
    raise exception 'INVALID_HOMETAX';
  end;
  return v_id;
end;
$$;

create or replace function public.delete_hometax_upload_office(p_id uuid)
returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  v public.tax_office_members := private.my_tax_office_member();
  v_path text;
begin
  if v.id is null then raise exception 'NOT_A_TAX_OFFICE_MEMBER' using errcode = '42501'; end if;
  delete from public.hometax_uploads
   where id = p_id and uploaded_by_kind = 'tax_office' and company_id in (select private.tax_office_company_ids())
  returning file_path into v_path;
  if v_path is null then raise exception 'NOT_FOUND'; end if;
  return v_path;
end;
$$;

-- 회사 관리자는 회사가 올린 것만 지운다
create or replace function public.delete_hometax_upload(p_id uuid)
returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  v_admin public.members := private.require_admin();
  v_path text;
begin
  delete from public.hometax_uploads where id = p_id and company_id = v_admin.company_id and uploaded_by_kind = 'company' returning file_path into v_path;
  if v_path is null then raise exception 'NOT_FOUND'; end if;
  return v_path;
end;
$$;
revoke all on function public.add_hometax_upload_office(uuid, text, text, text, text, integer, jsonb, jsonb, integer, text), public.delete_hometax_upload_office(uuid) from public, anon;
grant execute on function public.add_hometax_upload_office(uuid, text, text, text, text, integer, jsonb, jsonb, integer, text), public.delete_hometax_upload_office(uuid) to authenticated;

-- ── D-173 ────────────────────────────────────────────────────────────────────
create or replace function private.gen_connect_code()
returns text
language plpgsql volatile security definer
set search_path = ''
as $$
declare v text;
begin
  loop
    v := array_to_string(array(select substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1) from generate_series(1, 10)), '');
    exit when not exists (select 1 from public.company_tax_offices where connect_code = v);
  end loop;
  return v;
end;
$$;
revoke all on function private.gen_connect_code() from public, anon, authenticated;

alter table public.company_tax_offices add column connect_code text unique check (connect_code is null or connect_code ~ '^[A-Z2-9]{10}$');
update public.company_tax_offices set connect_code = private.gen_connect_code() where connect_code is null;

create or replace function private.company_tax_office_code()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.connect_code is null or new.office_email is distinct from old.office_email or new.office_name is distinct from old.office_name then
    new.connect_code := private.gen_connect_code();
  end if;
  return new;
end;
$$;
revoke all on function private.company_tax_office_code() from public, anon, authenticated;
create trigger company_tax_offices_code before insert or update on public.company_tax_offices
  for each row execute function private.company_tax_office_code();

-- 안내 페이지(로그인 전에도): 코드로 고객사·사무소 이름만
create or replace function public.tax_office_connect_info(p_code text)
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select jsonb_build_object('company_name', co.name, 'office_name', c.office_name, 'agent_name', c.agent_name, 'connected', c.office_id is not null)
    from public.company_tax_offices c join public.companies co on co.id = c.company_id
   where c.connect_code = upper(btrim(coalesce(p_code, ''))) and c.released_at is null;
$$;
revoke all on function public.tax_office_connect_info(text) from public;
grant execute on function public.tax_office_connect_info(text) to anon, authenticated;

-- 사무소 관리자: 코드로 고객사 연결. 이미 다른 사무소와 연결된 회사는 막는다. 돌려주는 값: 회사 id
create or replace function public.connect_tax_office_by_code(p_code text)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v public.tax_office_members := private.require_tax_office_admin();
  c public.company_tax_offices;
begin
  select * into c from public.company_tax_offices where connect_code = upper(btrim(coalesce(p_code, ''))) and released_at is null for update;
  if c.company_id is null then raise exception 'INVALID_CONNECT_CODE'; end if;
  if c.office_id is not null and c.office_id <> v.office_id then raise exception 'ALREADY_CONNECTED'; end if;
  if c.office_id is null then
    update public.company_tax_offices set office_id = v.office_id, updated_at = now() where company_id = c.company_id;
  end if;
  return c.company_id;
end;
$$;
revoke all on function public.connect_tax_office_by_code(text) from public, anon;
grant execute on function public.connect_tax_office_by_code(text) to authenticated;

-- 회사 화면: 연결 코드(초대 링크용)
create or replace function public.my_company_tax_office_code()
returns text
language sql stable security definer
set search_path = ''
as $$
  select c.connect_code from public.company_tax_offices c
   where c.company_id = private.current_company_id() and private.is_admin() and c.released_at is null;
$$;
revoke all on function public.my_company_tax_office_code() from public, anon;
grant execute on function public.my_company_tax_office_code() to authenticated;

-- ── D-171 보정 ───────────────────────────────────────────────────────────────
create or replace function public.recurring_personal_due(p_today date default ((now() at time zone 'Asia/Seoul')::date))
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  r record;
  v_period date;
  v_out jsonb := '[]'::jsonb;
begin
  for r in
    select p.* from public.recurring_payments p
      join public.members m on m.id = p.assignee_member_id and m.company_id = p.company_id and m.status = 'approved'
     where p.is_active and p.payment_method = 'personal_card'
  loop
    v_period := private.recurring_due_period(r.cycle, r.billing_day, r.billing_month, r.starts_on, p_today);
    continue when v_period is distinct from p_today; -- 결제일 당일에만
    v_out := v_out || jsonb_build_object('recurring_id', r.id, 'company_id', r.company_id, 'member_id', r.assignee_member_id, 'service_name', r.service_name, 'amount', r.amount,
                                         'period_label', case when r.cycle = 'monthly' then to_char(v_period, 'FMYYYY"년" FMMM"월"') else to_char(v_period, 'FMYYYY"년"') end);
  end loop;
  return v_out;
end;
$$;

create or replace function public.create_recurring_claim_from_card(p_recurring_id uuid, p_date date, p_merchant text, p_amount integer, p_last4 text)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_admin public.members := private.require_admin();
  r public.recurring_payments;
  v_period date;
  v_label text;
  v_claim uuid;
begin
  select * into r from public.recurring_payments where id = p_recurring_id and company_id = v_admin.company_id;
  if r.id is null then raise exception 'NOT_FOUND'; end if;
  if p_date is null or p_amount is null or p_amount < 1 then raise exception 'CARD_ROW_MISMATCH'; end if;
  if not exists (select 1 from public.members where id = r.assignee_member_id and company_id = r.company_id and status = 'approved') then raise exception 'ASSIGNEE_INACTIVE'; end if;
  v_period := case when r.cycle = 'monthly' then date_trunc('month', p_date)::date else date_trunc('year', p_date)::date end;
  -- 예전 방식(결제일 날짜로 저장)과 함께 월(연) 단위로 본다
  if exists (select 1 from public.expense_claims where recurring_payment_id = r.id
               and date_trunc(case when r.cycle = 'monthly' then 'month' else 'year' end, recurring_period)::date = v_period) then raise exception 'RECURRING_ALREADY'; end if;
  v_label := case when r.cycle = 'monthly' then to_char(v_period, 'FMYYYY"년" FMMM"월"') else to_char(v_period, 'FMYYYY"년"') end;
  insert into public.expense_claims (company_id, member_id, title, description, category, default_payment_method, recurring_payment_id, recurring_period)
  values (r.company_id, r.assignee_member_id,
          left('[온라인 SaaS 구독료] ' || r.service_name || ' ' || v_label, 100),
          left(r.service_name || ' ' || v_label || ' 정기 결제 구독료(카드 내역으로 결제 확인)', 1000),
          'saas', 'corporate_card', r.id, v_period)
  returning id into v_claim;
  insert into public.expense_items (claim_id, company_id, sort_order, category, payment_method, corporate_card_id, evidence_type, evidence_kind, evidence_substitute,
                                    expense_date, merchant_name, amount, headcount, parse_status, purpose)
  values (v_claim, r.company_id, 1, 'saas', 'corporate_card', r.corporate_card_id, 'card_slip', 'card_history',
          jsonb_build_object('source', 'card_statement', 'date', p_date, 'merchant', left(coalesce(p_merchant, ''), 100), 'amount', p_amount,
                             'last4', case when p_last4 ~ '^[0-9]{4}$' then p_last4 end, 'by', v_admin.name, 'at', now(), 'recurring', r.service_name),
          p_date, left(coalesce(nullif(btrim(p_merchant), ''), r.service_name), 100), p_amount, 1, 'none', left(r.service_name || ' ' || v_label || ' 구독료', 200));
  perform private.recompute_claim(v_claim);
  return v_claim;
end;
$$;
