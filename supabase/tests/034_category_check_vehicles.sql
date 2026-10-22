-- =============================================================================
-- 034_category_check_vehicles.sql — 회사차량·카테고리 불일치 확인·새 결의서로 옮기기 (D-103~D-105, migration 052)
-- 회사 A: 관리자 a1, 직원 e1, 직원 e2 / 회사 B: 관리자 b1
-- =============================================================================
begin;

create function public._t_raises(p_sql text, p_code text, p_label text)
returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlerrm = p_code or sqlstate = p_code then return; end if;
    raise exception 'FAIL [%] expected % but got % (%)', p_label, p_code, sqlerrm, sqlstate;
  end;
  raise exception 'FAIL [%] expected % but succeeded', p_label, p_code;
end;
$$;
grant execute on function public._t_raises(text, text, text) to authenticated;

insert into auth.users (id, instance_id, aud, role, email)
select u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u::text || '@test.local'
from unnest(array['a3400000-0000-0000-0000-000000000001', 'a3400000-0000-0000-0000-000000000002', 'a3400000-0000-0000-0000-000000000003', 'b3400000-0000-0000-0000-000000000001']::uuid[]) u;
insert into public.companies (id, name, invite_code, business_number) values
  ('c3400000-0000-0000-0000-00000000000a', '차량회사A', 'CARVAAAA', '1000000341'),
  ('c3400000-0000-0000-0000-00000000000b', '차량회사B', 'CARVBBBB', '1000000342');
insert into public.members (id, auth_user_id, company_id, name, phone, role, status, privacy_agreed_at) values
  ('a3410000-0000-0000-0000-000000000001', 'a3400000-0000-0000-0000-000000000001', 'c3400000-0000-0000-0000-00000000000a', 'A관리자', '01093401001', 'super_admin', 'approved', now()),
  ('a3410000-0000-0000-0000-000000000002', 'a3400000-0000-0000-0000-000000000002', 'c3400000-0000-0000-0000-00000000000a', 'A직원1', '01093401002', 'employee', 'approved', now()),
  ('a3410000-0000-0000-0000-000000000003', 'a3400000-0000-0000-0000-000000000003', 'c3400000-0000-0000-0000-00000000000a', 'A직원2', '01093401003', 'employee', 'approved', now()),
  ('b3410000-0000-0000-0000-000000000001', 'b3400000-0000-0000-0000-000000000001', 'c3400000-0000-0000-0000-00000000000b', 'B관리자', '01093402001', 'super_admin', 'approved', now());
insert into public.expense_claims (id, company_id, member_id, title, description) values
  ('a3420000-0000-0000-0000-000000000001', 'c3400000-0000-0000-0000-00000000000a', 'a3410000-0000-0000-0000-000000000002', '차량 결의서', '사유'),
  ('a3420000-0000-0000-0000-000000000002', 'c3400000-0000-0000-0000-00000000000a', 'a3410000-0000-0000-0000-000000000002', '식대 결의서', '사유'),
  ('a3420000-0000-0000-0000-000000000003', 'c3400000-0000-0000-0000-00000000000a', 'a3410000-0000-0000-0000-000000000002', '카테고리 없음', '사유');
