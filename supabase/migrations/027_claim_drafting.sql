-- =============================================================================
-- 027_claim_drafting.sql — 지출소명서 작성(T6 묶음 A) 서버 함수
-- 기준: spec/features/expense-claim-flow.md, receipt-parser.md, smart-meal.md, expense-lifecycle.md §1·§5, worker-tax-processing.md
--   - 소명서 결제수단 기본값(default_payment_method): 새 항목에 적용 (expense-claim-flow.md §3 Step 1)
--   - create_receipt_item: 영수증 항목을 먼저 만들고 저장 경로를 서버가 정한다(첫 폴더 = 회사). 소명서당 최대 30건
--   - apply_receipt_parse: AI 인식 결과를 "빈 칸에만" 채우고, 카드 끝 4자리로 법인카드 판별(D-055)
--   - refresh_claim_totals: 항목 금액(식대 1인 한도 × 인원수, 절사/자율 승인, 개인별 한도, 한도 없이 전액)과 소명서 합계를 서버에서 다시 계산
--   - my_employee_summary: 직원 메인 요약(사비 정산 대기금, 반려 건수, 회사 남은 무료 영수증)
-- 격리: 모든 함수는 호출자 본인의 작성 가능한 소명서(can_edit_claim)만 다룬다. 다른 사람·다른 회사 소명서는 NOT_FOUND.
-- =============================================================================

alter table public.expense_claims
  add column default_payment_method public.payment_method not null default 'corporate_card';
grant insert (default_payment_method), update (default_payment_method) on public.expense_claims to authenticated;

-- 항목 하나의 회사 지원금·개인 부담금 (expense-lifecycle.md §5.1·§5.2, smart-meal.md §3, D-040·D-041·D-044·D-068)
create or replace function private.item_amounts(
  p_category public.expense_category,
  p_trip_type public.trip_type,
  p_amount integer,
  p_headcount integer,
  p_company public.companies,
  p_member_override integer,
  out supported integer,
  out burden integer,
  out applied_limit integer,
  out applied_mode public.meal_limit_mode
)
language plpgsql immutable
set search_path = ''
as $$
declare v_limit integer;
begin
  supported := p_amount;
  burden := 0;
  applied_limit := null;
  applied_mode := null;
  if p_amount is null then supported := null; return; end if;
  if (p_category = 'meal' or (p_category = 'trip' and p_trip_type = 'meal')) and p_company.meal_limit_enabled then
    applied_limit := coalesce(p_member_override, p_company.meal_limit_per_person);
    applied_mode := p_company.meal_limit_mode;
    v_limit := applied_limit * greatest(coalesce(p_headcount, 1), 1);
    if p_company.meal_limit_mode = 'split' and p_amount > v_limit then
      supported := v_limit;
      burden := p_amount - v_limit;
    end if;
  end if;
end;
$$;

-- 작성 중인 본인 소명서인지 확인하고 잠근다 (다른 사람·다른 회사·상신된 소명서는 NOT_FOUND / NOT_EDITABLE)
create or replace function private.lock_my_editable_claim(p_claim_id uuid)
returns public.expense_claims
language plpgsql security definer
set search_path = ''
as $$
declare v_member public.members := private.require_member(); v_claim public.expense_claims;
begin
  select * into v_claim from public.expense_claims
   where id = p_claim_id and company_id = v_member.company_id and member_id = v_member.id
   for update;
  if not found then raise exception 'NOT_FOUND' using errcode = '42501'; end if;
  if v_claim.status not in ('draft', 'rejected') then raise exception 'NOT_EDITABLE'; end if;
  return v_claim;
end;
$$;

create or replace function public.refresh_claim_totals(p_claim_id uuid)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_claim public.expense_claims := private.lock_my_editable_claim(p_claim_id);
  v_company public.companies;
  v_override integer;
  r record;
  a record;
  v_result jsonb;
