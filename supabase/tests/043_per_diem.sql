-- =============================================================================
-- 043_per_diem.sql — 출장 일비(하루 정액, 식비 포함) (D-124, migration 063·064)
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
from unnest(array['a4300000-0000-0000-0000-000000000001', 'a4300000-0000-0000-0000-000000000002', 'a4300000-0000-0000-0000-000000000003']::uuid[]) u;
insert into public.companies (id, name, invite_code, business_number) values
  ('c4300000-0000-0000-0000-00000000000a', '일비회사', 'PRDMCPNA', '1000000431'),
  ('c4300000-0000-0000-0000-00000000000b', '다른회사', 'PRDMCPNB', '1000000432');
select private.seed_account_defaults('c4300000-0000-0000-0000-00000000000a');
insert into public.members (id, auth_user_id, company_id, name, phone, role, status, privacy_agreed_at) values
  ('a4310000-0000-0000-0000-000000000001', 'a4300000-0000-0000-0000-000000000001', 'c4300000-0000-0000-0000-00000000000a', '관리자', '01094301001', 'super_admin', 'approved', now()),
  ('a4310000-0000-0000-0000-000000000002', 'a4300000-0000-0000-0000-000000000002', 'c4300000-0000-0000-0000-00000000000a', '직원', '01094301002', 'employee', 'approved', now()),
  ('a4310000-0000-0000-0000-000000000003', 'a4300000-0000-0000-0000-000000000003', 'c4300000-0000-0000-0000-00000000000b', '남의관리자', '01094301003', 'super_admin', 'approved', now());
insert into public.expense_claims (id, company_id, member_id, title, description, category, is_business_trip, trip_destination, trip_start_date, trip_end_date, trip_purpose, trip_transport) values
  ('a4320000-0000-0000-0000-000000000001', 'c4300000-0000-0000-0000-00000000000a', 'a4310000-0000-0000-0000-000000000002', '부산 출장', '점검', 'trip', true, '부산', '2026-10-14', '2026-10-15', '점검', 'public_transport');
insert into public.expense_items (id, claim_id, company_id, sort_order, category, trip_type, payment_method, evidence_type, expense_date, amount, receipt_path) values
  ('a4330000-0000-0000-0000-000000000001', 'a4320000-0000-0000-0000-000000000001', 'c4300000-0000-0000-0000-00000000000a', 1, 'trip', 'public_transport', 'personal_card', 'card_slip', '2026-10-14', 59800, 'c4300000-0000-0000-0000-00000000000a/x/ktx.jpg'),
  ('a4330000-0000-0000-0000-000000000002', 'a4320000-0000-0000-0000-000000000001', 'c4300000-0000-0000-0000-00000000000a', 2, 'trip', 'meal', 'personal_card', 'card_slip', '2026-10-14', 12000, 'c4300000-0000-0000-0000-00000000000a/x/meal.jpg');

do $$
begin
  if (select string_agg(t.name, ',') from public.account_title_mappings m join public.account_titles t on t.id = m.account_title_id
       where m.company_id = 'c4300000-0000-0000-0000-00000000000a' and m.category = 'trip' and m.trip_type = 'per_diem') <> '여비교통비' then
    raise exception 'FAIL [per_diem mapping]';
  end if;
  -- 일비를 안 쓰면 일비 줄 없음
  perform private.recompute_claim('a4320000-0000-0000-0000-000000000001');
  if exists (select 1 from public.expense_items where claim_id = 'a4320000-0000-0000-0000-000000000001' and trip_type = 'per_diem') then raise exception 'FAIL [off no line]'; end if;
end;
$$;

