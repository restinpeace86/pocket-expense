-- =============================================================================
-- 075_tax_agents.sql — 담당 세무사(외부 열람자) 연결 (todo_improvement 개선사항 2, D-148)
-- - 세무사는 회사 멤버가 아니다. 한 계정은 한 회사에만(D-004)은 멤버 소속 규칙이고, 세무사 연결은 별도라 여러 회사와 이어질 수 있다
-- - 회사 관리자가 [설정 › 담당 세무사]에 사무소명·담당자·이메일(·연락처)을 넣으면, 그 이메일(확인된 이메일)로 로그인한 계정이
--   승인 절차 없이 바로 그 회사의 세무 자료를 본다. 이메일을 바꾸거나 연결을 끊으면 이전 계정은 바로 못 본다(회사당 1명)
-- - 세무사가 볼 수 있는 것: 세무 마감과 같은 행(승인·지급된 지출만, tax_month_export와 같은 함수) + 계정과목·분류 연결
-- - 세무사가 할 수 있는 것: 계정과목 추가·이름·코드 수정, 분류→계정과목 연결 변경(삭제·마감·결재는 못 함)
-- =============================================================================

create table public.tax_agent_links (
  company_id uuid primary key references public.companies (id) on delete cascade,
  office_name text not null check (char_length(office_name) between 1 and 100),
  agent_name text not null check (char_length(agent_name) between 1 and 50),
  agent_email text not null check (agent_email = lower(agent_email) and agent_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' and char_length(agent_email) <= 254),
  agent_phone text check (agent_phone is null or agent_phone ~ '^0[0-9]{8,10}$'),
  updated_by_member_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (updated_by_member_id, company_id) references public.members (id, company_id) on delete set null (updated_by_member_id)
);
create index tax_agent_links_email_idx on public.tax_agent_links (agent_email);

alter table public.tax_agent_links enable row level security;
alter table public.tax_agent_links force row level security;
revoke all on public.tax_agent_links from anon, authenticated;
grant select on public.tax_agent_links to authenticated;
-- 자기 회사 관리자만 본다. 쓰기는 함수로만
create policy tax_agent_links_select on public.tax_agent_links for select to authenticated
  using (company_id = (select private.current_company_id()) and (select private.is_admin()));

-- 로그인한 계정의 확인된 이메일(소문자). 확인 안 된 이메일은 연결에 쓰지 않는다
create or replace function private.current_verified_email()
returns text
language sql stable security definer
set search_path = ''
as $$
  select lower(u.email) from auth.users u
   where u.id = (select auth.uid()) and u.email is not null and u.email_confirmed_at is not null
$$;

-- 이 계정이 담당 세무사로 연결된 회사들
create or replace function private.tax_agent_company_ids()
returns setof uuid
language sql stable security definer
set search_path = ''
as $$
  select l.company_id from public.tax_agent_links l where l.agent_email = (select private.current_verified_email())
$$;

create or replace function private.require_tax_agent(p_company uuid)
returns void
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then raise exception 'NOT_AUTHENTICATED' using errcode = '42501'; end if;
  if p_company is null or not exists (select 1 from private.tax_agent_company_ids() c where c = p_company) then
    raise exception 'NOT_FOUND';
  end if;
end;
$$;
revoke all on function private.current_verified_email(), private.tax_agent_company_ids(), private.require_tax_agent(uuid) from public, anon, authenticated;
-- RLS 정책(계정과목)이 호출하므로 로그인 사용자에게 실행 권한(자기 이메일로 연결된 회사 id만 돌려준다)
grant execute on function private.tax_agent_company_ids() to authenticated;

-- 관리자: 담당 세무사 저장(넣기·바꾸기)
create or replace function public.set_tax_agent(p_office_name text, p_agent_name text, p_agent_email text, p_agent_phone text)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_admin public.members := private.require_admin();
  v_office text := btrim(coalesce(p_office_name, ''));
  v_name text := btrim(coalesce(p_agent_name, ''));
  v_email text := lower(btrim(coalesce(p_agent_email, '')));
  v_phone text := nullif(regexp_replace(coalesce(p_agent_phone, ''), '[^0-9]', '', 'g'), '');
begin
  if char_length(v_office) not between 1 and 100 then raise exception 'INVALID_TAX_OFFICE'; end if;
  if char_length(v_name) not between 1 and 50 then raise exception 'INVALID_TAX_AGENT_NAME'; end if;
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' or char_length(v_email) > 254 then raise exception 'INVALID_TAX_AGENT_EMAIL'; end if;
  if v_phone is not null and v_phone !~ '^0[0-9]{8,10}$' then raise exception 'INVALID_TAX_AGENT_PHONE'; end if;
  insert into public.tax_agent_links (company_id, office_name, agent_name, agent_email, agent_phone, updated_by_member_id)
  values (v_admin.company_id, v_office, v_name, v_email, v_phone, v_admin.id)
  on conflict (company_id) do update
     set office_name = excluded.office_name, agent_name = excluded.agent_name, agent_email = excluded.agent_email,
         agent_phone = excluded.agent_phone, updated_by_member_id = excluded.updated_by_member_id, updated_at = now();
end;
$$;

-- 관리자: 연결 끊기
create or replace function public.clear_tax_agent()
returns void
language plpgsql security definer
set search_path = ''
as $$
declare v_admin public.members := private.require_admin();
begin
  delete from public.tax_agent_links where company_id = v_admin.company_id;
end;
$$;
revoke all on function public.set_tax_agent(text, text, text, text), public.clear_tax_agent() from public, anon;
grant execute on function public.set_tax_agent(text, text, text, text), public.clear_tax_agent() to authenticated;

-- 세무사: 담당 회사 목록(다른 고객사가 같은 이메일을 넣으면 자동으로 늘어난다)
create or replace function public.my_tax_agent_companies()
returns table (company_id uuid, company_name text, business_number text, office_name text, agent_name text, linked_at timestamptz)
language sql stable security definer
set search_path = ''
as $$
  select c.id, c.name, c.business_number, l.office_name, l.agent_name, l.updated_at
    from public.tax_agent_links l
    join public.companies c on c.id = l.company_id
   where l.agent_email = (select private.current_verified_email())
   order by c.name
$$;
revoke all on function public.my_tax_agent_companies() from public, anon;
grant execute on function public.my_tax_agent_companies() to authenticated;

-- 세무 마감 대상 항목(회사 id를 받는 버전). public.tax_month_items와 같은 규칙
create or replace function private.tax_month_items_for(p_company uuid, p_month text)
returns table (item_id uuid, kind text, seq integer, closed boolean)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if p_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then raise exception 'INVALID_MONTH'; end if;
  if exists (select 1 from public.monthly_closings where company_id = p_company and year_month = p_month and status = 'closed') then
    return query select i.id, i.closing_kind, i.closing_seq, true from public.expense_items i
                  where i.company_id = p_company and i.closed_month = p_month order by i.closing_seq;
  else
    return query select t.item_id, t.kind, t.seq, false from private.tax_month_pending_items(p_company, p_month) t order by t.seq;
  end if;
end;
$$;

create or replace function private.tax_month_export_for(p_company uuid, p_month text)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_closing public.monthly_closings;
  v_rows jsonb;
  v_excluded jsonb;
begin
  if p_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then raise exception 'INVALID_MONTH'; end if;
  select * into v_closing from public.monthly_closings where company_id = p_company and year_month = p_month;

  with target as (
    select t.item_id, t.kind, t.seq from private.tax_month_items_for(p_company, p_month) t
  ), appr as (
    -- 결의서 마지막 회차의 승인 단계: "김팀장(10/12) → 이대표(10/13)"
    select a.claim_id,
           string_agg(coalesce(m.name, '?') || '(' || to_char(a.acted_at at time zone 'Asia/Seoul', 'FMMM/FMDD') || ')', ' → ' order by a.step_order) as approvers
      from public.claim_approvals a
      join public.expense_claims c on c.id = a.claim_id and a.round = c.current_round
      left join public.members m on m.id = a.acted_by_member_id
     where a.company_id = p_company and a.status = 'approved'
     group by a.claim_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'seq', t.seq, 'kind', t.kind,
           'claim_id', c.id, 'claim_title', c.title, 'claim_description', c.description, 'exception_memo', c.exception_memo,
           'is_trip', c.is_business_trip, 'trip_destination', c.trip_destination, 'trip_start', c.trip_start_date, 'trip_end', c.trip_end_date, 'trip_purpose', c.trip_purpose,
           'claim_status', c.status, 'self_approved', c.self_approved, 'submitted_at', c.submitted_at, 'approved_at', c.approved_at, 'paid_at', c.paid_at,
           'approvers', ap.approvers, 'header_custom', c.header_custom_payload) || jsonb_build_object(
           'item_id', i.id, 'expense_date', i.expense_date, 'merchant_name', i.merchant_name, 'merchant_business_number', i.merchant_business_number,
           'evidence_type', i.evidence_type, 'supply_amount', i.supply_amount, 'vat_amount', i.vat_amount, 'amount', i.amount,
           'payment_method', i.payment_method, 'card_nickname', cc.nickname, 'card_last4', coalesce(cc.last4, i.card_last4),
           'account_title_name', i.account_title_name, 'account_title_code', i.account_title_code,
           'category', i.category, 'trip_type', i.trip_type, 'purchase_type', i.purchase_type,
           'department', d.name, 'member_name', m.name, 'position', m.position, 'employee_number', m.employee_number, 'vehicle_number', m.vehicle_number,
           'purpose', i.purpose, 'headcount', i.headcount, 'attendees', i.attendees, 'client_name', i.client_name,
           'lodging_in', i.trip_start_date, 'lodging_out', i.trip_end_date,
           'start_location', i.start_location, 'end_location', i.end_location, 'is_round_trip', i.is_round_trip,
           'route_one_way_km', i.route_one_way_km, 'distance_km', i.distance_km, 'distance_source', i.distance_source,
           'applied_meal_limit_per_person', i.applied_meal_limit_per_person, 'applied_fuel_rate_per_km', i.applied_fuel_rate_per_km,
           'company_supported_amount', i.company_supported_amount, 'personal_burden_amount', i.personal_burden_amount,
           'receipt_path', i.receipt_path, 'route_card_path', i.route_card_path) || jsonb_build_object('item_custom', i.item_custom_payload,
           'evidence_kind', coalesce(i.evidence_kind::text, case when i.receipt_path is not null then 'receipt' end), 'no_evidence_reason', i.no_evidence_reason,
           'applied_fuel_mode', i.applied_fuel_mode, 'applied_fuel_price', i.applied_fuel_price, 'applied_fuel_type', i.applied_fuel_type
         ) order by t.seq), '[]'::jsonb)
    into v_rows
    from target t
    join public.expense_items i on i.id = t.item_id
    join public.expense_claims c on c.id = i.claim_id
    join public.members m on m.id = c.member_id
    left join public.departments d on d.id = m.department_id
    left join public.corporate_cards cc on cc.id = i.corporate_card_id
    left join appr ap on ap.claim_id = c.id;

  select jsonb_build_object(
           'draft', count(*) filter (where c.status = 'draft'),
           'submitted', count(*) filter (where c.status = 'submitted'),
           'rejected', count(*) filter (where c.status = 'rejected'),
           'claims', count(distinct c.id))
    into v_excluded
    from public.expense_items i
    join public.expense_claims c on c.id = i.claim_id
   where i.company_id = p_company and c.status in ('draft', 'submitted', 'rejected')
     and to_char(i.expense_date, 'YYYY-MM') = p_month;

  return jsonb_build_object(
    'month', p_month,
    'status', case when v_closing.status = 'closed' then 'closed' else 'pending' end,
    'closed_at', v_closing.closed_at,
    'reopened_at', v_closing.reopened_at,
    'reopen_reason', v_closing.reopen_reason,
    'rows', v_rows,
    'excluded', v_excluded);