insert into public.expense_items (id, claim_id, company_id, sort_order, category, payment_method, evidence_type, expense_date, amount, headcount, merchant_name, receipt_path, receipt_thumb_path, ai_parsed_payload) values
  ('a3430000-0000-0000-0000-000000000001', 'a3420000-0000-0000-0000-000000000001', 'c3400000-0000-0000-0000-00000000000a', 1, 'meal', 'personal_card', 'card_slip', '2026-10-14', 80000, 1, '주유소', 'c3400000-0000-0000-0000-00000000000a/a3410000-0000-0000-0000-000000000002/a3420000-0000-0000-0000-000000000001/1.jpg', null, '{}'),
  ('a3430000-0000-0000-0000-000000000002', 'a3420000-0000-0000-0000-000000000002', 'c3400000-0000-0000-0000-00000000000a', 1, 'meal', 'personal_card', 'card_slip', '2026-10-14', 9000, 1, '김밥', 'c3400000-0000-0000-0000-00000000000a/a3410000-0000-0000-0000-000000000002/a3420000-0000-0000-0000-000000000002/2.jpg', null, '{"suggested_category":"meal"}'),
  ('a3430000-0000-0000-0000-000000000003', 'a3420000-0000-0000-0000-000000000002', 'c3400000-0000-0000-0000-00000000000a', 2, 'purchase', 'personal_card', 'card_slip', '2026-10-14', 12000, 1, '다이소', 'c3400000-0000-0000-0000-00000000000a/a3410000-0000-0000-0000-000000000002/a3420000-0000-0000-0000-000000000002/3.jpg', 'c3400000-0000-0000-0000-00000000000a/a3410000-0000-0000-0000-000000000002/a3420000-0000-0000-0000-000000000002/3_thumb.webp', '{"suggested_category":"purchase","suggested_purchase_type":"office_supplies"}'),
  ('a3430000-0000-0000-0000-000000000004', 'a3420000-0000-0000-0000-000000000003', 'c3400000-0000-0000-0000-00000000000a', 1, null, 'personal_card', 'card_slip', '2026-10-14', 5000, 1, '가게', 'c3400000-0000-0000-0000-00000000000a/a3410000-0000-0000-0000-000000000002/a3420000-0000-0000-0000-000000000003/4.jpg', null, '{}');

-- ── 그룹 비교 규칙 ─────────────────────────────────────────────────────────
do $$
begin
  if not private.category_mismatch('meal', 'purchase') or not private.category_mismatch('purchase', 'meal') or not private.category_mismatch('meal', 'trip') then raise exception 'FAIL [rule] mismatch'; end if;
  if private.category_mismatch('meeting', 'meal') or private.category_mismatch('team_dinner', 'meal') then raise exception 'FAIL [rule] food group'; end if;
  if private.category_mismatch('trip', 'meal') or private.category_mismatch('books', 'purchase') or private.category_mismatch('meal', null) or private.category_mismatch(null, 'meal') then raise exception 'FAIL [rule] skip'; end if;
end;
$$;

-- ── A 관리자: 차량 등록 ─────────────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"a3400000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
insert into public.company_vehicles (id, company_id, nickname, plate_number) values
  ('a3440000-0000-0000-0000-000000000001', 'c3400000-0000-0000-0000-00000000000a', '영업 1호차', '12가3456'),
  ('a3440000-0000-0000-0000-000000000002', 'c3400000-0000-0000-0000-00000000000a', '대표 차량', '34나5678');
select public._t_raises($q$insert into public.company_vehicles (company_id, nickname, plate_number) values ('c3400000-0000-0000-0000-00000000000a', '중복', '12가3456')$q$, '23505', 'A_ADM dup plate');
select public._t_raises($q$insert into public.company_vehicles (company_id, nickname, plate_number) values ('c3400000-0000-0000-0000-00000000000b', '침투', '99하9999')$q$, '42501', 'A_ADM other company');
update public.company_vehicles set is_active = false where id = 'a3440000-0000-0000-0000-000000000002';
reset role;

-- ── B 관리자: A 차량을 못 보고 못 바꾼다 ──────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"b3400000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
insert into public.company_vehicles (id, company_id, nickname, plate_number) values ('b3440000-0000-0000-0000-000000000001', 'c3400000-0000-0000-0000-00000000000b', 'B차', '56다7890');
do $$
begin
  if exists (select 1 from public.company_vehicles where company_id = 'c3400000-0000-0000-0000-00000000000a') then raise exception 'FAIL [B] sees A vehicles'; end if;
  update public.company_vehicles set nickname = '변조' where id = 'a3440000-0000-0000-0000-000000000001';
  delete from public.company_vehicles where id = 'a3440000-0000-0000-0000-000000000001';
