-- =============================================================================
-- 001_initial_schema.sql — PocketExpense 초기 스키마 (기준: spec/data/schema.md)
-- 회사 간 데이터 격리 원칙:
--   1) 회사 데이터 테이블은 모두 company_id NOT NULL
--   2) 회사 데이터끼리의 참조는 (id, company_id) 복합 외래키 → 다른 회사 행을 가리킬 수 없음
--   3) RLS/권한은 002, 저장소는 003, 상태 전이 함수는 004
-- =============================================================================

-- 0. 폐기한 초기 스키마 정리 (2026-10-16 확인: 모든 테이블 0건, 버킷 객체 0건)
drop table if exists public.expenses cascade;
drop table if exists public.users cascade;
drop table if exists public.companies cascade;
drop type if exists public.expense_status cascade;
drop type if exists public.expense_category cascade;
drop type if exists public.user_role cascade;
drop function if exists public.update_updated_at_column() cascade;

-- 1. 공통 트리거 함수
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 2. Enum
create type public.member_role as enum ('super_admin', 'admin', 'employee');
create type public.member_status as enum ('pending', 'approved', 'inactive');
create type public.claim_status as enum ('draft', 'submitted', 'approved', 'rejected', 'paid');
create type public.expense_category as enum ('meal', 'trip', 'meeting');
create type public.payment_method as enum ('corporate_card', 'personal_card');
create type public.trip_type as enum ('meal', 'public_transport', 'taxi', 'toll_parking', 'lodging', 'own_car', 'other');
create type public.distance_source as enum ('api', 'manual');
create type public.approval_step_kind as enum ('review', 'final');
create type public.approval_step_status as enum ('waiting', 'pending', 'approved', 'rejected', 'skipped', 'canceled');
create type public.meal_limit_mode as enum ('split', 'notify');
create type public.invitation_status as enum ('invited', 'accepted', 'canceled');
create type public.parse_status as enum ('none', 'parsing', 'success', 'failed');
create type public.notification_status as enum ('queued', 'sent', 'failed');
create type public.claim_deadline_type as enum ('none', 'end_of_month', 'days_after');
create type public.evidence_type as enum ('card_slip', 'cash_receipt', 'tax_invoice', 'simple_receipt', 'other');
create type public.billing_status as enum ('free_trial', 'active');

-- 3. 공용 데이터 ---------------------------------------------------------------
create table public.billing_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  monthly_price integer not null check (monthly_price >= 0),
  monthly_receipts integer not null check (monthly_receipts > 0),
  recommended_size text,
  sort_order integer not null default 0,
  is_purchasable boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4. 회사 ---------------------------------------------------------------------
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  business_number text check (business_number ~ '^[0-9]{10}$'),
  invite_code text not null unique check (invite_code ~ '^[A-HJ-NP-Z2-9]{8}$'),
  meal_limit_per_person integer not null default 10000 check (meal_limit_per_person >= 0),
  meal_limit_mode public.meal_limit_mode not null default 'split',
  fuel_rate_per_km integer not null default 200 check (fuel_rate_per_km >= 0),
  claim_deadline_type public.claim_deadline_type not null default 'none',
  claim_deadline_days integer check (claim_deadline_days between 1 and 90),
  billing_status public.billing_status not null default 'free_trial',
  receipt_credits_granted integer not null default 100 check (receipt_credits_granted >= 0),
  receipt_credits_used integer not null default 0 check (receipt_credits_used >= 0),
  last_event_bonus_at timestamptz,
  event_bonus_acknowledged_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint companies_credits_within_grant check (receipt_credits_used <= receipt_credits_granted),
  constraint companies_deadline_days_required check (claim_deadline_type <> 'days_after' or claim_deadline_days is not null)
);

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, name),
  unique (id, company_id)
);

-- 5. 멤버 ---------------------------------------------------------------------
create table public.members (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users (id) on delete restrict, -- 1계정 1회사 (D-004)
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  phone text not null check (phone ~ '^[0-9]{9,11}$'),
  email text,
  department_id uuid,
  position text,
  employee_number text,
  vehicle_number text,
  meal_limit_override integer check (meal_limit_override >= 0),
  role public.member_role not null default 'employee',
  status public.member_status not null default 'pending',
  joined_via text not null default 'shared_link' check (joined_via in ('shared_link', 'invitation', 'company_creation')),
  last_reminded_at timestamptz,
  privacy_agreed_at timestamptz not null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, company_id),
  foreign key (department_id, company_id) references public.departments (id, company_id) on delete set null (department_id)
);
create unique index members_one_super_admin_per_company on public.members (company_id) where role = 'super_admin';
create index members_company_idx on public.members (company_id);