end;
$$;

revoke all on function private.tax_month_items_for(uuid, text), private.tax_month_export_for(uuid, text) from public, anon, authenticated;

-- 관리자 세무 마감: 같은 private 함수를 쓴다(결과 그대로)
create or replace function public.tax_month_export(p_month text)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare v_admin public.members := private.require_admin();
begin
  return private.tax_month_export_for(v_admin.company_id, p_month);
end;
$$;

-- 세무사: 연결된 회사만
create or replace function public.tax_agent_month_export(p_company_id uuid, p_month text)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
begin
  perform private.require_tax_agent(p_company_id);
  return private.tax_month_export_for(p_company_id, p_month);
end;
$$;
revoke all on function public.tax_agent_month_export(uuid, text) from public, anon;
grant execute on function public.tax_agent_month_export(uuid, text) to authenticated;

-- 세무사: 연결된 회사의 계정과목·분류 연결을 보고 고친다(추가·수정만, 삭제 없음)
create policy account_titles_tax_agent_select on public.account_titles for select to authenticated
  using (company_id in (select private.tax_agent_company_ids()));
create policy account_titles_tax_agent_insert on public.account_titles for insert to authenticated
  with check (company_id in (select private.tax_agent_company_ids()));
create policy account_titles_tax_agent_update on public.account_titles for update to authenticated
  using (company_id in (select private.tax_agent_company_ids())) with check (company_id in (select private.tax_agent_company_ids()));
create policy account_title_mappings_tax_agent_select on public.account_title_mappings for select to authenticated
  using (company_id in (select private.tax_agent_company_ids()));
create policy account_title_mappings_tax_agent_insert on public.account_title_mappings for insert to authenticated
  with check (company_id in (select private.tax_agent_company_ids()));
create policy account_title_mappings_tax_agent_update on public.account_title_mappings for update to authenticated
  using (company_id in (select private.tax_agent_company_ids())) with check (company_id in (select private.tax_agent_company_ids()));
