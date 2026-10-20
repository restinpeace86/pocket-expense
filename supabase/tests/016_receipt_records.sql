-- =============================================================================
-- 016_receipt_records.sql — 크레딧 사용 영수증 기록·운영자 테이블 격리 테스트 (D-080, migration 030)
-- 회사 A(대표 a_sup, 직원 a_e1). 영수증 2장 → 하나는 항목 삭제, 하나는 소명서째 삭제해도 기록이 남는다.
-- =============================================================================
begin;

insert into auth.users (id, instance_id, aud, role, email)
select u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u::text || '@test.local'
from unnest(array['a3100000-0000-0000-0000-000000000001', 'a3100000-0000-0000-0000-000000000002']::uuid[]) u;
insert into public.companies (id, name, invite_code, business_number) values ('c3100000-0000-0000-0000-00000000000a', '기록회사A', 'RCDAAAAA', '1000000311');
insert into public.members (id, auth_user_id, company_id, name, phone, role, status, privacy_agreed_at) values
  ('a3200000-0000-0000-0000-000000000001', 'a3100000-0000-0000-0000-000000000001', 'c3100000-0000-0000-0000-00000000000a', 'A대표', '01096301000', 'super_admin', 'approved', now()),
  ('a3200000-0000-0000-0000-000000000002', 'a3100000-0000-0000-0000-000000000002', 'c3100000-0000-0000-0000-00000000000a', 'A직원1', '01096301001', 'employee', 'approved', now());
insert into public.expense_claims (id, company_id, member_id, title) values
  ('a3300000-0000-0000-0000-000000000001', 'c3100000-0000-0000-0000-00000000000a', 'a3200000-0000-0000-0000-000000000002', '지울 항목 있는 소명서'),
  ('a3300000-0000-0000-0000-000000000002', 'c3100000-0000-0000-0000-00000000000a', 'a3200000-0000-0000-0000-000000000002', '통째로 지울 소명서');
-- 운영자 등록(테스트용): 이 계정이라도 고객 역할로는 운영 테이블을 못 읽어야 한다
insert into public.app_admins (auth_user_id) values ('a3100000-0000-0000-0000-000000000001');

