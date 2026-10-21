-- =============================================================================
-- 024_route_card_file.sql — 자차 경로 증빙 이미지: 서버만 쓰기, 직원 업로드 불가, 열람 격리, 값 바뀌면 연결 해제 (migration 041)
-- =============================================================================
begin;

insert into auth.users (id, instance_id, aud, role, email)
select u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u::text || '@test.local'
from unnest(array['a2400000-0000-0000-0000-000000000031', 'a2400000-0000-0000-0000-000000000032', 'b2400000-0000-0000-0000-000000000031']::uuid[]) u;
insert into public.companies (id, name, invite_code, business_number) values
  ('c2400000-0000-0000-0000-00000000000a', '증빙회사A', 'RCARDAAA', '1000000241'),
  ('c2400000-0000-0000-0000-00000000000b', '증빙회사B', 'RCARDBBB', '1000000242');
insert into public.members (id, auth_user_id, company_id, name, phone, role, status, privacy_agreed_at) values
  ('a2410000-0000-0000-0000-000000000031', 'a2400000-0000-0000-0000-000000000031', 'c2400000-0000-0000-0000-00000000000a', 'A직원', '01092401001', 'employee', 'approved', now()),
  ('a2410000-0000-0000-0000-000000000032', 'a2400000-0000-0000-0000-000000000032', 'c2400000-0000-0000-0000-00000000000a', 'A대표', '01092401002', 'super_admin', 'approved', now()),
  ('b2410000-0000-0000-0000-000000000031', 'b2400000-0000-0000-0000-000000000031', 'c2400000-0000-0000-0000-00000000000b', 'B대표', '01092402001', 'super_admin', 'approved', now());
insert into public.expense_claims (id, company_id, member_id, title, status, is_business_trip) values
  ('a2420000-0000-0000-0000-000000000031', 'c2400000-0000-0000-0000-00000000000a', 'a2410000-0000-0000-0000-000000000031', '부산 출장', 'draft', true);
insert into public.expense_items (id, claim_id, company_id, sort_order, category, trip_type, payment_method, expense_date, headcount, start_location, start_lat, start_lng, end_location, end_lat, end_lng, is_round_trip, route_one_way_km, distance_km, distance_source, amount)
values ('a2430000-0000-0000-0000-000000000031', 'a2420000-0000-0000-0000-000000000031', 'c2400000-0000-0000-0000-00000000000a', 1, 'trip', 'own_car', 'personal_card', '2026-10-14', 1,
        '판교역', 37.394777, 127.111197, '부산역', 35.115225, 129.042243, true, 377, 754, 'api', 150800);
update public.expense_claims set status = 'submitted' where id = 'a2420000-0000-0000-0000-000000000031';

-- 서버(상신 뒤)가 파일 저장 + 연결
insert into storage.objects (bucket_id, name) values ('receipts', 'c2400000-0000-0000-0000-00000000000a/route-cards/a2420000-0000-0000-0000-000000000031/a2430000-0000-0000-0000-000000000031.png');
update public.expense_items set route_card_path = 'c2400000-0000-0000-0000-00000000000a/route-cards/a2420000-0000-0000-0000-000000000031/a2430000-0000-0000-0000-000000000031.png'
 where id = 'a2430000-0000-0000-0000-000000000031';
do $$
begin
  begin
    update public.expense_items set route_card_path = 'c2400000-0000-0000-0000-00000000000b/route-cards/x.png' where id = 'a2430000-0000-0000-0000-000000000031';
    raise exception 'FAIL other company path accepted';
  exception when check_violation then null;
  end;
end;
$$;

-- A 직원: 파일이 보인다, 연결 칸은 못 쓴다, route-cards 폴더에 올리지 못한다
select set_config('request.jwt.claims', '{"sub":"a2400000-0000-0000-0000-000000000031","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  if (select count(*) from storage.objects where name like '%/route-cards/%') <> 1 then raise exception 'FAIL [A_E] cannot see route card'; end if;
  begin
    update public.expense_items set route_card_path = null where id = 'a2430000-0000-0000-0000-000000000031';
    raise exception 'FAIL [A_E] wrote route_card_path';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into storage.objects (bucket_id, name) values ('receipts', 'c2400000-0000-0000-0000-00000000000a/route-cards/a2420000-0000-0000-0000-000000000031/fake.png');
    raise exception 'FAIL [A_E] uploaded into route-cards';
  exception when insufficient_privilege or check_violation then null;
           when others then if sqlstate <> '42501' then raise; end if;
  end;
end;
$$;
reset role;

-- A 대표: 보인다 / B 대표: 안 보인다
select set_config('request.jwt.claims', '{"sub":"a2400000-0000-0000-0000-000000000032","role":"authenticated"}', true);
set local role authenticated;
do $$ begin if (select count(*) from storage.objects where name like '%/route-cards/%') <> 1 then raise exception 'FAIL [A_SUP] cannot see'; end if; end; $$;
reset role;
select set_config('request.jwt.claims', '{"sub":"b2400000-0000-0000-0000-000000000031","role":"authenticated"}', true);
set local role authenticated;
do $$ begin if (select count(*) from storage.objects where name like '%/route-cards/%') <> 0 then raise exception 'FAIL [B_SUP] sees A route card'; end if; end; $$;
reset role;

-- 값이 바뀌면 연결 해제 (반려 후 고친 경우), 관계없는 칸이 바뀌면 유지
do $$
begin
  update public.expense_items set purpose = '적요만 바꿈' where id = 'a2430000-0000-0000-0000-000000000031';
  if (select route_card_path from public.expense_items where id = 'a2430000-0000-0000-0000-000000000031') is null then raise exception 'FAIL cleared on unrelated change'; end if;
  update public.expense_items set is_round_trip = false, distance_km = 377, amount = 75400 where id = 'a2430000-0000-0000-0000-000000000031';
  if (select route_card_path from public.expense_items where id = 'a2430000-0000-0000-0000-000000000031') is not null then raise exception 'FAIL stale route card kept'; end if;
end;
$$;

select 'ROUTE_CARD_FILE_OK' as result;
rollback;
