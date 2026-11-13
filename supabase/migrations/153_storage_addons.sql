-- =============================================================================
-- 153_storage_addons.sql — 저장 공간 추가(8-103, D-248 → D-262)
-- - storage_addons: 상품 10/25/50/100GB · 월 1만/2만/3.5만/4만 원(VAT 별도). 랜딩·요금제가 같은 표를 읽는다(누구나 읽기)
-- - companies.extra_storage_gb: 지금 켜진 추가 공간(0 = 없음). 한 회사에 하나(크기 바꾸기)
-- - 추가 공간은 채팅 첨부와 파일 보관함이 함께 쓴다: 각자 기본 한도를 먼저 쓰고, 넘는 만큼 추가 공간에서
-- - 결제가 꺼진 동안: 관리자 [신청] → 운영자가 켜 줌(storage_requests). 결제가 붙을 때까지 무료(사용자 2026-11-12)
-- - 스타터 대상 문구: "1인 사업자"는 직원이 올리고 관리자가 결재하는 구조와 안 맞아 → 직원 10명 이하(최대 인원과 같게)
-- =============================================================================

update public.billing_plans set recommended_size = '직원 10명 이하 작은 회사·현장 팀', updated_at = now() where code = 'starter';

create table public.storage_addons (
  code text primary key check (code ~ '^[a-z0-9_]{2,20}$'),
  storage_gb integer not null unique check (storage_gb between 1 and 1000),
  monthly_price integer not null check (monthly_price > 0),
  sort_order integer not null default 0,
  is_active boolean not null default true
);
alter table public.storage_addons enable row level security;
alter table public.storage_addons force row level security;
revoke all on public.storage_addons from anon, authenticated;
grant select on public.storage_addons to anon, authenticated;
create policy storage_addons_read on public.storage_addons for select to anon, authenticated using (is_active);
insert into public.storage_addons (code, storage_gb, monthly_price, sort_order) values
  ('gb10', 10, 10000, 1), ('gb25', 25, 20000, 2), ('gb50', 50, 35000, 3), ('gb100', 100, 40000, 4);

alter table public.companies add column extra_storage_gb integer not null default 0 check (extra_storage_gb between 0 and 1000);

-- 신청: add = 새로 켜기, change = 크기 바꾸기, cancel = 해지. 회사마다 처리 전 신청은 하나
create table public.storage_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  member_id uuid,
  requested_by_name text,
  kind text not null check (kind in ('add', 'change', 'cancel')),
  storage_gb integer not null check (storage_gb between 0 and 1000), -- 바라는 추가 공간(해지 = 0)
  monthly_price integer not null default 0 check (monthly_price >= 0), -- 신청 때 가격(표가 바뀌어도 남게)
  status text not null default 'received' check (status in ('received', 'done', 'rejected', 'canceled')),
  reject_reason text check (char_length(reject_reason) <= 200),
  created_at timestamptz not null default now(),
  done_at timestamptz,
  foreign key (member_id, company_id) references public.members (id, company_id) on delete set null (member_id)
);
create unique index storage_requests_one_open on public.storage_requests (company_id) where status = 'received';
create index storage_requests_created on public.storage_requests (created_at desc);
alter table public.storage_requests enable row level security;
alter table public.storage_requests force row level security;
revoke all on public.storage_requests from anon, authenticated;
grant select on public.storage_requests to authenticated;
create policy storage_requests_select on public.storage_requests for select to authenticated
  using (company_id = (select private.current_company_id()) and (select private.is_admin()));

-- ── 한도: 함께 쓰는 추가 공간 ───────────────────────────────────────────────
-- 기본 한도는 지금처럼 스타터 기준(결제 연동 때 회사 요금제로). 상대가 기본을 넘겨 쓴 만큼 추가 공간에서 빠진다
create or replace function private.storage_extra_bytes(p_company uuid)
returns bigint
language sql stable security definer
set search_path = ''
as $$
  select coalesce((select extra_storage_gb from public.companies where id = p_company), 0)::bigint * 1024 * 1024 * 1024
$$;
create or replace function private.chat_storage_base(p_company uuid)
returns bigint
language sql stable security definer
set search_path = ''
as $$
  select coalesce((select chat_storage_mb from public.billing_plans where code = 'starter'), 1024)::bigint * 1024 * 1024
$$;
create or replace function private.vault_base(p_company uuid)
returns bigint
language sql stable security definer
set search_path = ''
as $$
  select coalesce((select vault_storage_mb from public.billing_plans where code = 'starter'), 1024)::bigint * 1024 * 1024
$$;
create or replace function private.chat_storage_limit(p_company uuid)
returns bigint
language plpgsql stable security definer
set search_path = ''
as $$
declare v_extra bigint := private.storage_extra_bytes(p_company); v_base bigint := private.chat_storage_base(p_company);
begin
  if v_extra = 0 then return v_base; end if;
  return v_base + greatest(0, v_extra - greatest(0, private.vault_used(p_company) - private.vault_base(p_company)));
