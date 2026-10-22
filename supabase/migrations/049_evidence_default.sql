-- =============================================================================
-- 049_evidence_default.sql — 증빙 구분 AI 자동 판별 + 기본값 카드매출전표 (todo_improvement(2차) 7, D-100)
-- - apply_receipt_parse(038 정의) 그대로에 증빙 구분 기본값만 더한다: AI 판별값 → 없으면 카드매출전표.
--   읽기에 실패해도 카드매출전표. 직원이 이미 고른 값은 바꾸지 않는다(coalesce).
-- - 판별 이유 문구는 화면이 AI 결과(증빙 구분·승인번호·카드번호)로 만든다(src/lib/receipts/evidence-reason.ts).
-- =============================================================================

create or replace function public.apply_receipt_parse(p_item_id uuid, p_ok boolean, p_payload jsonb default null)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_item public.expense_items;
  v_claim public.expense_claims;
  v_last4 text;
  v_masked text;
  v_hits uuid[];
  v_compared boolean;
  v_card uuid;
  v_date date;
  v_category public.expense_category;
  v_time time;
  v_approval text;
  v_lines jsonb;
begin
  select * into v_item from public.expense_items where id = p_item_id;
  if not found then raise exception 'NOT_FOUND' using errcode = '42501'; end if;
  v_claim := private.lock_my_editable_claim(v_item.claim_id);
  select * into v_item from public.expense_items where id = p_item_id for update;

  if not p_ok or p_payload is null then
    -- 못 읽어도 증빙 구분은 카드매출전표로 둔다(대부분 카드 결제, D-100). 직원이 고른 값은 그대로
    update public.expense_items set parse_status = 'failed', evidence_type = coalesce(evidence_type, 'card_slip'), updated_at = now() where id = p_item_id;
    return;
  end if;

  -- 카드번호: 보이는 그대로(가려진 자리는 *) 받아 앞 6자리·뒤 4자리 말고는 가린 뒤 저장한다(전체 번호 저장 방지, D-083).
  -- 예전 형식(card_last4만)으로 와도 같은 규칙으로 맞춘다.
  v_masked := private.mask_card_number(coalesce(p_payload->>'card_number_masked', p_payload->>'card_last4'));
  v_last4 := case when right(v_masked, 4) ~ '^[0-9]{4}$' then right(v_masked, 4) end;
  p_payload := p_payload || jsonb_build_object('card_number_masked', v_masked, 'card_last4', v_last4);
  v_date := case when p_payload->>'expense_date' ~ '^\d{4}-\d{2}-\d{2}$' then (p_payload->>'expense_date')::date end;
  if v_date > (now() at time zone 'Asia/Seoul')::date then v_date := null; end if; -- 오늘 이후 날짜는 버린다
  v_category := case
    when v_claim.is_business_trip then 'trip'
    when p_payload->>'suggested_category' in ('meal', 'trip', 'meeting', 'purchase') then (p_payload->>'suggested_category')::public.expense_category
  end;
  v_time := case when p_payload->>'paid_time' ~ '^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$' then (p_payload->>'paid_time')::time end;
  v_approval := regexp_replace(coalesce(p_payload->>'approval_number', ''), '[\s-]', '', 'g');
  v_approval := case when v_approval ~ '^[0-9A-Za-z]{4,20}$' then v_approval end;
  -- 품목: 최대 50줄, 이름 100자, 수량·금액은 범위 안의 숫자만
  select coalesce(jsonb_agg(jsonb_build_object(
           'name', left(btrim(e->>'name'), 100),
           'quantity', case when (e->>'quantity') ~ '^\d{1,4}(\.\d{1,2})?$' and (e->>'quantity')::numeric > 0 then (e->>'quantity')::numeric end,
           'unit_price', case when (e->>'unit_price') ~ '^\d{1,9}$' then (e->>'unit_price')::integer end,
           'amount', case when (e->>'amount') ~ '^-?\d{1,9}$' then (e->>'amount')::integer end
         ) order by n), '[]'::jsonb)
    into v_lines
    from jsonb_array_elements(case when jsonb_typeof(p_payload->'line_items') = 'array' then p_payload->'line_items' else '[]'::jsonb end) with ordinality as t(e, n)
   where n <= 50 and jsonb_typeof(e) = 'object' and coalesce(btrim(e->>'name'), '') <> '';

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
           then (p_payload->>'suggested_evidence_type')::public.evidence_type end,
      'card_slip'), -- AI가 못 가렸으면 카드매출전표(D-100)
    amount = coalesce(amount, case when (p_payload->>'amount') ~ '^\d{1,9}$' then (p_payload->>'amount')::integer end),
    supply_amount = coalesce(supply_amount, case when (p_payload->>'supply_amount') ~ '^\d{1,9}$' then (p_payload->>'supply_amount')::integer end),
    vat_amount = coalesce(vat_amount, case when (p_payload->>'vat_amount') ~ '^\d{1,9}$' then (p_payload->>'vat_amount')::integer end),
    expense_date = coalesce(expense_date, v_date),
    category = coalesce(category, v_category),
    paid_time = coalesce(paid_time, v_time),
    approval_number = coalesce(approval_number, v_approval),
    merchant_address = coalesce(merchant_address, nullif(left(btrim(p_payload->>'merchant_address'), 200), '')),
    line_items = case when line_items = '[]'::jsonb then v_lines else line_items end,
    updated_at = now()
  where id = p_item_id;

  update public.expense_items set
    trip_type = coalesce(trip_type, case when category = 'trip' and p_payload->>'suggested_trip_type' in ('meal', 'public_transport', 'taxi', 'toll_parking', 'lodging', 'own_car', 'other')
                                         then (p_payload->>'suggested_trip_type')::public.trip_type end),
    purchase_type = coalesce(purchase_type, case when category = 'purchase' and p_payload->>'suggested_purchase_type' in ('pantry', 'office_supplies', 'small_equipment')
                                                 then (p_payload->>'suggested_purchase_type')::public.purchase_type end)
  where id = p_item_id;

  -- 결제수단 자동 선택: 처음 읽을 때만, 보이는 숫자만 활성 법인카드와 비교 (corporate-cards.md §3)
  --   1장과 맞음 → 법인카드 + 그 카드 / 2장 이상 → 법인카드(카드는 직원이 고름) / 안 맞음 → 개인(사비) / 비교할 숫자 없음 → 그대로
  if v_item.parse_status = 'parsing' and v_masked is not null then
    select coalesce(array_agg(c.id) filter (where x.m), '{}'), coalesce(bool_or(x.m is not null), false)
      into v_hits, v_compared
      from public.corporate_cards c
      cross join lateral (select private.card_number_matches(v_masked, c.bin6, c.last4) as m) x
     where c.company_id = v_claim.company_id and c.is_active;
    if not v_compared then
      null; -- 등록 카드가 없거나 비교할 숫자가 없음
    elsif cardinality(v_hits) = 1 then
      v_card := v_hits[1];
      update public.expense_items set payment_method = 'corporate_card', corporate_card_id = v_card,
             card_last4 = coalesce(card_last4, (select last4 from public.corporate_cards where id = v_card))
       where id = p_item_id;
    elsif cardinality(v_hits) > 1 then
      update public.expense_items set payment_method = 'corporate_card', corporate_card_id = null where id = p_item_id;
    else
      update public.expense_items set payment_method = 'personal_card', corporate_card_id = null where id = p_item_id;
    end if;
  end if;

  perform public.refresh_claim_totals(v_claim.id);
end;
$$;
