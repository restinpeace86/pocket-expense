-- =============================================================================
-- 021_card_bin6.sql — 법인카드 앞 6자리+뒤 4자리, 영수증 카드번호 보이는 숫자 비교 (D-083, migration 038)
-- 회사 A(대표 a_sup, 직원 a_e1): 카드 X(532712·4321), Y(943011·4321), Z(앞 6자리 없음·7890)
-- 회사 B(대표 b_sup): 카드 W(532712·5555) — A 영수증 비교에 섞이면 안 된다(회사 격리)
-- =============================================================================
begin;

insert into auth.users (id, instance_id, aud, role, email)
select u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u::text || '@test.local'
from unnest(array['a2100000-0000-0000-0000-000000000001', 'a2100000-0000-0000-0000-000000000002', 'b2100000-0000-0000-0000-000000000001']::uuid[]) u;
insert into public.companies (id, name, invite_code, business_number) values
  ('c2100000-0000-0000-0000-00000000000a', '카드회사A', 'CARDBNAA', '1000000211'),
  ('c2100000-0000-0000-0000-00000000000b', '카드회사B', 'CARDBNBB', '1000000212');
insert into public.members (id, auth_user_id, company_id, name, phone, role, status, privacy_agreed_at) values
  ('a2200000-0000-0000-0000-000000000001', 'a2100000-0000-0000-0000-000000000001', 'c2100000-0000-0000-0000-00000000000a', 'A대표', '01092101000', 'super_admin', 'approved', now()),
  ('a2200000-0000-0000-0000-000000000002', 'a2100000-0000-0000-0000-000000000002', 'c2100000-0000-0000-0000-00000000000a', 'A직원', '01092101001', 'employee', 'approved', now()),
  ('b2200000-0000-0000-0000-000000000001', 'b2100000-0000-0000-0000-000000000001', 'c2100000-0000-0000-0000-00000000000b', 'B대표', '01092102000', 'super_admin', 'approved', now());
insert into public.corporate_cards (id, company_id, nickname, bin6, last4) values
  ('b2300000-0000-0000-0000-000000000001', 'c2100000-0000-0000-0000-00000000000b', 'B 카드', '532712', '5555');
insert into public.expense_claims (id, company_id, member_id, title) values
  ('a2400000-0000-0000-0000-000000000001', 'c2100000-0000-0000-0000-00000000000a', 'a2200000-0000-0000-0000-000000000002', 'A직원 소명서');

-- ── 마스킹 규칙 (src/lib/cards/match.ts 와 같아야 함) ─────────────────────────────
do $$
begin
  if private.mask_card_number('5327-12**-****-4321') <> '532712******4321'
     or private.mask_card_number('5327 12XX XXXX 432*') <> '532712******432*'
     or private.mask_card_number('5327123456784321') <> '532712******4321'
     or private.mask_card_number('12347890') <> '****7890'
     or private.mask_card_number('****-****-****-****') is not null
     or private.mask_card_number('12') is not null then
    raise exception 'FAIL [mask] rule mismatch';
  end if;
  if private.card_number_matches('532712******432*', '532712', '4321') is not true
     or private.card_number_matches('943011******4321', '532712', '4321') is not false
     or private.card_number_matches('111111******7890', null, '7890') is not true
     or private.card_number_matches('************', '532712', '4321') is not null then
    raise exception 'FAIL [match] rule mismatch';
  end if;
end;
$$;

