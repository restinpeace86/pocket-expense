-- =============================================================================
-- 029_receipt_details.sql — 영수증 참고 정보(결제 시각·승인번호·가맹점 주소·품목) + 중복 영수증 확인 (D-079)
-- - 네 값은 AI가 읽어 서버 함수로만 채운다(직원·관리자가 직접 고치지 않는 참고 정보). 지출소명서 양식에는 넣지 않는다.
-- - 중복 확인: 같은 회사 안에서 (승인번호+사용일+금액) 또는 (사업자번호+사용일+결제 시각+금액)이 같은 다른 영수증.
--   다른 직원의 것은 건수만 알려 준다(누구의 무슨 소명서인지는 보여 주지 않는다).
-- =============================================================================

alter table public.expense_items
  add column paid_time time,
  add column approval_number text check (approval_number ~ '^[0-9A-Za-z]{4,20}$'),
  add column merchant_address text check (length(merchant_address) <= 200),
  add column line_items jsonb not null default '[]'::jsonb check (jsonb_typeof(line_items) = 'array' and jsonb_array_length(line_items) <= 50);

create index expense_items_company_approval_idx on public.expense_items (company_id, approval_number) where approval_number is not null;

-- AI 인식 결과 적용 (027 정의 + 참고 정보 4종)
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
  v_time time;
  v_approval text;
  v_lines jsonb;
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
           then (p_payload->>'suggested_evidence_type')::public.evidence_type end),
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

-- 중복 영수증 확인: 내가 볼 수 있는 소명서의 항목마다, 같은 회사 안에서 같은 영수증으로 보이는 다른 항목
-- 반환: { "<item_id>": { "mine": [{claim_id, title, status}], "others": n } } (중복이 있는 항목만)
create or replace function public.claim_duplicate_receipts(p_claim_id uuid)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_member public.members := private.require_member();
  v_result jsonb;
begin
  if not exists (select 1 from public.expense_claims c where c.id = p_claim_id and c.company_id = v_member.company_id)
     or not private.can_view_claim(p_claim_id) then
    raise exception 'NOT_FOUND' using errcode = '42501';
  end if;
  with mine as (
    select i.id, i.approval_number, i.merchant_business_number, i.expense_date, i.paid_time, i.amount, c.member_id as owner
      from public.expense_items i join public.expense_claims c on c.id = i.claim_id
     where i.claim_id = p_claim_id and i.amount is not null and i.expense_date is not null
  ), dup as (
    select m.id as item_id, o.claim_id, oc.title, oc.status, (oc.member_id = m.owner) as same_owner
      from mine m
      join public.expense_items o on o.company_id = v_member.company_id and o.id <> m.id
       and o.expense_date = m.expense_date and o.amount = m.amount
       and ((m.approval_number is not null and o.approval_number = m.approval_number)
            or (m.merchant_business_number is not null and m.paid_time is not null
                and o.merchant_business_number = m.merchant_business_number and o.paid_time = m.paid_time))
      join public.expense_claims oc on oc.id = o.claim_id
  )
  select coalesce(jsonb_object_agg(item_id, v), '{}'::jsonb) into v_result
    from (
      select item_id, jsonb_build_object(
               'mine', coalesce(jsonb_agg(jsonb_build_object('claim_id', claim_id, 'title', title, 'status', status)) filter (where same_owner), '[]'::jsonb),
               'others', count(*) filter (where not same_owner)
             ) v
        from dup group by item_id
    ) s;
  return v_result;
end;
$$;

revoke all on function public.claim_duplicate_receipts(uuid) from public, anon;
grant execute on function public.claim_duplicate_receipts(uuid) to authenticated;