-- 직원이 영수증 2장 올림 → 크레딧 차감(서버가 service role로 부르는 것과 같음) → AI 인식
select set_config('request.jwt.claims', '{"sub":"a3100000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
do $$
declare r1 jsonb; r2 jsonb;
begin
  r1 := public.create_receipt_item('a3300000-0000-0000-0000-000000000001');
  r2 := public.create_receipt_item('a3300000-0000-0000-0000-000000000002');
  perform set_config('t.i1', r1->>'item_id', true);
  perform set_config('t.i2', r2->>'item_id', true);
end $$;
reset role;
select public.consume_receipt_credit(current_setting('t.i1')::uuid, 'a3200000-0000-0000-0000-000000000002', true, 100);
select public.consume_receipt_credit(current_setting('t.i2')::uuid, 'a3200000-0000-0000-0000-000000000002', true, 100);
select public.consume_receipt_credit(current_setting('t.i1')::uuid, 'a3200000-0000-0000-0000-000000000002', true, 100); -- 다시 불러도 기록은 1건
set local role authenticated;
do $$
begin
  perform public.apply_receipt_parse(current_setting('t.i1')::uuid, true, '{"merchant_name":"이마트 판교점","amount":12000,"line_items":[{"name":"생수","amount":12000}]}'::jsonb);
end $$;
reset role;

do $$
begin
  if (select count(*) from public.receipt_usage_records where company_id = 'c3100000-0000-0000-0000-00000000000a') <> 2 then raise exception 'FAIL record count'; end if;
  if (select row(member_name, claim_title, parse_status, ai_parsed_payload->>'merchant_name')::text from public.receipt_usage_records where item_id = current_setting('t.i1')::uuid)
     <> row('A직원1', '지울 항목 있는 소명서', 'success', '이마트 판교점')::text then
    raise exception 'FAIL record snapshot at parse';
  end if;
end $$;

-- 고객 역할(직원·대표·운영자 계정이라도)로는 운영 테이블·보관 버킷을 볼 수도 쓸 수도 없다
select set_config('request.jwt.claims', '{"sub":"a3100000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  begin
    perform count(*) from public.receipt_usage_records;
    raise exception 'FAIL [A_E1] can read receipt_usage_records';
  exception when insufficient_privilege then null;
  end;
  begin
    perform count(*) from public.app_admins;
    raise exception 'FAIL [A_E1] can read app_admins';
  exception when insufficient_privilege then null;
  end;
  if (select count(*) from storage.objects where bucket_id = 'receipt-archive') <> 0 then raise exception 'FAIL [A_E1] sees archive bucket'; end if;
  begin
    insert into storage.objects (bucket_id, name) values ('receipt-archive', 'c3100000-0000-0000-0000-00000000000a/x.jpg');
    raise exception 'FAIL [A_E1] can write archive bucket';
  exception when insufficient_privilege or check_violation then null;
    when others then if sqlerrm like 'FAIL%' then raise; end if;
  end;

  -- 직원이 항목 하나를 지우고, 다른 소명서는 통째로 지운다
  delete from public.expense_items where id = current_setting('t.i1')::uuid;
  delete from public.expense_claims where id = 'a3300000-0000-0000-0000-000000000002';
end $$;
reset role;
select set_config('request.jwt.claims', '{"sub":"a3100000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  begin
    perform count(*) from public.receipt_usage_records;
    raise exception 'FAIL [A_SUP app admin as customer] can read receipt_usage_records';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- 지워도 기록은 남고, 지울 때의 내용이 들어 있다
do $$
begin
  if (select count(*) from public.receipt_usage_records where company_id = 'c3100000-0000-0000-0000-00000000000a' and item_deleted_at is not null) <> 2 then
    raise exception 'FAIL deleted records not kept';
  end if;
  if (select row(item_snapshot->>'merchant_name', item_snapshot->>'amount', claim_title)::text from public.receipt_usage_records where item_id = current_setting('t.i1')::uuid)
     <> row('이마트 판교점', '12000', '지울 항목 있는 소명서')::text then
    raise exception 'FAIL item delete snapshot';
  end if;
  if (select claim_title from public.receipt_usage_records where item_id = current_setting('t.i2')::uuid) <> '통째로 지울 소명서' then
    raise exception 'FAIL claim delete snapshot';
  end if;
  if (select count(*) from public.credit_ledger where company_id = 'c3100000-0000-0000-0000-00000000000a' and reason = 'receipt_upload') <> 2 then
    raise exception 'FAIL ledger';
  end if;
end $$;

-- 운영자 집계 함수는 고객 역할로 실행할 수 없다
select set_config('request.jwt.claims', '{"sub":"a3100000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  begin
    perform * from public.app_admin_company_overview('2026-10');
    raise exception 'FAIL [A_SUP] can run app_admin_company_overview';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
do $$
begin
  if (select receipts_total from public.app_admin_company_overview(to_char(now() at time zone 'Asia/Seoul', 'YYYY-MM')) where company_id = 'c3100000-0000-0000-0000-00000000000a') <> 2
     or (select receipts_deleted from public.app_admin_company_overview('2026-10') where company_id = 'c3100000-0000-0000-0000-00000000000a') <> 2 then
    raise exception 'FAIL overview counts';
  end if;
end $$;

-- 회사를 지우면 기록도 함께 지워지고, 삭제가 막히지 않는다(037). 크레딧을 쓴 항목이 남아 있는 상태에서 확인
insert into public.expense_claims (id, company_id, member_id, title) values ('a3300000-0000-0000-0000-000000000009', 'c3100000-0000-0000-0000-00000000000a', 'a3200000-0000-0000-0000-000000000002', '남은 소명서');
insert into public.expense_items (id, claim_id, company_id, sort_order, payment_method, credit_charged) values ('a3400000-0000-0000-0000-000000000009', 'a3300000-0000-0000-0000-000000000009', 'c3100000-0000-0000-0000-00000000000a', 1, 'personal_card', true);
insert into public.receipt_usage_records (company_id, item_id, claim_id, credited_at) values ('c3100000-0000-0000-0000-00000000000a', 'a3400000-0000-0000-0000-000000000009', 'a3300000-0000-0000-0000-000000000009', now());
delete from public.companies where id = 'c3100000-0000-0000-0000-00000000000a';
do $$
begin
  if exists (select 1 from public.receipt_usage_records where company_id = 'c3100000-0000-0000-0000-00000000000a') then raise exception 'FAIL records not removed with company'; end if;
end $$;

select 'RECEIPT_RECORDS_OK' as result;
rollback;