end;
$$;
reset role;
do $$
begin
  if (select nickname from public.company_vehicles where id = 'a3440000-0000-0000-0000-000000000001') <> '영업 1호차' then raise exception 'FAIL [B] changed A vehicle'; end if;
end;
$$;

-- ── A 직원1 ────────────────────────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"a3400000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select public._t_raises($q$insert into public.company_vehicles (company_id, nickname, plate_number) values ('c3400000-0000-0000-0000-00000000000a', '직원이', '77라7777')$q$, '42501', 'A_E1 insert vehicle');
select public._t_raises($q$update public.expense_claims set vehicle_id = 'a3440000-0000-0000-0000-000000000001' where id = 'a3420000-0000-0000-0000-000000000001'$q$, '42501', 'A_E1 direct vehicle');
-- 다른 회사 차량·사용 중지 차량은 못 고른다
select public._t_raises($q$select public.set_claim_category('a3420000-0000-0000-0000-000000000001', 'company_car', p_vehicle_id => 'b3440000-0000-0000-0000-000000000001')$q$, 'INVALID_VEHICLE', 'A_E1 other company vehicle');
select public._t_raises($q$select public.set_claim_category('a3420000-0000-0000-0000-000000000001', 'company_car', p_vehicle_id => 'a3440000-0000-0000-0000-000000000002')$q$, 'INVALID_VEHICLE', 'A_E1 inactive vehicle');
do $$
declare p jsonb;
begin
  if (select count(*) from public.company_vehicles) <> 2 then raise exception 'FAIL [A_E1] employee sees own company vehicles'; end if;
  -- 차량 없이 회사차량 → 상신 검증에서 차량을 묻는다
  perform public.set_claim_category('a3420000-0000-0000-0000-000000000001', 'company_car');
  p := public.check_claim_for_submit('a3420000-0000-0000-0000-000000000001');
  if not (p->'header' ? 'vehicle') then raise exception 'FAIL [A_E1] vehicle header %', p; end if;
  perform public.set_claim_category('a3420000-0000-0000-0000-000000000001', 'company_car', p_vehicle_id => 'a3440000-0000-0000-0000-000000000001');
  if (select vehicle_id from public.expense_claims where id = 'a3420000-0000-0000-0000-000000000001') <> 'a3440000-0000-0000-0000-000000000001' then raise exception 'FAIL [A_E1] vehicle saved'; end if;
  if public.check_claim_for_submit('a3420000-0000-0000-0000-000000000001')->'header' ? 'vehicle' then raise exception 'FAIL [A_E1] vehicle still asked'; end if;
  -- 다른 카테고리로 바꾸면 차량은 비운다
  perform public.set_claim_category('a3420000-0000-0000-0000-000000000001', 'saas');
  if (select vehicle_id from public.expense_claims where id = 'a3420000-0000-0000-0000-000000000001') is not null then raise exception 'FAIL [A_E1] vehicle kept'; end if;

  -- 식대 결의서에 AI가 물품으로 본 영수증 → 조용히 넘어가지 않는다
  perform public.set_claim_category('a3420000-0000-0000-0000-000000000002', 'meal');
  if (select category from public.expense_items where id = 'a3430000-0000-0000-0000-000000000003') <> 'meal' then raise exception 'FAIL [A_E1] follow'; end if;
  p := public.check_claim_for_submit('a3420000-0000-0000-0000-000000000002');
  if not exists (select 1 from jsonb_array_elements(p->'items') e where e->>'item_id' = 'a3430000-0000-0000-0000-000000000003' and e->'fields' ? 'category_mismatch') then raise exception 'FAIL [A_E1] mismatch not asked %', p; end if;
  if exists (select 1 from jsonb_array_elements(p->'items') e where e->>'item_id' = 'a3430000-0000-0000-0000-000000000002') then raise exception 'FAIL [A_E1] matching item asked'; end if;
  -- "이 결의서가 맞아요" → 통과, 카테고리를 바꾸면 다시 묻는다
  perform public.ack_item_category('a3430000-0000-0000-0000-000000000003');
  if jsonb_array_length(public.check_claim_for_submit('a3420000-0000-0000-0000-000000000002')->'items') <> 0 then raise exception 'FAIL [A_E1] ack'; end if;
  perform public.set_claim_category('a3420000-0000-0000-0000-000000000002', 'team_dinner');
  if jsonb_array_length(public.check_claim_for_submit('a3420000-0000-0000-0000-000000000002')->'items') <> 1 then raise exception 'FAIL [A_E1] ack reset'; end if;

  -- 새 결의서로 옮기기: AI가 본 물품 구매(사무용품) 결의서가 새로 생기고 영수증이 그리로
  p := public.move_item_to_new_claim('a3430000-0000-0000-0000-000000000003');
  perform set_config('t.new', p->>'claim_id', true);
  if (select row(category, purchase_type, status, member_id)::text from public.expense_claims where id = (p->>'claim_id')::uuid)
     <> row('purchase'::public.expense_category, 'office_supplies'::public.purchase_type, 'draft'::public.claim_status, 'a3410000-0000-0000-0000-000000000002'::uuid)::text then
    raise exception 'FAIL [A_E1] new claim %', p;
  end if;
  if (select row(claim_id, category, purchase_type)::text from public.expense_items where id = 'a3430000-0000-0000-0000-000000000003')
     <> row((p->>'claim_id')::uuid, 'purchase'::public.expense_category, 'office_supplies'::public.purchase_type)::text then raise exception 'FAIL [A_E1] moved item'; end if;
  if (select item_count from public.expense_claims where id = 'a3420000-0000-0000-0000-000000000002') <> 1
     or (select item_count from public.expense_claims where id = (p->>'claim_id')::uuid) <> 1 then raise exception 'FAIL [A_E1] counts'; end if;
  if p->>'receipt_path' not like '%/a3420000-0000-0000-0000-000000000002/3.jpg' then raise exception 'FAIL [A_E1] old path returned %', p; end if;

  -- 카테고리 없는 결의서 + 카테고리 없는 영수증 → 결의서 칸에서 카테고리를 묻는다
  p := public.check_claim_for_submit('a3420000-0000-0000-0000-000000000003');
  if not (p->'header' ? 'category') then raise exception 'FAIL [A_E1] null category header %', p; end if;
