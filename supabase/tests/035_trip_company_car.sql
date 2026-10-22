-- =============================================================================
-- 035_trip_company_car.sql — 회사차량으로 간 출장(D-106) + 교육훈련비(D-107), migration 053·054
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
from unnest(array['a3500000-0000-0000-0000-000000000001', 'b3500000-0000-0000-0000-000000000001']::uuid[]) u;
insert into public.companies (id, name, invite_code, business_number) values
  ('c3500000-0000-0000-0000-00000000000a', '출장차량A', 'TRCRAAAA', '1000000351'),
  ('c3500000-0000-0000-0000-00000000000b', '출장차량B', 'TRCRBBBB', '1000000352');
insert into public.members (id, auth_user_id, company_id, name, phone, role, status, privacy_agreed_at) values
  ('a3510000-0000-0000-0000-000000000001', 'a3500000-0000-0000-0000-000000000001', 'c3500000-0000-0000-0000-00000000000a', 'A직원', '01093501001', 'employee', 'approved', now()),
  ('b3510000-0000-0000-0000-000000000001', 'b3500000-0000-0000-0000-000000000001', 'c3500000-0000-0000-0000-00000000000b', 'B직원', '01093502001', 'employee', 'approved', now());
select private.seed_account_defaults('c3500000-0000-0000-0000-00000000000a');
-- B 회사 관리자가 세미나를 도서인쇄비로 직접 정해 둔 경우(다시 실행해도 바꾸지 않음)
select private.seed_account_defaults('c3500000-0000-0000-0000-00000000000b');
update public.account_title_mappings set account_title_id = (select id from public.account_titles where company_id = 'c3500000-0000-0000-0000-00000000000b' and name = '지급수수료')
 where company_id = 'c3500000-0000-0000-0000-00000000000b' and category = 'seminar';
select private.seed_account_defaults('c3500000-0000-0000-0000-00000000000b');

do $$
declare v jsonb;
begin
  select jsonb_object_agg(coalesce(m.trip_type::text, m.category::text), t.name) into v
    from public.account_title_mappings m join public.account_titles t on t.id = m.account_title_id
   where m.company_id = 'c3500000-0000-0000-0000-00000000000a' and (m.category in ('seminar', 'training', 'books') or m.trip_type in ('car_fuel', 'car_toll', 'toll_parking', 'lodging'));
  if v <> '{"seminar":"교육훈련비","training":"교육훈련비","books":"도서인쇄비","car_fuel":"차량유지비","car_toll":"차량유지비","toll_parking":"여비교통비","lodging":"여비교통비"}'::jsonb then
    raise exception 'FAIL [mapping] %', v;
  end if;
  if (select t.name from public.account_title_mappings m join public.account_titles t on t.id = m.account_title_id
       where m.company_id = 'c3500000-0000-0000-0000-00000000000b' and m.category = 'seminar') <> '지급수수료' then raise exception 'FAIL [admin mapping kept]'; end if;
end;
$$;

insert into public.company_vehicles (id, company_id, nickname, plate_number) values
  ('a3540000-0000-0000-0000-000000000001', 'c3500000-0000-0000-0000-00000000000a', '영업 1호차', '12가3456'),
  ('b3540000-0000-0000-0000-000000000001', 'c3500000-0000-0000-0000-00000000000b', 'B차', '56다7890');
insert into public.expense_claims (id, company_id, member_id, title, description, trip_destination, trip_start_date, trip_end_date, trip_purpose) values
  ('a3520000-0000-0000-0000-000000000001', 'c3500000-0000-0000-0000-00000000000a', 'a3510000-0000-0000-0000-000000000001', '부산 출장', '사유', '부산', '2026-10-14', '2026-10-15', '점검');
insert into public.expense_items (id, claim_id, company_id, sort_order, category, trip_type, payment_method, evidence_type, expense_date, amount, headcount, merchant_name, receipt_path, ai_parsed_payload) values
  ('a3530000-0000-0000-0000-000000000001', 'a3520000-0000-0000-0000-000000000001', 'c3500000-0000-0000-0000-00000000000a', 1, 'trip', 'toll_parking', 'personal_card', 'card_slip', '2026-10-14', 18000, 1, '한국도로공사', 'c3500000-0000-0000-0000-00000000000a/r/1.jpg', '{"suggested_category":"trip","suggested_trip_type":"toll_parking"}'),
  ('a3530000-0000-0000-0000-000000000002', 'a3520000-0000-0000-0000-000000000001', 'c3500000-0000-0000-0000-00000000000a', 2, 'trip', null, 'personal_card', 'card_slip', '2026-10-14', 70000, 1, 'SK주유소', 'c3500000-0000-0000-0000-00000000000a/r/2.jpg', '{"suggested_category":"trip","suggested_trip_type":"car_fuel"}'),
  ('a3530000-0000-0000-0000-000000000003', 'a3520000-0000-0000-0000-000000000001', 'c3500000-0000-0000-0000-00000000000a', 3, 'trip', 'lodging', 'personal_card', 'card_slip', '2026-10-14', 90000, 1, '부산호텔', 'c3500000-0000-0000-0000-00000000000a/r/3.jpg', '{"suggested_category":"trip","suggested_trip_type":"lodging"}');

