-- =============================================================================
-- 031_claim_category.sql — 결의서 단위 지출 카테고리 (todo_improvement(2차) 5, D-098, migration 048)
-- 회사 A: 직원 e1(결의서 2개), 직원 e2 / 회사 B: 직원 b1
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
from unnest(array['a3100000-0000-0000-0000-000000000001', 'a3100000-0000-0000-0000-000000000002', 'b3100000-0000-0000-0000-000000000001']::uuid[]) u;
insert into public.companies (id, name, invite_code, business_number, fuel_rate_per_km, fuel_enabled) values
  ('c3100000-0000-0000-0000-00000000000a', '카테고리A', 'CATGAAAA', '1000000311', 200, true),
  ('c3100000-0000-0000-0000-00000000000b', '카테고리B', 'CATGBBBB', '1000000312', 200, true);
insert into public.members (id, auth_user_id, company_id, name, phone, role, status, privacy_agreed_at) values
  ('a3110000-0000-0000-0000-000000000001', 'a3100000-0000-0000-0000-000000000001', 'c3100000-0000-0000-0000-00000000000a', 'A직원1', '01093101001', 'employee', 'approved', now()),
  ('a3110000-0000-0000-0000-000000000002', 'a3100000-0000-0000-0000-000000000002', 'c3100000-0000-0000-0000-00000000000a', 'A직원2', '01093101002', 'employee', 'approved', now()),
  ('b3110000-0000-0000-0000-000000000001', 'b3100000-0000-0000-0000-000000000001', 'c3100000-0000-0000-0000-00000000000b', 'B직원', '01093102001', 'employee', 'approved', now());
insert into public.expense_claims (id, company_id, member_id, title, description, trip_start_date) values
  ('a3120000-0000-0000-0000-000000000001', 'c3100000-0000-0000-0000-00000000000a', 'a3110000-0000-0000-0000-000000000001', '미팅 결의서', '사유', '2026-10-14'),
  ('a3120000-0000-0000-0000-000000000002', 'c3100000-0000-0000-0000-00000000000a', 'a3110000-0000-0000-0000-000000000001', '예전 결의서(섞임)', '사유', null);
insert into public.expense_items (id, claim_id, company_id, sort_order, category, payment_method, evidence_type, expense_date, amount, headcount, merchant_name, receipt_path) values
  ('a3130000-0000-0000-0000-000000000001', 'a3120000-0000-0000-0000-000000000001', 'c3100000-0000-0000-0000-00000000000a', 1, 'meal', 'personal_card', 'card_slip', '2026-10-14', 30000, 1, '메가커피', 'c3100000-0000-0000-0000-00000000000a/r/1.jpg'),
  ('a3130000-0000-0000-0000-000000000002', 'a3120000-0000-0000-0000-000000000001', 'c3100000-0000-0000-0000-00000000000a', 2, null, 'personal_card', 'card_slip', '2026-10-14', 12000, 1, '스타벅스', 'c3100000-0000-0000-0000-00000000000a/r/2.jpg'),
  ('a3130000-0000-0000-0000-000000000011', 'a3120000-0000-0000-0000-000000000002', 'c3100000-0000-0000-0000-00000000000a', 1, 'meal', 'personal_card', 'card_slip', '2026-10-14', 9000, 1, '김밥', 'c3100000-0000-0000-0000-00000000000a/r/3.jpg'),
  ('a3130000-0000-0000-0000-000000000012', 'a3120000-0000-0000-0000-000000000002', 'c3100000-0000-0000-0000-00000000000a', 2, 'meeting', 'personal_card', 'card_slip', '2026-10-14', 20000, 2, '카페', 'c3100000-0000-0000-0000-00000000000a/r/4.jpg');

-- ── 예전 결의서(카테고리 없음): 트리거는 아무것도 바꾸지 않고, 섞여 있으면 상신 검증이 카테고리를 묻는다 ──
do $$
begin
  if (select category from public.expense_items where id = 'a3130000-0000-0000-0000-000000000012') <> 'meeting' then raise exception 'FAIL [legacy] item category changed'; end if;
  if not (private.claim_problems('a3120000-0000-0000-0000-000000000002')->'header' ? 'category') then raise exception 'FAIL [legacy] mixed categories should ask category'; end if;
  -- 미팅 영수증 목적은 예전처럼 영수증에서 묻는다
  if not exists (select 1 from jsonb_array_elements(private.claim_problems('a3120000-0000-0000-0000-000000000002')->'items') e where e->>'item_id' = 'a3130000-0000-0000-0000-000000000012' and e->'fields' ? 'purpose') then
    raise exception 'FAIL [legacy] item purpose check missing';
  end if;
end;
$$;

