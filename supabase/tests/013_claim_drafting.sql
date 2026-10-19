-- =============================================================================
-- 013_claim_drafting.sql — 지출소명서 작성 함수 권한·격리·계산 테스트 (T6 묶음 A, migration 027)
-- 회사 A(대표 a_sup, 직원 a_e1·a_e2), 회사 B(대표 b_sup). A에는 법인카드 7890.
-- =============================================================================
begin;

create function public._t_expect(p_sql text, p_code text, p_label text)
returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlerrm = p_code then return; end if;
    raise exception 'FAIL [%] expected % but got %', p_label, p_code, sqlerrm;
  end;
  raise exception 'FAIL [%] expected % but succeeded', p_label, p_code;
end;
$$;
grant execute on function public._t_expect(text, text, text) to authenticated;

insert into auth.users (id, instance_id, aud, role, email)
select u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u::text || '@test.local'
from unnest(array['a1300000-0000-0000-0000-000000000001', 'a1300000-0000-0000-0000-000000000002', 'a1300000-0000-0000-0000-000000000003', 'b1300000-0000-0000-0000-000000000001']::uuid[]) u;
insert into public.companies (id, name, invite_code, business_number, meal_limit_per_person, meal_limit_mode) values
  ('c1300000-0000-0000-0000-00000000000a', '작성회사A', 'DRAFTAAA', '1000000091', 10000, 'split'),
  ('c1300000-0000-0000-0000-00000000000b', '작성회사B', 'DRAFTBBB', '1000000092', 10000, 'split');
insert into public.members (id, auth_user_id, company_id, name, phone, role, status, privacy_agreed_at) values
  ('a1400000-0000-0000-0000-000000000001', 'a1300000-0000-0000-0000-000000000001', 'c1300000-0000-0000-0000-00000000000a', 'A대표', '01096001000', 'super_admin', 'approved', now()),
  ('a1400000-0000-0000-0000-000000000002', 'a1300000-0000-0000-0000-000000000002', 'c1300000-0000-0000-0000-00000000000a', 'A직원1', '01096001001', 'employee', 'approved', now()),
  ('a1400000-0000-0000-0000-000000000003', 'a1300000-0000-0000-0000-000000000003', 'c1300000-0000-0000-0000-00000000000a', 'A직원2', '01096001002', 'employee', 'approved', now()),
  ('b1400000-0000-0000-0000-000000000001', 'b1300000-0000-0000-0000-000000000001', 'c1300000-0000-0000-0000-00000000000b', 'B대표', '01097001000', 'super_admin', 'approved', now());
insert into public.corporate_cards (id, company_id, nickname, last4) values ('a1500000-0000-0000-0000-000000000001', 'c1300000-0000-0000-0000-00000000000a', 'A 법인', '7890');
insert into public.expense_claims (id, company_id, member_id, title) values
  ('a1600000-0000-0000-0000-000000000001', 'c1300000-0000-0000-0000-00000000000a', 'a1400000-0000-0000-0000-000000000002', 'A직원1 소명서'),
  ('a1600000-0000-0000-0000-000000000002', 'c1300000-0000-0000-0000-00000000000a', 'a1400000-0000-0000-0000-000000000002', 'A직원1 상신된 소명서');
update public.expense_claims set status = 'submitted' where id = 'a1600000-0000-0000-0000-000000000002';
insert into public.expense_claims (id, company_id, member_id, title, is_business_trip) values
  ('a1600000-0000-0000-0000-000000000003', 'c1300000-0000-0000-0000-00000000000a', 'a1400000-0000-0000-0000-000000000002', 'A직원1 출장', true);