-- ── A 대표: 카드 등록. 앞 6자리 형식·(앞 6자리, 뒤 4자리) 중복 검사 ───────────────
select set_config('request.jwt.claims', '{"sub":"a2100000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
insert into public.corporate_cards (id, company_id, nickname, bin6, last4) values
  ('a2300000-0000-0000-0000-000000000002', 'c2100000-0000-0000-0000-00000000000a', 'X 카드', '532712', '4321'),
  ('a2300000-0000-0000-0000-000000000003', 'c2100000-0000-0000-0000-00000000000a', 'Y 카드', '943011', '4321'), -- 뒤 4자리만 같은 다른 카드는 등록 가능
  ('a2300000-0000-0000-0000-000000000004', 'c2100000-0000-0000-0000-00000000000a', 'Z 예전 카드', null, '7890');
do $$
begin
  begin
    insert into public.corporate_cards (company_id, nickname, bin6, last4) values ('c2100000-0000-0000-0000-00000000000a', '중복', '532712', '4321');
    raise exception 'FAIL [A_SUP] duplicate bin6+last4 accepted';
  exception when unique_violation then null;
  end;
  begin
    insert into public.corporate_cards (company_id, nickname, last4) values ('c2100000-0000-0000-0000-00000000000a', '중복 예전', '7890');
    raise exception 'FAIL [A_SUP] duplicate legacy last4 accepted';
  exception when unique_violation then null;
  end;
  begin
    insert into public.corporate_cards (company_id, nickname, bin6, last4) values ('c2100000-0000-0000-0000-00000000000a', '형식', '12345', '1111');
    raise exception 'FAIL [A_SUP] bad bin6 accepted';
  exception when check_violation then null;
  end;
end;
$$;
-- 회사 B 카드는 보이지도 고쳐지지도 않는다
do $$
declare n int;
begin
  if exists (select 1 from public.corporate_cards where company_id = 'c2100000-0000-0000-0000-00000000000b') then raise exception 'FAIL [A_SUP] sees B card'; end if;
  update public.corporate_cards set bin6 = '111111' where id = 'b2300000-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL [A_SUP] updated B card'; end if;
end;
$$;
reset role;

-- ── A 직원: 영수증 인식 → 결제수단 자동 선택 ───────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"a2100000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
do $$
declare
  v_item uuid;
  got text;
  cases jsonb := '[
    {"label":"front distinguishes Y", "payload":{"card_number_masked":"9430-11**-****-4321"}, "pm":"corporate_card", "card":"a2300000-0000-0000-0000-000000000003", "last4":"4321"},
    {"label":"masked last digit X",   "payload":{"card_number_masked":"5327-12**-****-432*"}, "pm":"corporate_card", "card":"a2300000-0000-0000-0000-000000000002", "last4":"4321"},
    {"label":"back only ambiguous",   "payload":{"card_number_masked":"****4321"},            "pm":"corporate_card", "card":null, "last4":"4321"},
    {"label":"other company card",    "payload":{"card_number_masked":"****5555"},            "pm":"personal_card",  "card":null, "last4":"5555"},
    {"label":"no visible digits",     "payload":{"card_number_masked":"****-****-****-****"}, "pm":"corporate_card", "card":null, "last4":null},
    {"label":"legacy card_last4 Z",   "payload":{"card_last4":"7890"},                        "pm":"corporate_card", "card":"a2300000-0000-0000-0000-000000000004", "last4":"7890"},
    {"label":"full number masked",    "payload":{"card_number_masked":"5327123456784321"},    "pm":"corporate_card", "card":"a2300000-0000-0000-0000-000000000002", "last4":"4321"}
  ]';
  c jsonb;
begin
  for c in select * from jsonb_array_elements(cases) loop
    v_item := (public.create_receipt_item('a2400000-0000-0000-0000-000000000001')->>'item_id')::uuid;
    perform public.apply_receipt_parse(v_item, true, (c->'payload') || '{"amount":10000,"expense_date":"2026-10-15"}'::jsonb);
    select row(payment_method::text, corporate_card_id::text, card_last4)::text into got from public.expense_items where id = v_item;
    if got <> row(c->>'pm', c->>'card', c->>'last4')::text then
      raise exception 'FAIL [A_E1 %] got %', c->>'label', got;
    end if;
    if c->>'label' = 'full number masked'
       and (select ai_parsed_payload->>'card_number_masked' from public.expense_items where id = v_item) is distinct from '532712******4321' then
      raise exception 'FAIL [A_E1] full card number stored: %', (select ai_parsed_payload from public.expense_items where id = v_item);
    end if;
  end loop;
  -- 다시 읽어도(이미 인식된 항목) 직원이 고른 결제수단은 바꾸지 않는다
  update public.expense_items set payment_method = 'personal_card', corporate_card_id = null where id = v_item;
  perform public.apply_receipt_parse(v_item, true, '{"card_number_masked":"5327-12**-****-4321"}'::jsonb);
  if (select payment_method from public.expense_items where id = v_item) <> 'personal_card' then raise exception 'FAIL [A_E1] reparse overrode choice'; end if;
end;
$$;
-- 직원은 카드를 고칠 수 없다
do $$
declare n int;
begin
  update public.corporate_cards set bin6 = '000000' where id = 'a2300000-0000-0000-0000-000000000004';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL [A_E1] employee updated card'; end if;
end;
$$;
reset role;

select 'ok' as card_bin6;
rollback;