-- ── A 직원1 ───────────────────────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"a3100000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
-- 새 컬럼은 직접 못 바꾼다(함수로만)
select public._t_raises($q$update public.expense_claims set category = 'meal' where id = 'a3120000-0000-0000-0000-000000000001'$q$, '42501', 'A_E1 direct category');
do $$
declare r record; p jsonb;
begin
  -- 미팅 + 목적 비움 → 결의서 칸으로 묻고, 영수증 칸으로는 묻지 않는다
  perform public.set_claim_category('a3120000-0000-0000-0000-000000000001', 'meeting', null, '', 'A사', '김부장', null, null, 3);
  p := public.check_claim_for_submit('a3120000-0000-0000-0000-000000000001');
  if not (p->'header' ? 'meeting_purpose') then raise exception 'FAIL [A_E1] meeting_purpose header %', p; end if;
  if exists (select 1 from jsonb_array_elements(p->'items') e where e->'fields' ? 'purpose') then raise exception 'FAIL [A_E1] item purpose asked %', p; end if;

  perform public.set_claim_category('a3120000-0000-0000-0000-000000000001', 'meeting', null, '신규 계약 협의', 'A사', '김부장', null, null, 3);
  select * into r from public.expense_claims where id = 'a3120000-0000-0000-0000-000000000001';
  if row(r.category, r.is_business_trip, r.meeting_purpose, r.headcount)::text <> row('meeting'::public.expense_category, false, '신규 계약 협의', 3)::text then raise exception 'FAIL [A_E1] claim %', row(r.category, r.meeting_purpose, r.headcount); end if;
  -- 영수증 두 장 모두 미팅 + 목적·거래처·참석자 복사 + 기본 인원 3명 반영
  if (select count(*) from public.expense_items where claim_id = 'a3120000-0000-0000-0000-000000000001'
        and category = 'meeting' and purpose = '신규 계약 협의' and client_name = 'A사' and attendees = '김부장' and headcount = 3) <> 2 then
    raise exception 'FAIL [A_E1] items not following claim';
  end if;
  if jsonb_array_length(public.check_claim_for_submit('a3120000-0000-0000-0000-000000000001')->'header') <> 0 then raise exception 'FAIL [A_E1] header problems left %', public.check_claim_for_submit('a3120000-0000-0000-0000-000000000001'); end if;

  -- 영수증 한 장만 인원 2명으로 고칠 수 있고, 같은 기본 인원으로 다시 저장해도 덮어쓰지 않는다
  update public.expense_items set headcount = 2 where id = 'a3130000-0000-0000-0000-000000000001';
  perform public.set_claim_category('a3120000-0000-0000-0000-000000000001', 'meeting', null, '신규 계약 협의', 'A사', '김부장', null, null, 3);
  if (select headcount from public.expense_items where id = 'a3130000-0000-0000-0000-000000000001') <> 2 then raise exception 'FAIL [A_E1] per receipt headcount overwritten'; end if;

  -- 영수증에서 카테고리를 바꿔도 결의서를 따른다
  update public.expense_items set category = 'meal', purpose = '다른 목적' where id = 'a3130000-0000-0000-0000-000000000002';
  select * into r from public.expense_items where id = 'a3130000-0000-0000-0000-000000000002';
  if row(r.category, r.purpose)::text <> row('meeting'::public.expense_category, '신규 계약 협의')::text then raise exception 'FAIL [A_E1] item override %', row(r.category, r.purpose); end if;

  -- 구매: 세부 유형·목적·품목 → 영수증 purpose = "목적 · 품목", 미팅 칸은 비움
  perform public.set_claim_category('a3120000-0000-0000-0000-000000000001', 'purchase', 'pantry', null, null, null, '탕비실 비품', '커피·생수', null);
  if (select count(*) from public.expense_items where claim_id = 'a3120000-0000-0000-0000-000000000001'
        and category = 'purchase' and purchase_type = 'pantry' and purpose = '탕비실 비품 · 커피·생수' and client_name is null and attendees is null) <> 2 then
    raise exception 'FAIL [A_E1] purchase follow';
  end if;
  -- 구매 유형 없이 → 상신 검증
  perform public.set_claim_category('a3120000-0000-0000-0000-000000000001', 'purchase', null, null, null, null, '', null, null);
  p := public.check_claim_for_submit('a3120000-0000-0000-0000-000000000001');
  if not (p->'header' ? 'purchase_type' and p->'header' ? 'purchase_purpose') then raise exception 'FAIL [A_E1] purchase header %', p; end if;

  -- 출장비 → 출장 결의서, 세부 유형은 영수증마다(비어 있음 → 영수증 문제)
  perform public.set_claim_category('a3120000-0000-0000-0000-000000000001', 'trip');
  if not (select is_business_trip from public.expense_claims where id = 'a3120000-0000-0000-0000-000000000001') then raise exception 'FAIL [A_E1] trip flag'; end if;
  if (select count(*) from public.expense_items where claim_id = 'a3120000-0000-0000-0000-000000000001' and category = 'trip' and trip_type is null and purchase_type is null) <> 2 then raise exception 'FAIL [A_E1] trip follow'; end if;
  update public.expense_claims set trip_transport = 'own_car' where id = 'a3120000-0000-0000-0000-000000000001';
  perform set_config('t.car', public.create_own_car_item('a3120000-0000-0000-0000-000000000001')::text, true);
  -- 새로 올린 영수증도 결의서를 따른다(insert)
  insert into public.expense_items (claim_id, company_id, sort_order, category, payment_method, evidence_type, headcount)
  values ('a3120000-0000-0000-0000-000000000001', 'c3100000-0000-0000-0000-00000000000a', 9, 'meal', 'personal_card', 'card_slip', 1);
  if (select category from public.expense_items where claim_id = 'a3120000-0000-0000-0000-000000000001' and sort_order = 9) <> 'trip' then raise exception 'FAIL [A_E1] insert follow'; end if;