-- ── A 직원1: 자기 소명서에 항목 만들기, 경로는 회사 폴더, 인식 결과는 빈 칸에만 ─────────────
select set_config('request.jwt.claims', '{"sub":"a1300000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
do $$
declare r jsonb; v_item uuid; t jsonb;
begin
  r := public.create_receipt_item('a1600000-0000-0000-0000-000000000001');
  v_item := (r->>'item_id')::uuid;
  perform set_config('t.item1', v_item::text, true);
  if r->>'receipt_path' not like 'c1300000-0000-0000-0000-00000000000a/a1400000-0000-0000-0000-000000000002/a1600000-0000-0000-0000-000000000001/%.jpg'
     or r->>'thumb_path' not like '%_thumb.webp' then
    raise exception 'FAIL [A_E1] bad paths %', r;
  end if;
  -- 직원이 먼저 가맹점을 입력해 둔 상태
  update public.expense_items set merchant_name = '직원이 쓴 이름' where id = v_item;
  perform public.apply_receipt_parse(v_item, true, '{"merchant_name":"AI 이름","amount":36000,"supply_amount":32727,"vat_amount":3273,"expense_date":"2026-10-15","card_last4":"7890","suggested_category":"meal","suggested_evidence_type":"card_slip","merchant_business_number":"124-81-00998"}'::jsonb);
  if (select row(merchant_name, amount, card_last4, category, payment_method, corporate_card_id, evidence_type, merchant_business_number, parse_status)::text from public.expense_items where id = v_item)
     <> row('직원이 쓴 이름', 36000, '7890', 'meal'::public.expense_category, 'corporate_card'::public.payment_method, 'a1500000-0000-0000-0000-000000000001'::uuid, 'card_slip'::public.evidence_type, '1248100998', 'success'::public.parse_status)::text then
    raise exception 'FAIL [A_E1] parse not applied correctly: %', (select row(merchant_name, amount, card_last4, category, payment_method, corporate_card_id, evidence_type, merchant_business_number, parse_status)::text from public.expense_items where id = v_item);
  end if;
  -- 식대 1인 10,000 × 3명 = 30,000 한도, 36,000 → 회사 30,000 + 개인 6,000 (smart-meal.md §3 예시)
  update public.expense_items set headcount = 3 where id = v_item;
  t := public.refresh_claim_totals('a1600000-0000-0000-0000-000000000001');
  if (select row(company_supported_amount, personal_burden_amount, applied_meal_limit_per_person)::text from public.expense_items where id = v_item) <> row(30000, 6000, 10000)::text
     or (t->>'total_amount')::int <> 36000 or (t->>'total_company_supported')::int <> 30000 or (t->>'total_personal_burden')::int <> 6000 then
    raise exception 'FAIL [A_E1] meal split wrong: % / %', t, (select row(company_supported_amount, personal_burden_amount)::text from public.expense_items where id = v_item);
  end if;
  -- 등록되지 않은 카드 끝 4자리 → 개인(사비) 추천, 오늘 이후 날짜는 버림
  r := public.create_receipt_item('a1600000-0000-0000-0000-000000000001');
  perform public.apply_receipt_parse((r->>'item_id')::uuid, true, '{"amount":5000,"card_last4":"1111","expense_date":"2999-01-01","suggested_category":"purchase","suggested_purchase_type":"pantry"}'::jsonb);
  if (select row(payment_method, corporate_card_id, expense_date, category, purchase_type)::text from public.expense_items where id = (r->>'item_id')::uuid)
     <> row('personal_card'::public.payment_method, null::uuid, null::date, 'purchase'::public.expense_category, 'pantry'::public.purchase_type)::text then
    raise exception 'FAIL [A_E1] unknown card / future date / purchase not handled';
  end if;
  -- 인식 실패
  r := public.create_receipt_item('a1600000-0000-0000-0000-000000000001', true);
  if r->>'thumb_path' is not null or r->>'receipt_path' not like '%.pdf' then raise exception 'FAIL [A_E1] pdf paths %', r; end if;
  perform public.apply_receipt_parse((r->>'item_id')::uuid, false);
  if (select parse_status from public.expense_items where id = (r->>'item_id')::uuid) <> 'failed' then raise exception 'FAIL [A_E1] failed parse not stored'; end if;
  -- 출장 소명서: AI가 식대라 해도 출장비로, 세부 유형 추천 반영
  r := public.create_receipt_item('a1600000-0000-0000-0000-000000000003');
  perform public.apply_receipt_parse((r->>'item_id')::uuid, true, '{"amount":12000,"suggested_category":"meal","suggested_trip_type":"meal"}'::jsonb);
  if (select row(category, trip_type)::text from public.expense_items where id = (r->>'item_id')::uuid) <> row('trip'::public.expense_category, 'meal'::public.trip_type)::text then
    raise exception 'FAIL [A_E1] business trip category not forced';
  end if;
  -- 결제수단 기본값이 새 항목에 적용
  update public.expense_claims set default_payment_method = 'personal_card' where id = 'a1600000-0000-0000-0000-000000000001';
  r := public.create_receipt_item('a1600000-0000-0000-0000-000000000001');
  if (select payment_method from public.expense_items where id = (r->>'item_id')::uuid) <> 'personal_card' then raise exception 'FAIL [A_E1] default payment not applied'; end if;
end $$;
select public._t_expect($q$select public.create_receipt_item('a1600000-0000-0000-0000-000000000002')$q$, 'NOT_EDITABLE', 'A_E1 submitted claim');
select public._t_expect($q$select public.create_receipt_item('a1600000-0000-0000-0000-000000000001', false, 'png')$q$, 'INVALID_FILE', 'A_E1 bad thumb ext');
-- 상태·합계·인식 결과는 직접 못 바꾼다
select public._t_expect($q$update public.expense_claims set total_amount = 1 where id = 'a1600000-0000-0000-0000-000000000001'$q$, 'permission denied for table expense_claims', 'A_E1 direct total');
select public._t_expect($q$update public.expense_items set company_supported_amount = 999999 where claim_id = 'a1600000-0000-0000-0000-000000000001'$q$, 'permission denied for table expense_items', 'A_E1 direct supported');
select public._t_expect($q$update public.expense_items set receipt_path = 'c1300000-0000-0000-0000-00000000000b/x.jpg' where claim_id = 'a1600000-0000-0000-0000-000000000001'$q$, 'permission denied for table expense_items', 'A_E1 direct receipt path');
-- 30건 제한
do $$
begin
  for i in 1..30 loop
    begin
      perform public.create_receipt_item('a1600000-0000-0000-0000-000000000001');
    exception when others then
      if sqlerrm = 'TOO_MANY_ITEMS' then
        if (select count(*) from public.expense_items where claim_id = 'a1600000-0000-0000-0000-000000000001') <> 30 then raise exception 'FAIL [A_E1] limit not at 30'; end if;
        return;
      end if;
      raise;
    end;
  end loop;
  raise exception 'FAIL [A_E1] more than 30 items allowed';
end $$;
reset role;

-- ── A 직원2 (같은 회사 다른 사람): A직원1 소명서에 손댈 수 없다 ───────────────────────────
select set_config('request.jwt.claims', '{"sub":"a1300000-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select public._t_expect($q$select public.create_receipt_item('a1600000-0000-0000-0000-000000000001')$q$, 'NOT_FOUND', 'A_E2 other member claim');
select public._t_expect(format($q$select public.apply_receipt_parse(%L, true, '{"amount":1}'::jsonb)$q$, current_setting('t.item1')), 'NOT_FOUND', 'A_E2 parse other item');
select public._t_expect($q$select public.refresh_claim_totals('a1600000-0000-0000-0000-000000000001')$q$, 'NOT_FOUND', 'A_E2 refresh other claim');
do $$
begin
  if (public.my_employee_summary()->>'pending_payout')::int <> 0 then raise exception 'FAIL [A_E2] summary includes others'; end if;
end $$;
reset role;

-- ── A 대표(관리자라도): 남의 작성 중 소명서는 작성 함수로 손댈 수 없다 ──────────────────────
select set_config('request.jwt.claims', '{"sub":"a1300000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select public._t_expect($q$select public.create_receipt_item('a1600000-0000-0000-0000-000000000001')$q$, 'NOT_FOUND', 'A_SUP employee claim');
reset role;

-- ── B 대표: 다른 회사 ─────────────────────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"b1300000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select public._t_expect($q$select public.create_receipt_item('a1600000-0000-0000-0000-000000000001')$q$, 'NOT_FOUND', 'B_SUP create in A');
select public._t_expect(format($q$select public.apply_receipt_parse(%L, true, '{"amount":1}'::jsonb)$q$, current_setting('t.item1')), 'NOT_FOUND', 'B_SUP parse A item');
reset role;

-- ── 계산 규칙 단위 확인 (자율 승인, 개인별 한도, 한도 없이 전액, 식대 외) ──────────────────
do $$
declare c public.companies; a record;
begin
  select * into c from public.companies where id = 'c1300000-0000-0000-0000-00000000000a';
  select * into a from private.item_amounts('meal', null, 36000, 3, c, 15000);
  if (a.supported, a.burden) <> (36000, 0) then raise exception 'FAIL [CALC] override 15000x3 should cover 36000'; end if;
  select * into a from private.item_amounts('trip', 'meal', 25000, 2, c, null);
  if (a.supported, a.burden) <> (20000, 5000) then raise exception 'FAIL [CALC] trip meal split'; end if;
  select * into a from private.item_amounts('trip', 'taxi', 25000, 2, c, null);
  if (a.supported, a.burden) <> (25000, 0) or a.applied_limit is not null then raise exception 'FAIL [CALC] taxi should be full'; end if;
  c.meal_limit_mode := 'notify';
  select * into a from private.item_amounts('meal', null, 36000, 3, c, null);
  if (a.supported, a.burden) <> (36000, 0) then raise exception 'FAIL [CALC] notify mode'; end if;
  c.meal_limit_mode := 'split'; c.meal_limit_enabled := false;
  select * into a from private.item_amounts('meal', null, 99000, 1, c, null);
  if (a.supported, a.burden) <> (99000, 0) or a.applied_limit is not null then raise exception 'FAIL [CALC] limit disabled'; end if;
end $$;

select 'CLAIM_DRAFTING_OK' as result;
rollback;
