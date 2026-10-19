-- =============================================================================
-- 015_receipt_details.sql — 영수증 참고 정보(결제 시각·승인번호·주소·품목) + 중복 영수증 확인 (D-079, migration 029)
-- 회사 A(직원 a_e1·a_e2), 회사 B(직원 b_e1). 셋 다 같은 영수증(승인번호 30012345)을 올린다.
-- =============================================================================
begin;

create or replace function public._t_expect(p_sql text, p_code text, p_label text)
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
from unnest(array['a2100000-0000-0000-0000-000000000002', 'a2100000-0000-0000-0000-000000000003', 'b2100000-0000-0000-0000-000000000002']::uuid[]) u;
insert into public.companies (id, name, invite_code, business_number) values
  ('c2100000-0000-0000-0000-00000000000a', '상세회사A', 'DTLAAAAA', '1000000211'),
  ('c2100000-0000-0000-0000-00000000000b', '상세회사B', 'DTLBBBBB', '1000000212');
insert into public.members (id, auth_user_id, company_id, name, phone, role, status, privacy_agreed_at) values
  ('a2200000-0000-0000-0000-000000000002', 'a2100000-0000-0000-0000-000000000002', 'c2100000-0000-0000-0000-00000000000a', 'A직원1', '01096201001', 'employee', 'approved', now()),
  ('a2200000-0000-0000-0000-000000000003', 'a2100000-0000-0000-0000-000000000003', 'c2100000-0000-0000-0000-00000000000a', 'A직원2', '01096201002', 'employee', 'approved', now()),
  ('b2200000-0000-0000-0000-000000000002', 'b2100000-0000-0000-0000-000000000002', 'c2100000-0000-0000-0000-00000000000b', 'B직원1', '01097201001', 'employee', 'approved', now());
insert into public.expense_claims (id, company_id, member_id, title) values
  ('a2300000-0000-0000-0000-000000000001', 'c2100000-0000-0000-0000-00000000000a', 'a2200000-0000-0000-0000-000000000002', 'A직원1 첫 소명서'),
  ('a2300000-0000-0000-0000-000000000002', 'c2100000-0000-0000-0000-00000000000a', 'a2200000-0000-0000-0000-000000000002', 'A직원1 둘째 소명서'),
  ('a2300000-0000-0000-0000-000000000003', 'c2100000-0000-0000-0000-00000000000a', 'a2200000-0000-0000-0000-000000000003', 'A직원2 비밀 제목'),
  ('b2300000-0000-0000-0000-000000000001', 'c2100000-0000-0000-0000-00000000000b', 'b2200000-0000-0000-0000-000000000002', 'B직원1 소명서');

-- 같은 영수증을 올렸다고 가정 (AI 결과 그대로)
create temp table t_payload as select '{
  "merchant_name":"김밥천국 강남역점","merchant_business_number":"220-81-62517","amount":31000,"expense_date":"2026-10-16",
  "paid_time":"12:41","approval_number":"3001 2345","merchant_address":"  서울 강남구 테헤란로 123  ",
  "line_items":[{"name":"참치김밥","quantity":2,"unit_price":4500,"amount":9000},{"name":"라볶이","quantity":"2","amount":13000},{"name":"","amount":1},"bad",{"name":"할인","amount":-1000}]
}'::jsonb as p;
grant select on t_payload to authenticated;