begin
  select * into v_company from public.companies where id = v_claim.company_id;
  select meal_limit_override into v_override from public.members where id = v_claim.member_id;
  for r in select id, category, trip_type, amount, headcount from public.expense_items where claim_id = v_claim.id loop
    select * into a from private.item_amounts(r.category, r.trip_type, r.amount, r.headcount, v_company, v_override);
    update public.expense_items
       set company_supported_amount = a.supported,
           personal_burden_amount = a.burden,
           applied_meal_limit_per_person = a.applied_limit,
           applied_meal_limit_mode = a.applied_mode,
           updated_at = now()
     where id = r.id;
  end loop;
  update public.expense_claims c
     set item_count = s.n,
         total_amount = s.total,
         total_company_supported = s.supported,
         total_personal_burden = s.burden,
         updated_at = now()
    from (
      select count(*)::integer n, coalesce(sum(amount), 0)::integer total,
             coalesce(sum(company_supported_amount), 0)::integer supported, coalesce(sum(personal_burden_amount), 0)::integer burden
      from public.expense_items where claim_id = v_claim.id
    ) s
   where c.id = v_claim.id
  returning jsonb_build_object('item_count', c.item_count, 'total_amount', c.total_amount,
                               'total_company_supported', c.total_company_supported, 'total_personal_burden', c.total_personal_burden)
    into v_result;
  return v_result;
end;
$$;

-- 영수증 항목 만들기: 저장 경로는 서버가 정한다. 출장 소명서면 카테고리 출장비로 시작(D-035)
create or replace function public.create_receipt_item(p_claim_id uuid, p_is_pdf boolean default false, p_thumb_ext text default 'webp')
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_claim public.expense_claims := private.lock_my_editable_claim(p_claim_id);
  v_item_id uuid := gen_random_uuid();
  v_dir text;
  v_path text;
  v_thumb text;
begin
  if p_thumb_ext not in ('webp', 'jpg') then raise exception 'INVALID_FILE'; end if;
  if (select count(*) from public.expense_items where claim_id = v_claim.id) >= 30 then raise exception 'TOO_MANY_ITEMS'; end if;
  v_dir := v_claim.company_id || '/' || v_claim.member_id || '/' || v_claim.id;
  v_path := v_dir || '/' || v_item_id || case when p_is_pdf then '.pdf' else '.jpg' end;
  v_thumb := case when p_is_pdf then null else v_dir || '/' || v_item_id || '_thumb.' || p_thumb_ext end;
  insert into public.expense_items (id, claim_id, company_id, sort_order, category, payment_method, receipt_path, receipt_thumb_path, parse_status, headcount)
  values (
    v_item_id, v_claim.id, v_claim.company_id,
    coalesce((select max(sort_order) from public.expense_items where claim_id = v_claim.id), 0) + 1,
    case when v_claim.is_business_trip then 'trip'::public.expense_category end,
    v_claim.default_payment_method, v_path, v_thumb, 'parsing', 1
  );
  return jsonb_build_object('item_id', v_item_id, 'receipt_path', v_path, 'thumb_path', v_thumb);
end;
$$;

-- AI 인식 결과 적용: 빈 칸에만 채운다(직원이 이미 입력한 값은 그대로, receipt-parser.md §2-5)
create or replace function public.apply_receipt_parse(p_item_id uuid, p_ok boolean, p_payload jsonb default null)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_item public.expense_items;
  v_claim public.expense_claims;
  v_last4 text;
  v_card uuid;
  v_has_cards boolean;
  v_date date;
  v_category public.expense_category;