create table public.member_invitations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  phone text check (phone ~ '^[0-9]{9,11}$'),
  department_id uuid,
  position text,
  token text not null unique default (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')) check (length(token) >= 32),
  status public.invitation_status not null default 'invited',
  invited_by_member_id uuid not null,
  accepted_member_id uuid,
  last_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (department_id, company_id) references public.departments (id, company_id) on delete set null (department_id),
  foreign key (invited_by_member_id, company_id) references public.members (id, company_id),
  foreign key (accepted_member_id, company_id) references public.members (id, company_id)
);

create table public.member_bank_accounts (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null unique,
  company_id uuid not null references public.companies (id) on delete cascade,
  bank_name text not null,
  account_number text not null,
  account_holder text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (member_id, company_id) references public.members (id, company_id) on delete cascade
);

-- 6. 회사 설정 ------------------------------------------------------------------
create table public.form_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  version integer not null check (version >= 1),
  schema jsonb not null,
  source_file_path text,
  ai_extracted_schema jsonb,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, version),
  unique (id, company_id)
);
create unique index form_templates_one_active on public.form_templates (company_id) where is_active;

create table public.corporate_cards (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  nickname text not null,
  last4 text not null check (last4 ~ '^[0-9]{4}$'), -- 카드번호 전체·유효기간·CVC는 저장하지 않는다 (D-055)
  holder_member_id uuid,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, company_id),
  foreign key (holder_member_id, company_id) references public.members (id, company_id) on delete set null (holder_member_id)
);
create unique index corporate_cards_active_last4 on public.corporate_cards (company_id, last4) where is_active;

create table public.account_titles (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  code text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, name),
  unique (id, company_id)
);

create table public.account_title_mappings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  category public.expense_category not null,
  trip_type public.trip_type,
  account_title_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint account_title_mappings_trip_type_only_for_trip check ((category = 'trip') = (trip_type is not null)),
  unique nulls not distinct (company_id, category, trip_type),
  foreign key (account_title_id, company_id) references public.account_titles (id, company_id)
);

create table public.approval_lines (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  department_id uuid, -- null = 회사 기본 결재라인
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (company_id, department_id),
  unique (id, company_id),
  foreign key (department_id, company_id) references public.departments (id, company_id) on delete cascade
);

create table public.approval_line_steps (
  id uuid primary key default gen_random_uuid(),
  approval_line_id uuid not null,
  company_id uuid not null references public.companies (id) on delete cascade,
  step_order integer not null check (step_order between 1 and 4),
  approver_member_id uuid not null, -- 사전 검토자 (D-039)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (approval_line_id, step_order),
  unique (approval_line_id, approver_member_id),
  foreign key (approval_line_id, company_id) references public.approval_lines (id, company_id) on delete cascade,
  foreign key (approver_member_id, company_id) references public.members (id, company_id)
);

-- 7. 지출소명서 / 영수증 항목 -----------------------------------------------------
create table public.expense_claims (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  member_id uuid not null,
  form_template_id uuid,
  title text not null default '',
  description text,
  is_business_trip boolean not null default false,
  trip_destination text,
  trip_start_date date,
  trip_end_date date,
  trip_purpose text,
  status public.claim_status not null default 'draft',
  header_custom_payload jsonb not null default '{}',
  item_count integer not null default 0,
  total_amount integer not null default 0,
  total_company_supported integer not null default 0,
  total_personal_burden integer not null default 0,
  self_approved boolean not null default false,
  settlement_required boolean,
  current_round integer not null default 0,
  rejection_reason text,
  submitted_at timestamptz,
  approved_at timestamptz,
  rejected_at timestamptz,
  paid_at timestamptz,
  paid_by_member_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint expense_claims_trip_dates check (trip_end_date is null or trip_start_date is null or trip_end_date >= trip_start_date),
  unique (id, company_id),
  foreign key (member_id, company_id) references public.members (id, company_id),
  foreign key (form_template_id, company_id) references public.form_templates (id, company_id),
  foreign key (paid_by_member_id, company_id) references public.members (id, company_id)
);
create index expense_claims_company_status_idx on public.expense_claims (company_id, status);
create index expense_claims_member_idx on public.expense_claims (member_id);

