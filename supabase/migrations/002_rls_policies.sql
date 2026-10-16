-- =============================================================================
-- 002_rls_policies.sql — 권한 · RLS (기준: spec/data/schema.md §3, D-001 격리 원칙)
--   - anon/authenticated의 기본 권한을 모두 회수한 뒤 필요한 것만 명시적으로 부여 (기본 차단)
--   - 모든 테이블 RLS ENABLE + FORCE
--   - 회사 판별은 private 스키마의 SECURITY DEFINER 헬퍼로만 한다 (auth.uid() → members)
--   - 상태·금액·영수증 경로·계정과목 등 민감 칸은 컬럼 권한에서 제외 → 004의 서버 함수로만 변경
-- =============================================================================

-- 1. 기본 권한 회수 (현재 + 앞으로 만들 객체) ------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on functions from public, anon, authenticated;

-- 2. 헬퍼 (API로 노출되지 않는 private 스키마) ---------------------------------------
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

-- 현재 로그인 사용자의 '승인된' 멤버 id (pending/inactive면 null → 회사 데이터 접근 불가)
create or replace function private.current_member_id()
returns uuid
language sql stable security definer
set search_path = ''
as $$
  select m.id from public.members m
  where m.auth_user_id = (select auth.uid()) and m.status = 'approved'
$$;

create or replace function private.current_company_id()
returns uuid
language sql stable security definer
set search_path = ''
as $$
  select m.company_id from public.members m
  where m.auth_user_id = (select auth.uid()) and m.status = 'approved'
$$;

create or replace function private.is_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.members m
    where m.auth_user_id = (select auth.uid()) and m.status = 'approved' and m.role in ('super_admin', 'admin')
  )
$$;

create or replace function private.is_super_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.members m
    where m.auth_user_id = (select auth.uid()) and m.status = 'approved' and m.role = 'super_admin'
  )
$$;

-- 소명서 열람: 같은 회사 + (본인 | 관리자 이상 | 지정된 사전 검토자)
create or replace function private.can_view_claim(p_claim_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.expense_claims c
    where c.id = p_claim_id
      and c.company_id = private.current_company_id()
      and (
        c.member_id = private.current_member_id()
        or private.is_admin()
        or exists (
          select 1 from public.claim_approvals a
          where a.claim_id = c.id and a.approver_member_id = private.current_member_id()
        )
      )
  )
$$;

-- 소명서 편집: 같은 회사 + 본인 + draft/rejected
create or replace function private.can_edit_claim(p_claim_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.expense_claims c
    where c.id = p_claim_id
      and c.company_id = private.current_company_id()
      and c.member_id = private.current_member_id()
      and c.status in ('draft', 'rejected')
  )
$$;

revoke all on all functions in schema private from public, anon;
grant execute on function
  private.current_member_id(), private.current_company_id(), private.is_admin(), private.is_super_admin(),
  private.can_view_claim(uuid), private.can_edit_claim(uuid)
to authenticated;

-- 3. RLS 활성화 + 강제 ------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'billing_plans', 'companies', 'departments', 'members', 'member_invitations', 'member_bank_accounts',
    'form_templates', 'corporate_cards', 'account_titles', 'account_title_mappings', 'approval_lines',
    'approval_line_steps', 'expense_claims', 'expense_items', 'claim_approvals', 'credit_ledger',
    'monthly_closings', 'notification_logs'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
  end loop;
end;
$$;

-- 4. 테이블별 권한 + 정책 -----------------------------------------------------------

-- billing_plans: 공용 요금제(랜딩에서도 표시)
grant select on public.billing_plans to anon, authenticated;
create policy billing_plans_read on public.billing_plans for select to anon, authenticated using (true);

-- companies: 자기 회사만. 생성·초대코드·크레딧은 서버 함수로만
grant select on public.companies to authenticated;
grant update (name, business_number, meal_limit_per_person, meal_limit_mode, fuel_rate_per_km,
              claim_deadline_type, claim_deadline_days, event_bonus_acknowledged_at)
  on public.companies to authenticated;
create policy companies_select on public.companies for select to authenticated
  using (id = private.current_company_id());
