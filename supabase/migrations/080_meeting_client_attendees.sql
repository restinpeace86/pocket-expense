-- =============================================================================
-- 080_meeting_client_attendees.sql — 외부 미팅비 거래처·참석자 필수 (D-153)
-- 기업업무추진비(접대비)는 상대방·참석자·목적이 소명의 핵심이라 상신 때 세 칸 모두 받는다(기존: 목적만, D-076).
-- 결의서 카테고리가 외부 미팅비인 결의서에 적용. 이미 상신된 결의서는 그대로.
-- =============================================================================
create or replace function private.claim_problems(p_claim_id uuid)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_claim public.expense_claims;
  v_header text[] := '{}';
  v_count integer;
  v_has_cards boolean;
  v_items jsonb;
  v_by_claim boolean;
  v_custom text[];
  v_per_diem boolean;
  v_odometer boolean;
begin
  select * into v_claim from public.expense_claims where id = p_claim_id;
  v_by_claim := v_claim.category is not null;
  if length(btrim(coalesce(v_claim.title, ''))) = 0 then v_header := array_append(v_header, 'title'); end if;
  if length(btrim(coalesce(v_claim.description, ''))) = 0 then v_header := array_append(v_header, 'description'); end if;
  -- 결의서 카테고리가 없으면: 영수증 카테고리가 하나로 정해질 때만 상신(섞였거나 비어 있으면 고르게 한다)
  if not v_by_claim and (
       (select count(distinct category) from public.expense_items where claim_id = p_claim_id and category is not null) > 1
       or exists (select 1 from public.expense_items where claim_id = p_claim_id and category is null)) then
    v_header := array_append(v_header, 'category');
  end if;
  if v_claim.category = 'meeting' and length(btrim(coalesce(v_claim.meeting_purpose, ''))) = 0 then v_header := array_append(v_header, 'meeting_purpose'); end if;
  -- 외부 미팅비(기업업무추진비): 거래처·참석자도 필수(D-153 — 세무 소명에 필요한 상대방 정보)
  if v_claim.category = 'meeting' then
    if length(btrim(coalesce(v_claim.client_name, ''))) = 0 then v_header := array_append(v_header, 'client_name'); end if;
    if length(btrim(coalesce(v_claim.attendees, ''))) = 0 then v_header := array_append(v_header, 'attendees'); end if;
  end if;
  -- 경조사비(D-123): 내부(임직원)/외부(거래처)를 골라야 하고, 외부면 거래처명
  if v_claim.category = 'condolence' then
    if v_claim.condolence_target is null then v_header := array_append(v_header, 'condolence_target');
    elsif v_claim.condolence_target = 'external' and length(btrim(coalesce(v_claim.client_name, ''))) = 0 then v_header := array_append(v_header, 'client_name'); end if;
  end if;
  if v_claim.category = 'purchase' then
    if v_claim.purchase_type is null then v_header := array_append(v_header, 'purchase_type'); end if;
    if length(btrim(coalesce(v_claim.purchase_purpose, ''))) = 0 then v_header := array_append(v_header, 'purchase_purpose'); end if;
  end if;
  -- 회사차량(결의서 또는 회사차량으로 간 출장): 등록된 차량이 있으면 어느 차인지 고른다
  if (v_claim.category = 'company_car' or (v_claim.category = 'trip' and v_claim.trip_transport = 'company_car')) and v_claim.vehicle_id is null
     and exists (select 1 from public.company_vehicles where company_id = v_claim.company_id and is_active) then
    v_header := array_append(v_header, 'vehicle');
  end if;
  if v_claim.is_business_trip then
    if length(btrim(coalesce(v_claim.trip_destination, ''))) = 0 then v_header := array_append(v_header, 'trip_destination'); end if;
    if v_claim.trip_start_date is null or v_claim.trip_end_date is null then v_header := array_append(v_header, 'trip_period');
    elsif v_claim.trip_end_date < v_claim.trip_start_date then v_header := array_append(v_header, 'trip_period_order'); end if;
    if length(btrim(coalesce(v_claim.trip_purpose, ''))) = 0 then v_header := array_append(v_header, 'trip_purpose'); end if;
  end if;
  select count(*) into v_count from public.expense_items where claim_id = p_claim_id;
  if v_count = 0 then v_header := array_append(v_header, 'no_items'); end if;
  if v_count > 30 then v_header := array_append(v_header, 'too_many_items'); end if;
  select exists (select 1 from public.corporate_cards where company_id = v_claim.company_id and is_active) into v_has_cards;
  select per_diem_enabled and per_diem_amount > 0, odometer_photo_required into v_per_diem, v_odometer from public.companies where id = v_claim.company_id;

  select coalesce(jsonb_agg(jsonb_build_object('item_id', id, 'sort_order', sort_order, 'fields', to_jsonb(f)) order by sort_order), '[]'::jsonb)
    into v_items
    from (
      select i.id, i.sort_order, array_remove(array[
        case when i.parse_status = 'parsing' then 'parsing' end,
        -- 출장 일비에 식비가 들어 있다(D-124 A안): 출장 식비 영수증은 따로 받지 않는다
        case when v_per_diem and i.category = 'trip' and i.trip_type = 'meal' then 'per_diem_meal' end,
        case when i.category is null and v_by_claim then 'category' end, -- 결의서 카테고리가 없으면 위 header에서 묻는다
        -- AI가 본 종류가 결의서와 다르면 직원이 확인하거나 옮겨야 한다(조용히 바꾸지 않음, D-104)
        case when not i.category_mismatch_ack and not (i.category = 'trip' and i.trip_type = 'own_car')
                  and private.category_mismatch(v_claim.category, i.ai_parsed_payload->>'suggested_category') then 'category_mismatch' end,
        case when i.payment_method = 'corporate_card' and v_has_cards and i.corporate_card_id is null then 'corporate_card' end,
        case when i.evidence_type is null then 'evidence_type' end,
        case when i.expense_date is null then 'expense_date' end,
        case when i.amount is null or i.amount <= 0 then 'amount' end,
        -- 증빙 자료: 사진·PDF(영수증 또는 영수증 대신 자료). 없으면 '증빙 없음' + 사유 5자 이상일 때만(D-108). 자차 유류비는 경로 카드가 증빙
        case when i.receipt_path is null and not (i.category = 'trip' and i.trip_type = 'own_car') and i.evidence_kind is distinct from 'none' then 'receipt' end,
        case when i.receipt_path is null and i.evidence_kind = 'none' and length(btrim(coalesce(i.no_evidence_reason, ''))) < 5 then 'no_evidence_reason' end,
        case when (i.category = 'meal' or (i.category = 'trip' and i.trip_type = 'meal')) and coalesce(i.headcount, 1) < 1 then 'headcount' end,
        case when not v_by_claim and i.category = 'meeting' and length(btrim(coalesce(i.purpose, ''))) = 0 then 'purpose' end,
        case when not v_by_claim and i.category = 'purchase' and i.purchase_type is null then 'purchase_type' end,
        case when not v_by_claim and i.category = 'purchase' and length(btrim(coalesce(i.purpose, ''))) = 0 then 'purpose' end,
        case when i.category = 'trip' and i.trip_type is null then 'trip_type' end,
        case when i.category = 'trip' and i.trip_type = 'lodging' and (i.trip_start_date is null or i.trip_end_date is null) then 'lodging_period' end,
        case when i.category = 'trip' and i.trip_type = 'other' and length(btrim(coalesce(i.purpose, ''))) = 0 then 'purpose' end,
        case when i.category = 'trip' and i.trip_type = 'own_car' and (i.start_location is null or i.end_location is null or coalesce(i.distance_km, 0) <= 0) then 'own_car_route' end,
        -- 회사가 계기판 사진 받기를 켰으면(D-070 ②, D-144) 자차 항목에 출발·도착 계기판 사진 2장
        case when v_odometer and i.category = 'trip' and i.trip_type = 'own_car' and (i.odometer_start_path is null or i.odometer_end_path is null) then 'odometer_photos' end
      ], null) as f
      from public.expense_items i
      where i.claim_id = p_claim_id
    ) x
   where cardinality(f) > 0;
  -- 회사 추가 항목(D-120): 지금 쓰는 양식에서 관리자가 '직원이 작성 · 필수'로 정한 칸이 비어 있으면 'custom:칸 이름'
  select coalesce(array_agg('custom:' || (f->>'label') order by n), '{}')
    into v_custom
    from public.form_templates t,
         jsonb_array_elements(coalesce(t.schema->'header', '[]'::jsonb) || coalesce(t.schema->'footer', '[]'::jsonb)) with ordinality as x(f, n)
   where t.company_id = v_claim.company_id and t.is_active
     and f->>'key' like 'custom.%' and f->>'mode' = 'input' and coalesce((f->>'required')::boolean, false)
     and coalesce((f->>'pending')::boolean, false) = false
     and length(btrim(coalesce(v_claim.header_custom_payload->>(f->>'key'), ''))) = 0;
  v_header := v_header || v_custom;
  return jsonb_build_object('header', to_jsonb(v_header), 'items', v_items);
end;
$$;
