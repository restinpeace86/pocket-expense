-- =============================================================================
-- 158_storage_total.sql — 요금표 개편: 회사 공용 저장 공간(누적 합산) + 인원 한도 없애기 + 플랜 비교표 값 (9-26, D-271)
-- 사용자 결정(2026-11-13 비교표): 공용 10GB·50GB·200GB(회사 전체 누적 합산 한도) / 영수증 150·400·무제한*(공정 1,000) /
--   서류 변환 20·100·300건 / 회사 양식 결의서만·AI 양식 변환 최대 5개·무제한(도입 시 지원) — 양식 추가 1장 2만 원 폐기 /
--   예산 –·✓·✓ / 삭제 복구 30·90·365일 / 고객 지원 채팅·채팅·우선 응대+채팅
-- 사용자 결정(2026-11-13): "파일 영구 보관 1GB · 사내 채팅 사진·파일 저장 1GB 합쳐 — 스타터 10GB · 프로 20GB · 비즈니스 40GB"
--   "영수증 올리는 직원 최대 10명 빼 — 스타터를 11명에서 시작할 수도 있잖아"
-- - billing_plans.storage_mb = 회사 공용 저장 공간(채팅 사진·파일 + 파일 보관함 + 휴지통). 예전 칸(chat/vault_storage_mb)은 남겨 둠(안 씀)
-- - 한도 = 요금제 공간 + 추가 공간(D-262). 채팅·보관함은 같은 통을 함께 쓴다: 한쪽 한도 = 전체 − 다른 쪽이 쓴 양
-- - 결제 연동 전에는 지금처럼 스타터 기준(= 10GB, 예전 1GB+1GB보다 넓어짐)
-- - max_members = 모두 null(제한 없음). 인원으로 막는 곳은 원래 없었고 표시만 바뀜(D-270)
-- =============================================================================

alter table public.billing_plans add column storage_mb integer check (storage_mb is null or storage_mb > 0);
alter table public.billing_plans
  add column form_slots_unlimited boolean not null default false,
  add column support_label text check (support_label is null or char_length(support_label) <= 40);
update public.billing_plans set
  storage_mb = case code when 'starter' then 10240 when 'standard' then 51200 when 'pro' then 204800 end,
  max_members = null,
  monthly_receipts = case code when 'pro' then 1000 else monthly_receipts end,
  is_unlimited = (code = 'pro'),
  monthly_doc_converts = case code when 'starter' then 20 when 'standard' then 100 when 'pro' then 300 end,
  doc_converts_unlimited = false,
  form_slots = case code when 'starter' then 0 when 'standard' then 5 when 'pro' then 50 end,
  form_slots_unlimited = (code = 'pro'),
  support_label = case code when 'pro' then '우선 응대 + 채팅' else '채팅' end,
  updated_at = now()
where code in ('starter', 'standard', 'pro');

-- 회사 양식 칸: 무제한 플랜이면 사실상 제한 없음(1,000). 결제 연동 전 = 프로(5장). 이미 운영자가 늘려 준 추가 칸은 그대로 더함
create or replace function private.form_slot_limit(p_company uuid)
returns integer
language sql stable security definer
set search_path = ''
as $$
  select case when (private.effective_plan(p_company)).form_slots_unlimited then 1000
              else coalesce((private.effective_plan(p_company)).form_slots, 0) end
       + coalesce((select extra_form_slots from public.companies where id = p_company), 0)
$$;

-- 회사 공용 저장 공간 전체(바이트) = 요금제(지금은 스타터) + 추가 공간
create or replace function private.storage_total_limit(p_company uuid)
returns bigint
language sql stable security definer
set search_path = ''
as $$
  select coalesce((select storage_mb from public.billing_plans where code = 'starter'), 10240)::bigint * 1024 * 1024 + private.storage_extra_bytes(p_company)
$$;
revoke all on function private.storage_total_limit(uuid) from public, anon, authenticated;

create or replace function private.chat_storage_limit(p_company uuid)
returns bigint
language sql stable security definer
set search_path = ''
as $$
  select greatest(0, private.storage_total_limit(p_company) - private.vault_used(p_company))
$$;
create or replace function private.vault_limit(p_company uuid)
returns bigint
language sql stable security definer
set search_path = ''
as $$
  select greatest(0, private.storage_total_limit(p_company) - private.chat_storage_used(p_company))
$$;

-- 요금제 화면: 전체 한도·사용량도
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
    'vault_used', private.vault_used(v_admin.company_id), 'vault_limit', private.vault_limit(v_admin.company_id),
    'total_used', private.chat_storage_used(v_admin.company_id) + private.vault_used(v_admin.company_id),
    'total_limit', private.storage_total_limit(v_admin.company_id));
end;
$$;