create table public.expense_items (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null,
  company_id uuid not null references public.companies (id) on delete cascade,
  sort_order integer not null default 0,
  category public.expense_category,
  payment_method public.payment_method not null default 'corporate_card',
  evidence_type public.evidence_type,
  expense_date date,
  merchant_name text,
  merchant_business_number text check (merchant_business_number ~ '^[0-9]{10}$'),
  card_last4 text check (card_last4 ~ '^[0-9]{4}$'),
  corporate_card_id uuid,
  amount integer check (amount >= 0),
  supply_amount integer check (supply_amount >= 0),
  vat_amount integer check (vat_amount >= 0),
  headcount integer check (headcount >= 1),
  applied_meal_limit_per_person integer,
  applied_meal_limit_mode public.meal_limit_mode,
  company_supported_amount integer check (company_supported_amount >= 0),
  personal_burden_amount integer not null default 0 check (personal_burden_amount >= 0),
  purpose text,
  attendees text,
  client_name text,
  receipt_path text,
  parse_status public.parse_status not null default 'none',
  ai_parsed_payload jsonb,
  credit_charged boolean not null default false,
  trip_type public.trip_type,
  trip_start_date date,
  trip_end_date date,
  start_location text,
  start_lat numeric,
  start_lng numeric,
  end_location text,
  end_lat numeric,
  end_lng numeric,
  is_round_trip boolean,
  distance_km numeric(8, 1) check (distance_km >= 0),
  distance_source public.distance_source,
  applied_fuel_rate_per_km integer,
  item_custom_payload jsonb not null default '{}',
  account_title_id uuid,
  account_title_name text,
  account_title_code text,
  account_title_overridden boolean not null default false,
  closed_month text check (closed_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- 영수증 경로는 반드시 자기 회사 폴더 아래 (저장소 격리와 이중 방어)
  constraint expense_items_receipt_path_in_company check (receipt_path is null or receipt_path like company_id::text || '/%'),
  constraint expense_items_trip_type_only_for_trip check (trip_type is null or category = 'trip'),
  unique (id, company_id),
  foreign key (claim_id, company_id) references public.expense_claims (id, company_id) on delete cascade,
  foreign key (corporate_card_id, company_id) references public.corporate_cards (id, company_id) on delete set null (corporate_card_id),
  foreign key (account_title_id, company_id) references public.account_titles (id, company_id) on delete set null (account_title_id)
);
create index expense_items_claim_idx on public.expense_items (claim_id);
create index expense_items_company_date_idx on public.expense_items (company_id, expense_date);

create table public.claim_approvals (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null,
  company_id uuid not null references public.companies (id) on delete cascade,
  round integer not null check (round >= 1),
  step_order integer not null check (step_order >= 1),
  step_kind public.approval_step_kind not null,
  approver_member_id uuid, -- review: 지정 검토자 / final: null(청구자 제외 관리자 이상)
  acted_by_member_id uuid,
  status public.approval_step_status not null,
  comment text,
  flagged_item_ids uuid[] not null default '{}',
  acted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint claim_approvals_review_has_approver check ((step_kind = 'review') = (approver_member_id is not null)),
  unique (claim_id, round, step_order),
  foreign key (claim_id, company_id) references public.expense_claims (id, company_id) on delete cascade,
  foreign key (approver_member_id, company_id) references public.members (id, company_id),
  foreign key (acted_by_member_id, company_id) references public.members (id, company_id)
);
create index claim_approvals_pending_idx on public.claim_approvals (company_id, status) where status = 'pending';

-- 8. 크레딧 / 마감 / 알림 ---------------------------------------------------------
create table public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  delta integer not null check (delta <> 0),
  reason text not null check (reason in ('free_trial_grant', 'receipt_upload', 'event_bonus')),
  item_id uuid,
  member_id uuid,
  created_at timestamptz not null default now(),
  foreign key (item_id, company_id) references public.expense_items (id, company_id) on delete set null (item_id),
  foreign key (member_id, company_id) references public.members (id, company_id) on delete set null (member_id)
);
create index credit_ledger_company_idx on public.credit_ledger (company_id, created_at desc);

create table public.monthly_closings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  year_month text not null check (year_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  status text not null check (status in ('closed', 'reopened')),
  closed_at timestamptz,
  closed_by_member_id uuid,
  reopened_at timestamptz,
  reopened_by_member_id uuid,
  reopen_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, year_month),
  foreign key (closed_by_member_id, company_id) references public.members (id, company_id),
  foreign key (reopened_by_member_id, company_id) references public.members (id, company_id)
);

create table public.notification_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  claim_id uuid,
  recipient_member_id uuid,
  invitation_id uuid references public.member_invitations (id) on delete set null,
  recipient_phone text not null,
  template_code text not null check (template_code in ('APPROVAL_REQUEST', 'APPROVAL_COMPLETED', 'APPROVAL_REJECTED', 'PAYOUT_COMPLETED', 'INVITE', 'REMINDER')),
  payload jsonb not null default '{}',
  status public.notification_status not null default 'queued',
  provider text not null,
  provider_message_id text,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (claim_id, company_id) references public.expense_claims (id, company_id) on delete set null (claim_id),
  foreign key (recipient_member_id, company_id) references public.members (id, company_id) on delete set null (recipient_member_id)
);
create index notification_logs_company_idx on public.notification_logs (company_id, created_at desc);

-- 9. updated_at 트리거 -----------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'billing_plans', 'companies', 'departments', 'members', 'member_invitations', 'member_bank_accounts',
    'form_templates', 'corporate_cards', 'account_titles', 'account_title_mappings', 'approval_lines',
    'approval_line_steps', 'expense_claims', 'expense_items', 'claim_approvals', 'monthly_closings', 'notification_logs'
  ] loop
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
  end loop;
end;
$$;