begin
  select * into v_item from public.expense_items where id = p_item_id;
  if not found then raise exception 'NOT_FOUND' using errcode = '42501'; end if;
  v_claim := private.lock_my_editable_claim(v_item.claim_id);
  select * into v_item from public.expense_items where id = p_item_id for update;

  if not p_ok or p_payload is null then
    update public.expense_items set parse_status = 'failed', updated_at = now() where id = p_item_id;
    return;
  end if;

  v_last4 := case when p_payload->>'card_last4' ~ '^[0-9]{4}$' then p_payload->>'card_last4' end;
  v_date := case when p_payload->>'expense_date' ~ '^\d{4}-\d{2}-\d{2}$' then (p_payload->>'expense_date')::date end;
  if v_date > (now() at time zone 'Asia/Seoul')::date then v_date := null; end if; -- 오늘 이후 날짜는 버린다
  v_category := case
    when v_claim.is_business_trip then 'trip'
    when p_payload->>'suggested_category' in ('meal', 'trip', 'meeting', 'purchase') then (p_payload->>'suggested_category')::public.expense_category
  end;

  update public.expense_items set
    ai_parsed_payload = p_payload,
    parse_status = 'success',
    merchant_name = coalesce(merchant_name, nullif(left(btrim(p_payload->>'merchant_name'), 100), '')),
    merchant_business_number = coalesce(merchant_business_number,
      case when regexp_replace(coalesce(p_payload->>'merchant_business_number', ''), '[^0-9]', '', 'g') ~ '^[0-9]{10}$'
           then regexp_replace(p_payload->>'merchant_business_number', '[^0-9]', '', 'g') end),
    card_last4 = coalesce(card_last4, v_last4),
    evidence_type = coalesce(evidence_type,
      case when p_payload->>'suggested_evidence_type' in ('card_slip', 'cash_receipt', 'tax_invoice', 'simple_receipt', 'other')
           then (p_payload->>'suggested_evidence_type')::public.evidence_type end),
    amount = coalesce(amount, case when (p_payload->>'amount') ~ '^\d{1,9}$' then (p_payload->>'amount')::integer end),
    supply_amount = coalesce(supply_amount, case when (p_payload->>'supply_amount') ~ '^\d{1,9}$' then (p_payload->>'supply_amount')::integer end),
    vat_amount = coalesce(vat_amount, case when (p_payload->>'vat_amount') ~ '^\d{1,9}$' then (p_payload->>'vat_amount')::integer end),
    expense_date = coalesce(expense_date, v_date),
    category = coalesce(category, v_category),
    updated_at = now()
  where id = p_item_id;

  -- 세부 유형 추천 (카테고리가 정해진 뒤, 비어 있을 때만)
  update public.expense_items set
    trip_type = coalesce(trip_type, case when category = 'trip' and p_payload->>'suggested_trip_type' in ('meal', 'public_transport', 'taxi', 'toll_parking', 'lodging', 'own_car', 'other')
                                         then (p_payload->>'suggested_trip_type')::public.trip_type end),
    purchase_type = coalesce(purchase_type, case when category = 'purchase' and p_payload->>'suggested_purchase_type' in ('pantry', 'office_supplies', 'small_equipment')
                                                 then (p_payload->>'suggested_purchase_type')::public.purchase_type end)
  where id = p_item_id;

  -- 법인카드 판별(D-055): 등록 카드와 일치 → 법인카드+해당 카드 / 읽었지만 불일치 → 개인(사비) 추천 / 못 읽음 → 기본값 유지
  -- 처음 인식할 때만(직원이 아직 결제수단을 고르지 않은 상태) 적용한다
  if v_item.parse_status = 'parsing' and v_last4 is not null then
    select id into v_card from public.corporate_cards where company_id = v_claim.company_id and is_active and last4 = v_last4;
    select exists (select 1 from public.corporate_cards where company_id = v_claim.company_id and is_active) into v_has_cards;
    if v_card is not null then
      update public.expense_items set payment_method = 'corporate_card', corporate_card_id = v_card where id = p_item_id;
    elsif v_has_cards then
      update public.expense_items set payment_method = 'personal_card', corporate_card_id = null where id = p_item_id;
    end if;
  end if;

  perform public.refresh_claim_totals(v_claim.id);
end;
$$;

-- 직원 메인 요약 (worker-dashboard.md §2·§3)
create or replace function public.my_employee_summary()
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_member public.members := private.require_member();
  v_payout integer;
  v_rejected integer;
  v_company public.companies;
begin
  select coalesce(sum(s.payout), 0) into v_payout
    from public.expense_claims c cross join lateral private.claim_settlement(c.id) s
   where c.company_id = v_member.company_id and c.member_id = v_member.id and c.status = 'approved';
  select count(*) into v_rejected from public.expense_claims
   where company_id = v_member.company_id and member_id = v_member.id and status = 'rejected';
  select * into v_company from public.companies where id = v_member.company_id;
  return jsonb_build_object(
    'pending_payout', v_payout,
    'rejected_count', v_rejected,
    'credits_left', v_company.receipt_credits_granted - v_company.receipt_credits_used
  );
end;
$$;

revoke all on function private.item_amounts(public.expense_category, public.trip_type, integer, integer, public.companies, integer),
  private.lock_my_editable_claim(uuid) from public, anon, authenticated;
revoke all on function public.refresh_claim_totals(uuid), public.create_receipt_item(uuid, boolean, text),
  public.apply_receipt_parse(uuid, boolean, jsonb), public.my_employee_summary() from public, anon;
grant execute on function public.refresh_claim_totals(uuid), public.create_receipt_item(uuid, boolean, text),
  public.apply_receipt_parse(uuid, boolean, jsonb), public.my_employee_summary() to authenticated;