end;
$$;
-- 자차 이동이 있으면 출장비 외 카테고리로 못 바꾼다 / 자차 항목은 그대로
select public._t_raises($q$select public.set_claim_category('a3120000-0000-0000-0000-000000000001', 'meal')$q$, 'OWN_CAR_ITEMS_EXIST', 'A_E1 own car blocks');
do $$
begin
  if (select row(category, trip_type)::text from public.expense_items where id = current_setting('t.car')::uuid) <> row('trip'::public.expense_category, 'own_car'::public.trip_type)::text then raise exception 'FAIL [A_E1] own car changed'; end if;
end;
$$;
select public._t_raises($q$select public.set_claim_category('a3120000-0000-0000-0000-000000000001', null)$q$, 'INVALID_CATEGORY', 'A_E1 null category');
select public._t_raises($q$select public.set_claim_category('a3120000-0000-0000-0000-000000000002', 'meal', null, null, null, null, null, null, 100)$q$, 'INVALID_HEADCOUNT', 'A_E1 headcount');
select public._t_raises(format($q$select public.set_claim_category('a3120000-0000-0000-0000-000000000002', 'meeting', null, %L)$q$, repeat('가', 201)), 'INVALID_ITEM_TEXT', 'A_E1 long text');
-- 예전 결의서에서 고르면 섞인 영수증이 하나로
select public.set_claim_category('a3120000-0000-0000-0000-000000000002', 'meal');
do $$
begin
  if (select count(distinct category) from public.expense_items where claim_id = 'a3120000-0000-0000-0000-000000000002') <> 1 then raise exception 'FAIL [A_E1] legacy unify'; end if;
  if public.check_claim_for_submit('a3120000-0000-0000-0000-000000000002')->'header' ? 'category' then raise exception 'FAIL [A_E1] legacy category still asked'; end if;
end;
$$;
reset role;

-- ── 같은 회사 다른 직원·다른 회사 직원은 남의 결의서를 못 바꾼다 ─────────────
select set_config('request.jwt.claims', '{"sub":"a3100000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select public._t_raises($q$select public.set_claim_category('a3120000-0000-0000-0000-000000000002', 'purchase')$q$, '42501', 'A_E2 other member');
reset role;
select set_config('request.jwt.claims', '{"sub":"b3100000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select public._t_raises($q$select public.set_claim_category('a3120000-0000-0000-0000-000000000002', 'purchase')$q$, '42501', 'B other company');
do $$
begin
  if exists (select 1 from public.expense_claims where id = 'a3120000-0000-0000-0000-000000000002') then raise exception 'FAIL [B] can see A claim'; end if;
end;
$$;
reset role;
do $$
begin
  if (select category from public.expense_claims where id = 'a3120000-0000-0000-0000-000000000002') <> 'meal' then raise exception 'FAIL [B] A claim changed'; end if;
end;
$$;

-- ── 상신 뒤에는 못 바꾼다 ─────────────────────────────────────────────────
update public.expense_claims set status = 'submitted', submitted_at = now() where id = 'a3120000-0000-0000-0000-000000000002';
select set_config('request.jwt.claims', '{"sub":"a3100000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select public._t_raises($q$select public.set_claim_category('a3120000-0000-0000-0000-000000000002', 'meeting')$q$, 'NOT_EDITABLE', 'A_E1 submitted');
reset role;

select 'CLAIM_CATEGORY_OK' as result;
rollback;
