-- =============================================================================
-- 045_odometer_photos.sql — 자차 계기판 사진 2장 (migration 073, D-070 ②, D-144)
--   켠 회사만 상신 검증에 걸림 · 경로는 함수만 씀(직접 쓰기 불가) · 자차 항목만 · 본인 작성 중 결의서만 · 열람 회사 격리
-- =============================================================================
begin;

insert into auth.users (id, instance_id, aud, role, email)
select u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u::text || '@test.local'
from unnest(array['a4500000-0000-0000-0000-000000000031', 'a4500000-0000-0000-0000-000000000032', 'b4500000-0000-0000-0000-000000000031']::uuid[]) u;
insert into public.companies (id, name, invite_code, business_number, fuel_enabled, odometer_photo_required) values
  ('c4500000-0000-0000-0000-00000000000a', '계기판회사A', 'KMTRAAAA', '1000000451', true, true),
  ('c4500000-0000-0000-0000-00000000000b', '계기판회사B', 'KMTRBBBB', '1000000452', true, false);
insert into public.members (id, auth_user_id, company_id, name, phone, role, status, privacy_agreed_at) values
  ('a4510000-0000-0000-0000-000000000031', 'a4500000-0000-0000-0000-000000000031', 'c4500000-0000-0000-0000-00000000000a', 'A직원', '01094501001', 'employee', 'approved', now()),
  ('a4510000-0000-0000-0000-000000000032', 'a4500000-0000-0000-0000-000000000032', 'c4500000-0000-0000-0000-00000000000a', 'A대표', '01094501002', 'super_admin', 'approved', now()),
  ('b4510000-0000-0000-0000-000000000031', 'b4500000-0000-0000-0000-000000000031', 'c4500000-0000-0000-0000-00000000000b', 'B대표', '01094502001', 'super_admin', 'approved', now());
insert into public.expense_claims (id, company_id, member_id, title, status, is_business_trip) values
  ('a4520000-0000-0000-0000-000000000031', 'c4500000-0000-0000-0000-00000000000a', 'a4510000-0000-0000-0000-000000000031', '부산 출장', 'draft', true);
insert into public.expense_items (id, claim_id, company_id, sort_order, category, trip_type, payment_method, expense_date, headcount, start_location, start_lat, start_lng, end_location, end_lat, end_lng, is_round_trip, route_one_way_km, distance_km, distance_source, amount, evidence_type)
values
  ('a4530000-0000-0000-0000-000000000031', 'a4520000-0000-0000-0000-000000000031', 'c4500000-0000-0000-0000-00000000000a', 1, 'trip', 'own_car', 'personal_card', '2026-10-14', 1,
   '판교역', 37.394777, 127.111197, '부산역', 35.115225, 129.042243, false, 377, 377, 'api', 75400, 'other');
insert into public.expense_items (id, claim_id, company_id, sort_order, category, trip_type, payment_method, expense_date, amount, evidence_type)
values ('a4530000-0000-0000-0000-000000000032', 'a4520000-0000-0000-0000-000000000031', 'c4500000-0000-0000-0000-00000000000a', 2, 'trip', 'toll_parking', 'personal_card', '2026-10-14', 5000, 'card_slip');

-- 켠 회사: 사진이 없으면 상신 검증에 걸린다
do $$
begin
  if not exists (
    select 1 from jsonb_array_elements(private.claim_problems('a4520000-0000-0000-0000-000000000031')->'items') x
     where x->>'item_id' = 'a4530000-0000-0000-0000-000000000031' and x->'fields' ? 'odometer_photos') then
    raise exception 'FAIL missing odometer_photos problem';
  end if;
end;
$$;

-- A 직원
select set_config('request.jwt.claims', '{"sub":"a4500000-0000-0000-0000-000000000031","role":"authenticated"}', true);
set local role authenticated;
do $$
declare v_path text;
begin
  -- 경로 칸은 직접 못 쓴다
  begin
    update public.expense_items set odometer_start_path = 'c4500000-0000-0000-0000-00000000000a/x.jpg' where id = 'a4530000-0000-0000-0000-000000000031';
    raise exception 'FAIL [A_E] wrote odometer path directly';
  exception when insufficient_privilege then null;
  end;
  -- 자차가 아닌 항목에는 못 붙인다
  begin
    perform public.attach_odometer_photo('a4530000-0000-0000-0000-000000000032', 'start');
    raise exception 'FAIL [A_E] attached to non own_car';
  exception when others then if sqlerrm <> 'NOT_ALLOWED' then raise; end if;
  end;
  begin
    perform public.attach_odometer_photo('a4530000-0000-0000-0000-000000000031', 'middle');
    raise exception 'FAIL [A_E] bad which accepted';
  exception when others then if sqlerrm <> 'INVALID_FILE' then raise; end if;
  end;
  v_path := public.attach_odometer_photo('a4530000-0000-0000-0000-000000000031', 'start');
  if v_path <> 'c4500000-0000-0000-0000-00000000000a/a4510000-0000-0000-0000-000000000031/a4520000-0000-0000-0000-000000000031/a4530000-0000-0000-0000-000000000031_odo_start.jpg' then
    raise exception 'FAIL [A_E] unexpected path %', v_path;
  end if;
  perform public.attach_odometer_photo('a4530000-0000-0000-0000-000000000031', 'end');
  -- 내 폴더에 올릴 수 있다(기존 receipts 정책)
  insert into storage.objects (bucket_id, name) values ('receipts', v_path);
  if (select count(*) from storage.objects where name like '%_odo_%') <> 1 then raise exception 'FAIL [A_E] cannot see own odometer photo'; end if;