-- ── A 직원1: 참고 정보 저장 + 내 소명서 두 곳에 같은 영수증 ────────────────────────────
select set_config('request.jwt.claims', '{"sub":"a2100000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
do $$
declare r1 jsonb; r2 jsonb; d jsonb;
begin
  r1 := public.create_receipt_item('a2300000-0000-0000-0000-000000000001');
  perform public.apply_receipt_parse((r1->>'item_id')::uuid, true, (select p from t_payload));
  perform set_config('t.a1', r1->>'item_id', true);
  if (select row(paid_time, approval_number, merchant_address)::text from public.expense_items where id = (r1->>'item_id')::uuid)
     <> row('12:41:00'::time, '30012345', '서울 강남구 테헤란로 123')::text then
    raise exception 'FAIL [A_E1] details not stored: %', (select row(paid_time, approval_number, merchant_address)::text from public.expense_items where id = (r1->>'item_id')::uuid);
  end if;
  -- 품목: 빈 이름·객체 아님은 버리고, 수량 문자열 "2"도 숫자로, 음수(할인)는 그대로
  if (select line_items from public.expense_items where id = (r1->>'item_id')::uuid)
     <> '[{"name":"참치김밥","quantity":2,"unit_price":4500,"amount":9000},{"name":"라볶이","quantity":2,"unit_price":null,"amount":13000},{"name":"할인","quantity":null,"unit_price":null,"amount":-1000}]'::jsonb then
    raise exception 'FAIL [A_E1] line items: %', (select line_items from public.expense_items where id = (r1->>'item_id')::uuid);
  end if;
  -- 아직 중복 없음
  if public.claim_duplicate_receipts('a2300000-0000-0000-0000-000000000001') <> '{}'::jsonb then raise exception 'FAIL [A_E1] false duplicate'; end if;

  r2 := public.create_receipt_item('a2300000-0000-0000-0000-000000000002');
  perform public.apply_receipt_parse((r2->>'item_id')::uuid, true, (select p from t_payload));
  d := public.claim_duplicate_receipts('a2300000-0000-0000-0000-000000000002');
  if d->(r2->>'item_id')->'mine'->0->>'title' <> 'A직원1 첫 소명서' or (d->(r2->>'item_id')->>'others')::int <> 0 then
    raise exception 'FAIL [A_E1] own duplicate not found: %', d;
  end if;

  -- 잘못된 값은 버린다
  r2 := public.create_receipt_item('a2300000-0000-0000-0000-000000000002');
  perform public.apply_receipt_parse((r2->>'item_id')::uuid, true,
    jsonb_build_object('amount', 500, 'paid_time', '25:00', 'approval_number', '12', 'merchant_address', repeat('가', 300),
                       'line_items', (select jsonb_agg(jsonb_build_object('name', 'x' || g, 'amount', g)) from generate_series(1, 60) g)));
  if (select row(paid_time, approval_number, length(merchant_address), jsonb_array_length(line_items))::text from public.expense_items where id = (r2->>'item_id')::uuid)
     <> row(null::time, null::text, 200, 50)::text then
    raise exception 'FAIL [A_E1] invalid details not rejected';
  end if;
end $$;
-- 참고 정보는 직접 못 바꾼다(서버 함수로만)
select public._t_expect(format($q$update public.expense_items set approval_number = '99999999' where id = %L$q$, current_setting('t.a1')), 'permission denied for table expense_items', 'A_E1 direct approval');
select public._t_expect(format($q$update public.expense_items set line_items = '[]' where id = %L$q$, current_setting('t.a1')), 'permission denied for table expense_items', 'A_E1 direct line items');
reset role;

-- ── A 직원2: 같은 영수증 → "다른 직원 1건"만 알 수 있고 제목은 모른다 ─────────────────────
select set_config('request.jwt.claims', '{"sub":"a2100000-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
do $$
declare r jsonb; d jsonb;
begin
  r := public.create_receipt_item('a2300000-0000-0000-0000-000000000003');
  -- 승인번호를 못 읽어도 사업자번호+날짜+시각+금액이 같으면 중복
  perform public.apply_receipt_parse((r->>'item_id')::uuid, true, (select p - 'approval_number' from t_payload));
  d := public.claim_duplicate_receipts('a2300000-0000-0000-0000-000000000003');
  if (d->(r->>'item_id')->>'others')::int <> 2 or jsonb_array_length(d->(r->>'item_id')->'mine') <> 0 or d::text like '%첫 소명서%' then
    raise exception 'FAIL [A_E2] other-member duplicate: %', d;
  end if;
end $$;
select public._t_expect($q$select public.claim_duplicate_receipts('a2300000-0000-0000-0000-000000000001')$q$, 'NOT_FOUND', 'A_E2 other member claim');
reset role;

-- ── B 직원1(다른 회사): 같은 영수증이어도 A 회사 것은 세지 않고, A 소명서는 조회 불가 ───────────
select set_config('request.jwt.claims', '{"sub":"b2100000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
do $$
declare r jsonb;
begin
  r := public.create_receipt_item('b2300000-0000-0000-0000-000000000001');
  perform public.apply_receipt_parse((r->>'item_id')::uuid, true, (select p from t_payload));
  if public.claim_duplicate_receipts('b2300000-0000-0000-0000-000000000001') <> '{}'::jsonb then raise exception 'FAIL [B_E1] counted other company receipts'; end if;
  if (select count(*) from public.expense_items where line_items <> '[]') <> 1 then raise exception 'FAIL [B_E1] sees other company items'; end if;
end $$;
select public._t_expect($q$select public.claim_duplicate_receipts('a2300000-0000-0000-0000-000000000001')$q$, 'NOT_FOUND', 'B_E1 A claim');
reset role;

select 'RECEIPT_DETAILS_OK' as result;
rollback;