select set_config('request.jwt.claims', '{"sub":"a3500000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
-- 다른 회사 차량은 못 고른다
select public._t_raises($q$select public.set_claim_category('a3520000-0000-0000-0000-000000000001', 'trip', p_trip_transport => 'company_car', p_vehicle_id => 'b3540000-0000-0000-0000-000000000001')$q$, 'INVALID_VEHICLE', 'A other company vehicle');
do $$
declare v jsonb; p jsonb;
begin
  -- 회사차량 출장, 차량 없이 → 차량을 묻는다
  perform public.set_claim_category('a3520000-0000-0000-0000-000000000001', 'trip', p_trip_transport => 'company_car');
  p := public.check_claim_for_submit('a3520000-0000-0000-0000-000000000001');
  if not (p->'header' ? 'vehicle') then raise exception 'FAIL [vehicle required] %', p; end if;
  perform public.set_claim_category('a3520000-0000-0000-0000-000000000001', 'trip', p_trip_transport => 'company_car', p_vehicle_id => 'a3540000-0000-0000-0000-000000000001');
  if (select row(trip_transport, vehicle_id)::text from public.expense_claims where id = 'a3520000-0000-0000-0000-000000000001')
     <> row('company_car'::public.trip_transport, 'a3540000-0000-0000-0000-000000000001'::uuid)::text then raise exception 'FAIL [saved]'; end if;
  select jsonb_object_agg(merchant_name, trip_type) into v from public.expense_items where claim_id = 'a3520000-0000-0000-0000-000000000001';
  if v <> '{"한국도로공사":"car_toll","SK주유소":"car_fuel","부산호텔":"lodging"}'::jsonb then raise exception 'FAIL [types company car] %', v; end if;
  if jsonb_array_length(public.check_claim_for_submit('a3520000-0000-0000-0000-000000000001')->'header') <> 0 then raise exception 'FAIL [no header problems] %', public.check_claim_for_submit('a3520000-0000-0000-0000-000000000001'); end if;

  -- 이동 수단을 대중교통으로 바꾸면(헤더 직접 저장도) 되돌리고 차량을 비운다
  update public.expense_claims set trip_transport = 'public_transport' where id = 'a3520000-0000-0000-0000-000000000001';
  select jsonb_object_agg(merchant_name, trip_type) into v from public.expense_items where claim_id = 'a3520000-0000-0000-0000-000000000001';
  if v <> '{"한국도로공사":"toll_parking","SK주유소":"other","부산호텔":"lodging"}'::jsonb then raise exception 'FAIL [types revert] %', v; end if;
  if (select vehicle_id from public.expense_claims where id = 'a3520000-0000-0000-0000-000000000001') is not null then raise exception 'FAIL [vehicle cleared]'; end if;
  -- 다시 회사차량 → 톨비는 회사차량 통행료로(주유는 직원이 다시 고름: 지금 '기타')
  perform public.set_claim_category('a3520000-0000-0000-0000-000000000001', 'trip', p_trip_transport => 'company_car', p_vehicle_id => 'a3540000-0000-0000-0000-000000000001');
  if (select trip_type from public.expense_items where id = 'a3530000-0000-0000-0000-000000000001') <> 'car_toll' then raise exception 'FAIL [toll again]'; end if;
  update public.expense_items set trip_type = 'car_fuel' where id = 'a3530000-0000-0000-0000-000000000002';
  if (select trip_type from public.expense_items where id = 'a3530000-0000-0000-0000-000000000002') <> 'car_fuel' then raise exception 'FAIL [pick car_fuel]'; end if;
  -- 출장비가 아닌 카테고리면 이동 수단·차량 비움
  perform public.set_claim_category('a3520000-0000-0000-0000-000000000001', 'meal');
  if (select row(trip_transport, vehicle_id, is_business_trip)::text from public.expense_claims where id = 'a3520000-0000-0000-0000-000000000001')
     <> row(null::public.trip_transport, null::uuid, false)::text then raise exception 'FAIL [non trip clears]'; end if;
end;
$$;
reset role;

select 'TRIP_COMPANY_CAR_OK' as result;
rollback;