end;
$$;
-- AI가 종류를 못 본 영수증은 옮길 곳을 모른다
select public._t_raises($q$select public.move_item_to_new_claim('a3430000-0000-0000-0000-000000000004')$q$, 'NO_SUGGESTED_CATEGORY', 'A_E1 no suggestion');
reset role;

-- ── 같은 회사 다른 직원은 남의 영수증을 확인·옮기기 못 함 ──────────────────────
select set_config('request.jwt.claims', '{"sub":"a3400000-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select public._t_raises($q$select public.ack_item_category('a3430000-0000-0000-0000-000000000002')$q$, '42501', 'A_E2 ack other');
select public._t_raises($q$select public.move_item_to_new_claim('a3430000-0000-0000-0000-000000000002')$q$, '42501', 'A_E2 move other');
reset role;
select set_config('request.jwt.claims', '{"sub":"b3400000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select public._t_raises($q$select public.move_item_to_new_claim('a3430000-0000-0000-0000-000000000002')$q$, '42501', 'B move other company');
reset role;

-- ── 상신 뒤에는 옮기기·확인 불가 ────────────────────────────────────────────
update public.expense_claims set status = 'submitted', submitted_at = now() where id = 'a3420000-0000-0000-0000-000000000002';
select set_config('request.jwt.claims', '{"sub":"a3400000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select public._t_raises($q$select public.move_item_to_new_claim('a3430000-0000-0000-0000-000000000002')$q$, 'NOT_EDITABLE', 'A_E1 submitted move');
select public._t_raises($q$select public.ack_item_category('a3430000-0000-0000-0000-000000000002')$q$, 'NOT_EDITABLE', 'A_E1 submitted ack');
reset role;

select 'CATEGORY_CHECK_VEHICLES_OK' as result;
rollback;
