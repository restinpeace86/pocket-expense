-- =============================================================================
-- 032_evidence_default.sql — 증빙 구분 AI 판별 + 기본값 카드매출전표 (todo_improvement(2차) 7, D-100, migration 049)
-- =============================================================================
begin;

insert into auth.users (id, instance_id, aud, role, email)
select u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u::text || '@test.local'
from unnest(array['a3200000-0000-0000-0000-000000000001']::uuid[]) u;
insert into public.companies (id, name, invite_code, business_number) values ('c3200000-0000-0000-0000-00000000000a', '증빙회사', 'EVDNAAAA', '1000000321');
insert into public.members (id, auth_user_id, company_id, name, phone, role, status, privacy_agreed_at) values
  ('a3210000-0000-0000-0000-000000000001', 'a3200000-0000-0000-0000-000000000001', 'c3200000-0000-0000-0000-00000000000a', '증빙직원', '01093201001', 'employee', 'approved', now());
insert into public.expense_claims (id, company_id, member_id, title) values
  ('a3220000-0000-0000-0000-000000000001', 'c3200000-0000-0000-0000-00000000000a', 'a3210000-0000-0000-0000-000000000001', '증빙 테스트');

select set_config('request.jwt.claims', '{"sub":"a3200000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
do $$
declare c uuid := 'a3220000-0000-0000-0000-000000000001'; i1 uuid; i2 uuid; i3 uuid; i4 uuid;
begin
  i1 := (public.create_receipt_item(c)->>'item_id')::uuid;
  i2 := (public.create_receipt_item(c)->>'item_id')::uuid;
  i3 := (public.create_receipt_item(c)->>'item_id')::uuid;
  i4 := (public.create_receipt_item(c)->>'item_id')::uuid;
  -- AI가 증빙을 못 가림 → 카드매출전표
  perform public.apply_receipt_parse(i1, true, '{"merchant_name":"가게","amount":5000,"expense_date":"2026-10-15"}'::jsonb);
  if (select evidence_type from public.expense_items where id = i1) <> 'card_slip' then raise exception 'FAIL [default] %', (select evidence_type from public.expense_items where id = i1); end if;
  -- AI 판별값 그대로
  perform public.apply_receipt_parse(i2, true, '{"merchant_name":"가게","amount":5000,"expense_date":"2026-10-15","suggested_evidence_type":"cash_receipt"}'::jsonb);
  if (select evidence_type from public.expense_items where id = i2) <> 'cash_receipt' then raise exception 'FAIL [ai cash]'; end if;
  -- 읽기 실패 → 카드매출전표
  perform public.apply_receipt_parse(i3, false, null);
  if (select row(parse_status, evidence_type)::text from public.expense_items where id = i3) <> row('failed'::public.parse_status, 'card_slip'::public.evidence_type)::text then raise exception 'FAIL [failed default]'; end if;
  -- 직원이 고른 값은 다시 읽어도 그대로
  update public.expense_items set evidence_type = 'tax_invoice' where id = i4;
  perform public.apply_receipt_parse(i4, true, '{"merchant_name":"가게","amount":5000,"expense_date":"2026-10-15","suggested_evidence_type":"simple_receipt"}'::jsonb);
  if (select evidence_type from public.expense_items where id = i4) <> 'tax_invoice' then raise exception 'FAIL [keep manual]'; end if;
  update public.expense_items set evidence_type = 'simple_receipt' where id = i3;
  perform public.apply_receipt_parse(i3, false, null);
  if (select evidence_type from public.expense_items where id = i3) <> 'simple_receipt' then raise exception 'FAIL [keep manual on fail]'; end if;
end;
$$;
reset role;

select 'EVIDENCE_DEFAULT_OK' as result;
rollback;