end;
$$;
reset role;

do $$
begin
  if exists (
    select 1 from jsonb_array_elements(private.claim_problems('a4520000-0000-0000-0000-000000000031')->'items') x
     where x->'fields' ? 'odometer_photos') then
    raise exception 'FAIL odometer_photos problem after both attached';
  end if;
end;
$$;

-- A 대표: 보인다 / B 대표: 안 보이고 못 붙인다
select set_config('request.jwt.claims', '{"sub":"a4500000-0000-0000-0000-000000000032","role":"authenticated"}', true);
set local role authenticated;
do $$ begin if (select count(*) from storage.objects where name like '%_odo_%') <> 1 then raise exception 'FAIL [A_SUP] cannot see odometer photo'; end if; end; $$;
do $$
begin
  perform public.attach_odometer_photo('a4530000-0000-0000-0000-000000000031', 'start');
  raise exception 'FAIL [A_SUP] attached to other member claim';
exception when others then if sqlerrm <> 'NOT_FOUND' then raise; end if;
end;
$$;
reset role;
select set_config('request.jwt.claims', '{"sub":"b4500000-0000-0000-0000-000000000031","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  if (select count(*) from storage.objects where name like '%_odo_%') <> 0 then raise exception 'FAIL [B_SUP] sees A odometer photo'; end if;
  begin
    perform public.detach_odometer_photo('a4530000-0000-0000-0000-000000000031', 'start');
    raise exception 'FAIL [B_SUP] detached A photo';
  exception when others then if sqlerrm <> 'NOT_FOUND' then raise; end if;
  end;
end;
$$;
reset role;

-- 떼기: 지운 경로를 돌려주고, 다시 검증에 걸린다 / 상신 뒤에는 못 고친다
select set_config('request.jwt.claims', '{"sub":"a4500000-0000-0000-0000-000000000031","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  if public.detach_odometer_photo('a4530000-0000-0000-0000-000000000031', 'end') not like '%_odo_end.jpg' then raise exception 'FAIL [A_E] detach returned wrong path'; end if;
end;
$$;
reset role;
do $$
begin
  if not exists (select 1 from jsonb_array_elements(private.claim_problems('a4520000-0000-0000-0000-000000000031')->'items') x where x->'fields' ? 'odometer_photos') then
    raise exception 'FAIL problem not back after detach';
  end if;
  -- 끈 회사(설정 끔)면 사진이 없어도 걸리지 않는다
  update public.companies set odometer_photo_required = false where id = 'c4500000-0000-0000-0000-00000000000a';
  if exists (select 1 from jsonb_array_elements(private.claim_problems('a4520000-0000-0000-0000-000000000031')->'items') x where x->'fields' ? 'odometer_photos') then
    raise exception 'FAIL problem when setting off';
  end if;
  update public.expense_claims set status = 'submitted' where id = 'a4520000-0000-0000-0000-000000000031';
end;
$$;
select set_config('request.jwt.claims', '{"sub":"a4500000-0000-0000-0000-000000000031","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  perform public.attach_odometer_photo('a4530000-0000-0000-0000-000000000031', 'end');
  raise exception 'FAIL [A_E] attached after submit';
exception when others then if sqlerrm <> 'NOT_EDITABLE' then raise; end if;
end;
$$;
reset role;

-- 다른 회사 경로는 칸에 들어가지 않는다
do $$
begin
  update public.expense_items set odometer_end_path = 'c4500000-0000-0000-0000-00000000000b/x.jpg' where id = 'a4530000-0000-0000-0000-000000000031';
  raise exception 'FAIL other company path accepted';
exception when check_violation then null;
end;
$$;

select 'ODOMETER_PHOTOS_OK' as result;
rollback;