create policy companies_update on public.companies for update to authenticated
  using (id = private.current_company_id() and private.is_admin())
  with check (id = private.current_company_id() and private.is_admin());

-- departments
grant select, insert, update, delete on public.departments to authenticated;
create policy departments_select on public.departments for select to authenticated
  using (company_id = private.current_company_id());
create policy departments_insert on public.departments for insert to authenticated
  with check (company_id = private.current_company_id() and private.is_admin());
create policy departments_update on public.departments for update to authenticated
  using (company_id = private.current_company_id() and private.is_admin())
  with check (company_id = private.current_company_id() and private.is_admin());
create policy departments_delete on public.departments for delete to authenticated
  using (company_id = private.current_company_id() and private.is_admin());

-- members: 같은 회사 멤버 + 본인 행(승인 대기 포함). 역할·상태·부서 변경은 서버 함수로만
grant select on public.members to authenticated;
grant update (name, phone, position, employee_number, vehicle_number) on public.members to authenticated;
create policy members_select on public.members for select to authenticated
  using (company_id = private.current_company_id() or auth_user_id = (select auth.uid()));
create policy members_update_self on public.members for update to authenticated
  using (auth_user_id = (select auth.uid()))
  with check (auth_user_id = (select auth.uid()));

-- member_invitations: 관리자 이상만
grant select, delete on public.member_invitations to authenticated;
grant insert (company_id, name, phone, department_id, position, invited_by_member_id) on public.member_invitations to authenticated;
grant update (name, phone, department_id, position, status) on public.member_invitations to authenticated;
create policy invitations_select on public.member_invitations for select to authenticated
  using (company_id = private.current_company_id() and private.is_admin());
create policy invitations_insert on public.member_invitations for insert to authenticated
  with check (company_id = private.current_company_id() and private.is_admin()
              and invited_by_member_id = private.current_member_id() and status = 'invited');
create policy invitations_update on public.member_invitations for update to authenticated
  using (company_id = private.current_company_id() and private.is_admin())
  with check (company_id = private.current_company_id() and private.is_admin() and status in ('invited', 'canceled'));
create policy invitations_delete on public.member_invitations for delete to authenticated
  using (company_id = private.current_company_id() and private.is_admin() and status <> 'accepted');

-- member_bank_accounts: 본인 + 같은 회사 관리자(열람만)
grant select, delete on public.member_bank_accounts to authenticated;
grant insert (member_id, company_id, bank_name, account_number, account_holder) on public.member_bank_accounts to authenticated;
grant update (bank_name, account_number, account_holder) on public.member_bank_accounts to authenticated;
create policy bank_select on public.member_bank_accounts for select to authenticated
  using (company_id = private.current_company_id()
         and (member_id = private.current_member_id() or private.is_admin()));
create policy bank_insert on public.member_bank_accounts for insert to authenticated
  with check (company_id = private.current_company_id() and member_id = private.current_member_id());
create policy bank_update on public.member_bank_accounts for update to authenticated
  using (company_id = private.current_company_id() and member_id = private.current_member_id())
  with check (company_id = private.current_company_id() and member_id = private.current_member_id());
create policy bank_delete on public.member_bank_accounts for delete to authenticated
  using (company_id = private.current_company_id() and member_id = private.current_member_id());

