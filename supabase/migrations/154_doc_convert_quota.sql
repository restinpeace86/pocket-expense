-- =============================================================================
-- 154_doc_convert_quota.sql — 서류 → 엑셀 변환 플랜별 월 무료 횟수 (9-21, D-265)
-- 사용자 결정(2026-11-13, 개선사항 1 문서 값 그대로): 스타터 월 20건 · 프로 월 100건 · 비즈니스 무제한*(공정 사용 월 1,000건)
-- - 변환 한 번 = 1건(쪽 수와 상관없음). 한도 안에서는 크레딧이 빠지지 않는다
-- - 한도를 넘으면 지금처럼 크레딧(1쪽 1크레딧)으로 계속. 크레딧도 없으면 CONVERT_LIMIT(다음 달 1일 다시)
-- - AI가 표를 못 찾아 돌려주면(doc_convert_fail) 그 건은 세지 않는다 — 지워도 다시 세지 않게 달별 횟수 표를 따로 둔다
-- - 결제 연동 전이라 회사에 요금제가 없다 → 새 기능의 플랜 값은 private.effective_plan()(지금 = 프로) 하나로 정한다.
--   (양식 칸 140과 같은 방식. 저장 공간 108·134는 그대로 스타터 기준)
-- =============================================================================

alter table public.billing_plans
  add column monthly_doc_converts integer check (monthly_doc_converts is null or monthly_doc_converts >= 0),
  add column doc_converts_unlimited boolean not null default false;
update public.billing_plans set
  monthly_doc_converts = case code when 'starter' then 20 when 'standard' then 100 when 'pro' then 1000 end,
  doc_converts_unlimited = (code = 'pro'),
  updated_at = now()
where code in ('starter', 'standard', 'pro');

-- 회사에 적용되는 요금제(결제 연동 전: 모두 프로). 결제가 붙으면 이 함수만 바꾼다
create or replace function private.effective_plan(p_company uuid)
returns public.billing_plans
language sql stable security definer
set search_path = ''
as $$
  select * from public.billing_plans where code = 'standard'
$$;
revoke all on function private.effective_plan(uuid) from public, anon, authenticated;

create or replace function private.kst_month(p_at timestamptz)
returns text
language sql immutable
set search_path = ''
as $$
  select to_char(p_at at time zone 'Asia/Seoul', 'YYYY-MM')
$$;
revoke all on function private.kst_month(timestamptz) from public, anon, authenticated;

-- 달별 무료 변환 횟수(지워도 줄지 않게 따로 센다). 직접 읽기·쓰기 없음 — 함수로만
create table public.doc_convert_counts (
  company_id uuid not null references public.companies (id) on delete cascade,
  month text not null check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  used integer not null default 0 check (used >= 0),
  primary key (company_id, month)
);
alter table public.doc_convert_counts enable row level security;
alter table public.doc_convert_counts force row level security;
revoke all on public.doc_convert_counts from anon, authenticated;

alter table public.doc_conversions add column free boolean not null default false;

-- 변환 시작: 이번 달 무료 횟수 안이면 크레딧 없이(free), 넘으면 쪽 수만큼 크레딧(모자라면 CONVERT_LIMIT)
create or replace function public.doc_convert_begin(p_id uuid, p_member uuid, p_name text, p_mime text, p_path text, p_pages integer, p_message uuid)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_member public.members;
  v_company public.companies;
  v_plan public.billing_plans;
  v_name text := left(coalesce(nullif(trim(p_name), ''), '서류'), 255);
  v_month text := private.kst_month(now());
  v_used integer;
  v_free boolean;
begin
  select * into v_member from public.members where id = p_member and status = 'approved';
  if v_member.id is null then raise exception 'NOT_FOUND'; end if;
  if p_pages is null or p_pages not between 1 and 5 then raise exception 'TOO_MANY_PAGES'; end if;
  if p_path is null or split_part(p_path, '/', 1) <> v_member.company_id::text or split_part(p_path, '/', 2) <> v_member.id::text then
    raise exception 'INVALID_FILE';
  end if;
  select * into v_company from public.companies where id = v_member.company_id for update;
  v_plan := private.effective_plan(v_company.id);
  insert into public.doc_convert_counts (company_id, month) values (v_company.id, v_month) on conflict do nothing;
  select used into v_used from public.doc_convert_counts where company_id = v_company.id and month = v_month for update;
  v_free := v_used < coalesce(v_plan.monthly_doc_converts, 0);
  if v_free then
    update public.doc_convert_counts set used = used + 1 where company_id = v_company.id and month = v_month;
  else
    if v_company.receipt_credits_granted - v_company.receipt_credits_used < p_pages then raise exception 'CONVERT_LIMIT'; end if;
    update public.companies set receipt_credits_used = receipt_credits_used + p_pages where id = v_company.id;
    insert into public.credit_ledger (company_id, delta, reason, member_id, note)
    values (v_member.company_id, -p_pages, 'doc_convert', v_member.id, format('%s (%s쪽)', v_name, p_pages));
  end if;
  insert into public.doc_conversions (id, company_id, member_id, name, mime, source_path, source_message_id, pages, credits, free)
  values (p_id, v_member.company_id, v_member.id, v_name, p_mime, p_path, p_message, p_pages, case when v_free then 0 else p_pages end, v_free);
  return jsonb_build_object('id', p_id, 'free', v_free);
end;
$$;

-- 변환 실패: 크레딧이면 돌려주고, 무료 건이면 그 달 횟수에서 뺀다
create or replace function public.doc_convert_fail(p_id uuid)
returns text
language plpgsql security definer
set search_path = ''
as $$
declare v_row public.doc_conversions;
begin
  select * into v_row from public.doc_conversions where id = p_id and status = 'reading' for update;
  if v_row.id is null then return null; end if;
  if v_row.credits > 0 then
    update public.companies set receipt_credits_used = greatest(0, receipt_credits_used - v_row.credits) where id = v_row.company_id;
    insert into public.credit_ledger (company_id, delta, reason, member_id, note)
    values (v_row.company_id, v_row.credits, 'doc_convert_refund', v_row.member_id, format('%s — 표를 못 찾아 돌려줌', v_row.name));
  end if;
  if v_row.free then
    update public.doc_convert_counts set used = greatest(0, used - 1)
     where company_id = v_row.company_id and month = private.kst_month(v_row.created_at);
  end if;
  delete from public.doc_conversions where id = p_id;
  return v_row.source_path;
end;
$$;

-- 관리자: 이번 달 서류 변환 무료 횟수(요금제 화면). 직원은 부르지 못함(숫자를 보여 주지 않음)
create or replace function public.doc_convert_quota()
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_admin public.members := private.require_admin();
  v_plan public.billing_plans := private.effective_plan(v_admin.company_id);
begin
  return jsonb_build_object(
    'month', private.kst_month(now()),
    'used', coalesce((select used from public.doc_convert_counts where company_id = v_admin.company_id and month = private.kst_month(now())), 0),
    'limit', coalesce(v_plan.monthly_doc_converts, 0),
    'unlimited', v_plan.doc_converts_unlimited,
    'plan', v_plan.name
  );
end;
$$;

revoke all on function public.doc_convert_begin(uuid, uuid, text, text, text, integer, uuid), public.doc_convert_fail(uuid) from public, anon, authenticated;
grant execute on function public.doc_convert_begin(uuid, uuid, text, text, text, integer, uuid), public.doc_convert_fail(uuid) to service_role;
revoke all on function public.doc_convert_quota() from public, anon;
grant execute on function public.doc_convert_quota() to authenticated;
