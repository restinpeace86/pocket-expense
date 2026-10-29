-- =============================================================================
-- 059_card_recurring_connect.sql — 카드 내역 증빙 대체(D-170) · 정기 결제 카드 매칭(D-171) · 사무소 홈택스 올리기(D-172) · 연결 코드(D-173)
-- =============================================================================
begin;

update private.app_settings set value = 'off' where key = 'business_verify_mode';

create function public._t_raises59(p_sql text, p_code text, p_label text)
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
grant execute on function public._t_raises59(text, text, text) to authenticated;
create function public._t_as59(p_uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
end;
$$;

insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at) values
  ('a5900000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'boss59@test.local', now()),
  ('a5900000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'emp59@test.local', now()),
  ('a5900000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tax-a59@test.local', now()),
  ('a5900000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tax-b59@test.local', now());
insert into public.companies (id, name, invite_code, business_number) values
  ('c5900000-0000-0000-0000-00000000000a', '대체A', 'SUBAAAAA', '1000000591');
insert into public.members (id, auth_user_id, company_id, name, phone, role, status, privacy_agreed_at) values
  ('a5910000-0000-0000-0000-000000000001', 'a5900000-0000-0000-0000-000000000001', 'c5900000-0000-0000-0000-00000000000a', 'A대표', '01095901001', 'super_admin', 'approved', now()),
  ('a5910000-0000-0000-0000-000000000002', 'a5900000-0000-0000-0000-000000000002', 'c5900000-0000-0000-0000-00000000000a', 'A직원', '01095901002', 'employee', 'approved', now());
insert into public.expense_claims (id, company_id, member_id, title, status) values
  ('c5920000-0000-0000-0000-000000000001', 'c5900000-0000-0000-0000-00000000000a', 'a5910000-0000-0000-0000-000000000002', '분실', 'approved');
insert into public.expense_items (id, claim_id, company_id, sort_order, category, payment_method, expense_date, amount, headcount, merchant_name, evidence_kind, no_evidence_reason) values
  ('c5930000-0000-0000-0000-000000000001', 'c5920000-0000-0000-0000-000000000001', 'c5900000-0000-0000-0000-00000000000a', 1, 'meal', 'corporate_card', '2026-09-10', 12000, 1, '김밥집', 'none', '영수증 분실'),
  ('c5930000-0000-0000-0000-000000000002', 'c5920000-0000-0000-0000-000000000001', 'c5900000-0000-0000-0000-00000000000a', 2, 'meal', 'personal_card', '2026-09-11', 9000, 1, '식당', 'none', '분실');

-- ── D-170 증빙 대체 ─────────────────────────────────────────────────────────
select public._t_as59('a5900000-0000-0000-0000-000000000002');
set local role authenticated;
select public._t_raises59($q$select public.substitute_card_evidence('c5930000-0000-0000-0000-000000000001', '2026-09-10', '김밥집', 12000, '1234')$q$, '42501', 'employee');
reset role;
select public._t_as59('a5900000-0000-0000-0000-000000000001');
set local role authenticated;
select public._t_raises59($q$select public.substitute_card_evidence('c5930000-0000-0000-0000-000000000001', '2026-09-10', '김밥집', 13000, '1234')$q$, 'CARD_ROW_MISMATCH', 'amount differs');
select public._t_raises59($q$select public.substitute_card_evidence('c5930000-0000-0000-0000-000000000002', '2026-09-11', '식당', 9000, null)$q$, 'CARD_ROW_MISMATCH', 'personal card');
select public.substitute_card_evidence('c5930000-0000-0000-0000-000000000001', '2026-09-10', '김밥집', 12000, '1234');
select public._t_raises59($q$select public.substitute_card_evidence('c5930000-0000-0000-0000-000000000001', '2026-09-10', '김밥집', 12000, '1234')$q$, 'NOT_NO_EVIDENCE', 'twice');
reset role;
do $$
declare i public.expense_items;
begin
  select * into i from public.expense_items where id = 'c5930000-0000-0000-0000-000000000001';
  if i.evidence_kind <> 'card_history' or i.evidence_substitute->>'last4' <> '1234' or i.evidence_substitute->>'by' <> 'A대표' then raise exception 'FAIL [substituted] %', i.evidence_substitute; end if;
  if not exists (select 1 from jsonb_array_elements(private.tax_month_export_for('c5900000-0000-0000-0000-00000000000a', '2026-09')->'rows') r
                  where r->>'item_id' = 'c5930000-0000-0000-0000-000000000001' and r->'evidence_substitute'->>'source' = 'card_statement') then raise exception 'FAIL [export has substitute]'; end if;
end;
$$;

-- ── D-171 정기 결제 ────────────────────────────────────────────────────────
insert into public.corporate_cards (id, company_id, nickname, last4) values ('c5940000-0000-0000-0000-000000000001', 'c5900000-0000-0000-0000-00000000000a', '대표카드', '1234');
insert into public.recurring_payments (id, company_id, service_name, amount, cycle, billing_day, payment_method, corporate_card_id, assignee_member_id, merchant_keyword, starts_on) values
  ('c5950000-0000-0000-0000-000000000001', 'c5900000-0000-0000-0000-00000000000a', '캐드 구독료', 55000, 'monthly', 10, 'corporate_card', 'c5940000-0000-0000-0000-000000000001', 'a5910000-0000-0000-0000-000000000002', 'AUTODESK', '2026-01-01'),
  ('c5950000-0000-0000-0000-000000000002', 'c5900000-0000-0000-0000-00000000000a', '개인 구독', 9900, 'monthly', 15, 'personal_card', null, 'a5910000-0000-0000-0000-000000000002', null, '2026-01-01');
select public._t_as59('a5900000-0000-0000-0000-000000000001');
set local role authenticated;
do $$
declare v uuid;
begin
  v := public.create_recurring_claim_from_card('c5950000-0000-0000-0000-000000000001', '2026-09-10', 'AUTODESK *ACAD', 57000, '1234');
  if (select status || '|' || member_id::text from public.expense_claims where id = v) <> 'draft|a5910000-0000-0000-0000-000000000002' then raise exception 'FAIL [draft for assignee]'; end if;
  if (select amount::text || '|' || evidence_kind::text || '|' || (evidence_substitute->>'recurring') from public.expense_items where claim_id = v) <> '57000|card_history|캐드 구독료' then raise exception 'FAIL [item from card row]'; end if;
end;
$$;
select public._t_raises59($q$select public.create_recurring_claim_from_card('c5950000-0000-0000-0000-000000000001', '2026-09-28', 'AUTODESK', 55000, '1234')$q$, 'RECURRING_ALREADY', 'same month twice');
reset role;
-- 096: 카드 내역으로 증빙이 붙은 항목은 영수증 파일 없이도 상신 검사 통과
do $$
declare v uuid := (select id from public.expense_claims where recurring_payment_id = 'c5950000-0000-0000-0000-000000000001' limit 1);
begin
  if private.claim_problems(v)::text like '%"receipt"%' then raise exception 'FAIL [substitute needs no receipt] %', private.claim_problems(v); end if;
end;
$$;
-- 097: 카드를 안 고른 정기 결제도 카드 내역 끝 4자리로 법인카드가 채워짐
update public.recurring_payments set corporate_card_id = null where id = 'c5950000-0000-0000-0000-000000000001';
select public._t_as59('a5900000-0000-0000-0000-000000000001');
set local role authenticated;
do $$
declare v uuid := public.create_recurring_claim_from_card('c5950000-0000-0000-0000-000000000001', '2027-01-10', 'AUTODESK', 55000, '1234');
begin
  if (select corporate_card_id from public.expense_items where claim_id = v) is distinct from 'c5940000-0000-0000-0000-000000000001' then raise exception 'FAIL [card from row]'; end if;
end;
$$;
reset role;
update public.recurring_payments set corporate_card_id = 'c5940000-0000-0000-0000-000000000001' where id = 'c5950000-0000-0000-0000-000000000001';
-- 예전 방식으로 만든 10월 결의서(결제일 날짜)가 있으면 10월도 막힘
insert into public.expense_claims (company_id, member_id, title, status, category, recurring_payment_id, recurring_period) values
  ('c5900000-0000-0000-0000-00000000000a', 'a5910000-0000-0000-0000-000000000002', '예전 10월', 'draft', 'saas', 'c5950000-0000-0000-0000-000000000001', '2026-10-10');
select public._t_as59('a5900000-0000-0000-0000-000000000001');
set local role authenticated;
select public._t_raises59($q$select public.create_recurring_claim_from_card('c5950000-0000-0000-0000-000000000001', '2026-10-10', 'AUTODESK', 55000, '1234')$q$, 'RECURRING_ALREADY', 'legacy period');
reset role;
do $$
begin
  if exists (select 1 from jsonb_array_elements(public.recurring_personal_due('2026-10-16')) e where e->>'recurring_id' = 'c5950000-0000-0000-0000-000000000002') then raise exception 'FAIL [not on other days]'; end if;
  if not exists (select 1 from jsonb_array_elements(public.recurring_personal_due('2026-10-15')) e where e->>'recurring_id' = 'c5950000-0000-0000-0000-000000000002') then raise exception 'FAIL [personal due on billing day]'; end if;
  if exists (select 1 from jsonb_array_elements(public.recurring_personal_due('2026-10-10')) e where e->>'recurring_id' = 'c5950000-0000-0000-0000-000000000001') then raise exception 'FAIL [corporate not reminded]'; end if;
end;
$$;

-- ── D-173 연결 코드 ────────────────────────────────────────────────────────
select public._t_as59('a5900000-0000-0000-0000-000000000001');
set local role authenticated;
select public.set_company_tax_office('바른세무', 'official@bareun.example', '윤세무', null, '01095909999');
do $$ begin perform set_config('t.code', public.my_company_tax_office_code(), true); end; $$;
reset role;
do $$
begin
  if current_setting('t.code') !~ '^[A-Z2-9]{10}$' then raise exception 'FAIL [code made] %', current_setting('t.code'); end if;
end;
$$;
set local role anon;
do $$
declare j jsonb := public.tax_office_connect_info(lower(current_setting('t.code')));
begin
  if j->>'company_name' <> '대체A' or j->>'office_name' <> '바른세무' or (j->>'connected')::boolean then raise exception 'FAIL [info for anon] %', j; end if;
end;
$$;
reset role;
-- 사무소 등록(다른 이메일 계정)으로 코드 연결
select public._t_as59('a5900000-0000-0000-0000-000000000003');
set local role authenticated;
select public.register_tax_office('바른세무회계', '2000000591', '정세무', null, true, true);
do $$
begin
  if public.connect_tax_office_by_code(current_setting('t.code')) <> 'c5900000-0000-0000-0000-00000000000a' then raise exception 'FAIL [connected]'; end if;
  if not exists (select 1 from private.tax_office_company_ids() c where c = 'c5900000-0000-0000-0000-00000000000a') then raise exception 'FAIL [visible after connect]'; end if;
  if public.connect_tax_office_by_code(current_setting('t.code')) <> 'c5900000-0000-0000-0000-00000000000a' then raise exception 'FAIL [idempotent]'; end if;
end;
$$;
select public._t_raises59($q$select public.connect_tax_office_by_code('ZZZZZZZZZZ')$q$, 'INVALID_CONNECT_CODE', 'bad code');
reset role;
-- 다른 사무소는 같은 코드로 연결 못 함
select public._t_as59('a5900000-0000-0000-0000-000000000004');
set local role authenticated;
select public.register_tax_office('다른세무', '2000000592', '김세무', null, true, true);
select public._t_raises59($q$select public.connect_tax_office_by_code(current_setting('t.code'))$q$, 'ALREADY_CONNECTED', 'other office');
reset role;

-- ── D-172 사무소 홈택스 올리기·지우기 ─────────────────────────────────────
select public._t_as59('a5900000-0000-0000-0000-000000000003');
set local role authenticated;
select public._t_raises59($q$select public.add_hometax_upload_office('c5900000-0000-0000-0000-00000000000a', '2026-09', 'tax_invoice', 'zzz/x.xlsx', 'x.xlsx', 10, '[]', '[]', 0, null)$q$, 'INVALID_HOMETAX', 'office other folder');
do $$
begin
  perform public.add_hometax_upload_office('c5900000-0000-0000-0000-00000000000a', '2026-09', 'tax_invoice', 'c5900000-0000-0000-0000-00000000000a/o.xlsx', '사무소.xlsx', 10, '[]', '[]', 2, null);
  if (select uploaded_by_kind || '|' || uploaded_by_name from public.hometax_uploads where file_name = '사무소.xlsx') <> 'tax_office|정세무 (바른세무회계)' then raise exception 'FAIL [office upload marked]'; end if;
end;
$$;
reset role;
select public._t_as59('a5900000-0000-0000-0000-000000000004');
set local role authenticated;
select public._t_raises59($q$select public.add_hometax_upload_office('c5900000-0000-0000-0000-00000000000a', '2026-09', 'tax_invoice', 'c5900000-0000-0000-0000-00000000000a/z.xlsx', 'z.xlsx', 10, '[]', '[]', 0, null)$q$, 'NOT_FOUND', 'unlinked office');
reset role;
-- 회사는 사무소가 올린 것을 못 지움 / 사무소는 지움
select public._t_as59('a5900000-0000-0000-0000-000000000001');
set local role authenticated;
do $$ begin perform set_config('t.up', (select id::text from public.hometax_uploads where file_name = '사무소.xlsx'), true); end; $$;
select public._t_raises59($q$select public.delete_hometax_upload(current_setting('t.up')::uuid)$q$, 'NOT_FOUND', 'company deletes office upload');
reset role;
select public._t_as59('a5900000-0000-0000-0000-000000000003');
set local role authenticated;
do $$ begin if public.delete_hometax_upload_office(current_setting('t.up')::uuid) <> 'c5900000-0000-0000-0000-00000000000a/o.xlsx' then raise exception 'FAIL [office delete]'; end if; end; $$;
reset role;

-- 사무소를 바꾸면 코드가 바뀜
select public._t_as59('a5900000-0000-0000-0000-000000000001');
set local role authenticated;
select public.set_company_tax_office('새세무', 'new@office.example', null, null, null);
do $$ begin if public.my_company_tax_office_code() = current_setting('t.code') then raise exception 'FAIL [code rotated]'; end if; end; $$;
reset role;

select 'card_recurring_connect ok';
rollback;