end;
$$;
create or replace function private.vault_limit(p_company uuid)
returns bigint
language plpgsql stable security definer
set search_path = ''
as $$
declare v_extra bigint := private.storage_extra_bytes(p_company); v_base bigint := private.vault_base(p_company);
begin
  if v_extra = 0 then return v_base; end if;
  return v_base + greatest(0, v_extra - greatest(0, private.chat_storage_used(p_company) - private.chat_storage_base(p_company)));
end;
$$;

-- ── 관리자 ────────────────────────────────────────────────────────────────
-- 요금제 화면: 지금 추가 공간·처리 전 신청
create or replace function public.storage_addon_status()
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare v_admin public.members := private.require_admin(); r public.storage_requests;
begin
  select * into r from public.storage_requests where company_id = v_admin.company_id and status = 'received';
  return jsonb_build_object(
    'extra_gb', (select extra_storage_gb from public.companies where id = v_admin.company_id),
    'pending', case when r.id is null then null else jsonb_build_object('id', r.id, 'kind', r.kind, 'storage_gb', r.storage_gb, 'monthly_price', r.monthly_price, 'created_at', r.created_at, 'by', r.requested_by_name) end,
    'last', (select jsonb_build_object('status', s.status, 'storage_gb', s.storage_gb, 'reject_reason', s.reject_reason, 'done_at', s.done_at)
             from public.storage_requests s where s.company_id = v_admin.company_id and s.status in ('done', 'rejected') order by s.done_at desc nulls last limit 1),
    'chat_used', private.chat_storage_used(v_admin.company_id), 'chat_limit', private.chat_storage_limit(v_admin.company_id),
    'vault_used', private.vault_used(v_admin.company_id), 'vault_limit', private.vault_limit(v_admin.company_id));
end;
$$;

-- 신청: p_gb = 바라는 추가 공간(0 = 해지). 지금과 같으면 거절, 처리 전 신청이 있으면 거절(먼저 취소)
create or replace function public.storage_addon_request(p_gb integer)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare v_admin public.members := private.require_admin(); v_now integer; v_price integer := 0; v_id uuid;
begin
  select extra_storage_gb into v_now from public.companies where id = v_admin.company_id;
  if p_gb is null or p_gb = v_now then raise exception 'SAME_AS_NOW'; end if;
  if p_gb > 0 then
    select monthly_price into v_price from public.storage_addons where storage_gb = p_gb and is_active;
    if v_price is null then raise exception 'NO_SUCH_ADDON'; end if;
  end if;
  if exists (select 1 from public.storage_requests where company_id = v_admin.company_id and status = 'received') then raise exception 'ALREADY_REQUESTED'; end if;
  insert into public.storage_requests (company_id, member_id, requested_by_name, kind, storage_gb, monthly_price)
  values (v_admin.company_id, v_admin.id, v_admin.name, case when p_gb = 0 then 'cancel' when v_now = 0 then 'add' else 'change' end, p_gb, v_price)
  returning id into v_id;
  return v_id;
end;
$$;

-- 처리 전 신청 취소
create or replace function public.storage_addon_withdraw()
returns void
language plpgsql security definer
set search_path = ''
as $$
declare v_admin public.members := private.require_admin();
begin
  update public.storage_requests set status = 'canceled', done_at = now() where company_id = v_admin.company_id and status = 'received';
end;
$$;

-- ── 운영자(서버 키만) ─────────────────────────────────────────────────────
-- 켜기: 신청한 크기로 바꾸고 처리. 돌려주는 값 = 회사·신청한 사람(알림용)
create or replace function public.storage_addon_grant(p_request uuid)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare r public.storage_requests;
begin
  select * into r from public.storage_requests where id = p_request for update;
  if r.id is null then raise exception 'NOT_FOUND'; end if;
  if r.status <> 'received' then raise exception 'NOT_PENDING'; end if;
  update public.companies set extra_storage_gb = r.storage_gb where id = r.company_id;
  update public.storage_requests set status = 'done', done_at = now() where id = r.id;
  return jsonb_build_object('company_id', r.company_id, 'member_id', r.member_id, 'storage_gb', r.storage_gb, 'kind', r.kind);
end;
$$;

create or replace function public.storage_addon_reject(p_request uuid, p_reason text)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare r public.storage_requests;
begin
  if p_reason is null or char_length(btrim(p_reason)) not between 1 and 200 then raise exception 'REASON_REQUIRED'; end if;
  select * into r from public.storage_requests where id = p_request for update;
  if r.id is null then raise exception 'NOT_FOUND'; end if;
  if r.status <> 'received' then raise exception 'NOT_PENDING'; end if;
  update public.storage_requests set status = 'rejected', reject_reason = btrim(p_reason), done_at = now() where id = r.id;
  return jsonb_build_object('company_id', r.company_id, 'member_id', r.member_id, 'storage_gb', r.storage_gb, 'kind', r.kind);
end;
$$;

revoke all on function private.storage_extra_bytes(uuid), private.chat_storage_base(uuid), private.vault_base(uuid) from public, anon, authenticated;
revoke all on function public.storage_addon_status(), public.storage_addon_request(integer), public.storage_addon_withdraw() from public, anon;
grant execute on function public.storage_addon_status(), public.storage_addon_request(integer), public.storage_addon_withdraw() to authenticated;
revoke all on function public.storage_addon_grant(uuid), public.storage_addon_reject(uuid, text) from public, anon, authenticated;