-- 회사 설정 테이블: 같은 회사 열람(계정과목은 관리자만), 쓰기는 관리자 이상
do $$
declare t text;
begin
  foreach t in array array['form_templates', 'corporate_cards', 'approval_lines', 'approval_line_steps'] loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('create policy %I on public.%I for select to authenticated using (company_id = private.current_company_id())', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (company_id = private.current_company_id() and private.is_admin())', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (company_id = private.current_company_id() and private.is_admin()) with check (company_id = private.current_company_id() and private.is_admin())', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (company_id = private.current_company_id() and private.is_admin())', t || '_delete', t);
  end loop;
  foreach t in array array['account_titles', 'account_title_mappings'] loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('create policy %I on public.%I for select to authenticated using (company_id = private.current_company_id() and private.is_admin())', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (company_id = private.current_company_id() and private.is_admin())', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (company_id = private.current_company_id() and private.is_admin()) with check (company_id = private.current_company_id() and private.is_admin())', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (company_id = private.current_company_id() and private.is_admin())', t || '_delete', t);
  end loop;
end;
$$;

-- expense_claims: 열람은 can_view_claim, 작성은 본인 draft/rejected만. 상태·합계·결재 칸은 서버 함수로만
grant select, delete on public.expense_claims to authenticated;
grant insert (company_id, member_id, form_template_id, title, description, is_business_trip, trip_destination,
              trip_start_date, trip_end_date, trip_purpose, header_custom_payload)
  on public.expense_claims to authenticated;
grant update (form_template_id, title, description, is_business_trip, trip_destination,
              trip_start_date, trip_end_date, trip_purpose, header_custom_payload)
  on public.expense_claims to authenticated;
create policy claims_select on public.expense_claims for select to authenticated
  using (private.can_view_claim(id));
create policy claims_insert on public.expense_claims for insert to authenticated
  with check (company_id = private.current_company_id() and member_id = private.current_member_id() and status = 'draft');
create policy claims_update on public.expense_claims for update to authenticated
  using (company_id = private.current_company_id() and member_id = private.current_member_id() and status in ('draft', 'rejected'))
  with check (company_id = private.current_company_id() and member_id = private.current_member_id() and status in ('draft', 'rejected'));
create policy claims_delete on public.expense_claims for delete to authenticated
  using (company_id = private.current_company_id() and member_id = private.current_member_id() and status = 'draft'
         and not exists (select 1 from public.expense_items i where i.claim_id = expense_claims.id and i.closed_month is not null));

-- expense_items: 영수증 경로·파싱 결과·카드 끝자리·계산값·계정과목·마감월은 서버 함수로만
grant select, delete on public.expense_items to authenticated;
grant insert (claim_id, company_id, sort_order, category, payment_method, evidence_type, expense_date, merchant_name,
              merchant_business_number, corporate_card_id, amount, supply_amount, vat_amount, headcount, purpose,
              attendees, client_name, trip_type, trip_start_date, trip_end_date, start_location, start_lat, start_lng,
              end_location, end_lat, end_lng, is_round_trip, distance_km, distance_source, item_custom_payload)
  on public.expense_items to authenticated;
grant update (sort_order, category, payment_method, evidence_type, expense_date, merchant_name,
              merchant_business_number, corporate_card_id, amount, supply_amount, vat_amount, headcount, purpose,
              attendees, client_name, trip_type, trip_start_date, trip_end_date, start_location, start_lat, start_lng,
              end_location, end_lat, end_lng, is_round_trip, distance_km, distance_source, item_custom_payload)
  on public.expense_items to authenticated;
create policy items_select on public.expense_items for select to authenticated
  using (company_id = private.current_company_id() and private.can_view_claim(claim_id));
create policy items_insert on public.expense_items for insert to authenticated
  with check (company_id = private.current_company_id() and private.can_edit_claim(claim_id));
create policy items_update on public.expense_items for update to authenticated
  using (company_id = private.current_company_id() and private.can_edit_claim(claim_id))
  with check (company_id = private.current_company_id() and private.can_edit_claim(claim_id));
create policy items_delete on public.expense_items for delete to authenticated
  using (company_id = private.current_company_id() and private.can_edit_claim(claim_id) and closed_month is null);

-- claim_approvals: 열람만 (변경은 서버 함수)
grant select on public.claim_approvals to authenticated;
create policy approvals_select on public.claim_approvals for select to authenticated
  using (company_id = private.current_company_id() and private.can_view_claim(claim_id));

-- 관리자 전용 열람 테이블 (쓰기는 서버 함수 / service role)
do $$
declare t text;
begin
  foreach t in array array['credit_ledger', 'monthly_closings', 'notification_logs'] loop
    execute format('grant select on public.%I to authenticated', t);
    execute format('create policy %I on public.%I for select to authenticated using (company_id = private.current_company_id() and private.is_admin())', t || '_select', t);
  end loop;
end;
$$;