-- 직원: 일비 설정 불가
select set_config('request.jwt.claims', '{"sub":"a4300000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select public._t_raises($q$select public.set_company_per_diem(true, 30000)$q$, '42501', 'E set per diem');
reset role;

-- 관리자: 하루 3만 원, 0원으로 켜기는 거절
select set_config('request.jwt.claims', '{"sub":"a4300000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select public._t_raises($q$select public.set_company_per_diem(true, 0)$q$, 'INVALID_PER_DIEM', 'A zero');
select public.set_company_per_diem(true, 30000);
reset role;

-- 직원: 1박 2일 → 일비 60,000원 한 줄(사비 지급·증빙 없음), 출장 식비가 있으면 상신 막힘, 일비 줄은 직접 못 고치고 못 지움
select set_config('request.jwt.claims', '{"sub":"a4300000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
do $$
declare r record; p jsonb; n integer;
begin
  perform public.refresh_claim_totals('a4320000-0000-0000-0000-000000000001');
  select * into r from public.expense_items where claim_id = 'a4320000-0000-0000-0000-000000000001' and trip_type = 'per_diem';
  if row(r.amount, r.company_supported_amount, r.payment_method::text, r.evidence_kind, r.merchant_name)::text <> row(60000, 60000, 'personal_card', 'none', '출장 일비')::text then
    raise exception 'FAIL [line] %', row(r.amount, r.company_supported_amount, r.payment_method, r.evidence_kind, r.merchant_name);
  end if;
  perform set_config('t.pd', r.id::text, true);
  p := public.check_claim_for_submit('a4320000-0000-0000-0000-000000000001');
  if not exists (select 1 from jsonb_array_elements(p->'items') x where x->>'item_id' = 'a4330000-0000-0000-0000-000000000002' and x->'fields' ? 'per_diem_meal') then raise exception 'FAIL [meal blocked] %', p; end if;
  if exists (select 1 from jsonb_array_elements(p->'items') x where x->>'item_id' = r.id::text) then raise exception 'FAIL [per diem line has problems] %', p; end if;
  update public.expense_items set amount = 1 where id = r.id;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL [employee updated per diem]'; end if;
  delete from public.expense_items where id = r.id;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL [employee deleted per diem]'; end if;
end;
$$;
select public._t_raises($q$insert into public.expense_items (claim_id, company_id, sort_order, category, trip_type, payment_method, amount) values ('a4320000-0000-0000-0000-000000000001', 'c4300000-0000-0000-0000-00000000000a', 9, 'trip', 'per_diem', 'personal_card', 999999)$q$, '42501', 'E insert per diem');
-- 식비 영수증을 지우면 문제 없음
delete from public.expense_items where id = 'a4330000-0000-0000-0000-000000000002';
-- 출장 기간을 3박 4일로 → 120,000원, 출장이 아니게 바꾸면 일비 줄 사라짐
update public.expense_claims set trip_end_date = '2026-10-17' where id = 'a4320000-0000-0000-0000-000000000001';
do $$
declare p jsonb;
begin
  perform public.refresh_claim_totals('a4320000-0000-0000-0000-000000000001');
  if (select amount from public.expense_items where claim_id = 'a4320000-0000-0000-0000-000000000001' and trip_type = 'per_diem') <> 120000 then raise exception 'FAIL [4 days]'; end if;
  if (select count(*) from public.expense_items where claim_id = 'a4320000-0000-0000-0000-000000000001' and trip_type = 'per_diem') <> 1 then raise exception 'FAIL [one line]'; end if;
  p := public.check_claim_for_submit('a4320000-0000-0000-0000-000000000001');
  if jsonb_array_length(p->'items') > 0 then raise exception 'FAIL [clean] %', p; end if;
  if (select total_amount from public.expense_claims where id = 'a4320000-0000-0000-0000-000000000001') <> 179800 then raise exception 'FAIL [total]'; end if;
  perform public.set_claim_category('a4320000-0000-0000-0000-000000000001', 'meal');
  if exists (select 1 from public.expense_items where claim_id = 'a4320000-0000-0000-0000-000000000001' and trip_type = 'per_diem') then raise exception 'FAIL [removed when not trip]'; end if;
end;
$$;
reset role;

-- 다른 회사 관리자의 설정은 이 회사에 영향 없음
select set_config('request.jwt.claims', '{"sub":"a4300000-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select public.set_company_per_diem(false, 0);
reset role;
do $$
begin
  if not (select per_diem_enabled from public.companies where id = 'c4300000-0000-0000-0000-00000000000a') then raise exception 'FAIL [isolation]'; end if;
end;
$$;

select 'PER_DIEM_OK' as result;
rollback;
