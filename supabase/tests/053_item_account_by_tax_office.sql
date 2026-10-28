-- =============================================================================
-- 053_item_account_by_tax_office.sql — 영수증별 계정과목: 사무소 연결 시 회사는 확인 요청만, 조정은 사무소 (D-156, migration 084)
-- =============================================================================
begin;

update private.app_settings set value = 'off' where key = 'business_verify_mode'; -- 가짜 번호로 사무소 등록(검증은 003, D-155)

create function public._t_raises53(p_sql text, p_code text, p_label text)
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
grant execute on function public._t_raises53(text, text, text) to authenticated;
create function public._t_as53(p_uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
end;
$$;

insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at) values
  ('a5300000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sup53@test.local', now()),
  ('a5300000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'emp53@test.local', now()),
  ('a5300000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'office53@test.local', now()),
  ('a5300000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'other53@test.local', now());
insert into public.companies (id, name, invite_code, business_number) values ('c5300000-0000-0000-0000-00000000000a', '항목A', 'KTMAAAAA', '1000000531');
insert into public.members (id, auth_user_id, company_id, name, phone, role, status, privacy_agreed_at) values
  ('a5310000-0000-0000-0000-000000000001', 'a5300000-0000-0000-0000-000000000001', 'c5300000-0000-0000-0000-00000000000a', '가대표', '01095301001', 'super_admin', 'approved', now()),
  ('a5310000-0000-0000-0000-000000000002', 'a5300000-0000-0000-0000-000000000002', 'c5300000-0000-0000-0000-00000000000a', '나직원', '01095301002', 'employee', 'approved', now());
insert into public.account_titles (id, company_id, name, code) values
  ('a5320000-0000-0000-0000-00000000000a', 'c5300000-0000-0000-0000-00000000000a', '복리후생비', '811'),
  ('a5320000-0000-0000-0000-00000000000b', 'c5300000-0000-0000-0000-00000000000a', '기업업무추진비', '813');
insert into public.account_title_mappings (company_id, category, account_title_id) values ('c5300000-0000-0000-0000-00000000000a', 'meal', 'a5320000-0000-0000-0000-00000000000a');
insert into public.expense_claims (id, company_id, member_id, title, status) values
  ('a5330000-0000-0000-0000-000000000001', 'c5300000-0000-0000-0000-00000000000a', 'a5310000-0000-0000-0000-000000000002', '9월 식대', 'approved'),
  ('a5330000-0000-0000-0000-000000000002', 'c5300000-0000-0000-0000-00000000000a', 'a5310000-0000-0000-0000-000000000002', '작성 중', 'draft');
insert into public.expense_items (id, claim_id, company_id, sort_order, category, payment_method, expense_date, amount, headcount, merchant_name, account_title_id, account_title_name, account_title_code) values
  ('a5340000-0000-0000-0000-000000000001', 'a5330000-0000-0000-0000-000000000001', 'c5300000-0000-0000-0000-00000000000a', 1, 'meal', 'personal_card', '2026-09-10', 80000, 3, '한정식', 'a5320000-0000-0000-0000-00000000000a', '복리후생비', '811'),
  ('a5340000-0000-0000-0000-000000000002', 'a5330000-0000-0000-0000-000000000002', 'c5300000-0000-0000-0000-00000000000a', 1, 'meal', 'personal_card', '2026-09-11', 9000, 1, '분식', 'a5320000-0000-0000-0000-00000000000a', '복리후생비', '811');

-- 사무소 연결 전: 회사 관리자가 영수증별로 바꿀 수 있음(기존 그대로)
select public._t_as53('a5300000-0000-0000-0000-000000000001');
set local role authenticated;
select public.override_item_account_title('a5340000-0000-0000-0000-000000000001', 'a5320000-0000-0000-0000-00000000000b');
select public.override_item_account_title('a5340000-0000-0000-0000-000000000001', null);
select public.set_company_tax_office('X세무', 'office53@test.local', null, null, null);
reset role;
select public._t_as53('a5300000-0000-0000-0000-000000000004');
set local role authenticated;
select public.register_tax_office('X세무사무소', '2000000531', 'X대표', null, true, true);
reset role;

-- 연결 뒤: 회사는 조정 불가, 확인 요청만(작성 중 결의서는 불가), 직원은 불가
select public._t_as53('a5300000-0000-0000-0000-000000000001');
set local role authenticated;
select public._t_raises53($q$select public.override_item_account_title('a5340000-0000-0000-0000-000000000001', 'a5320000-0000-0000-0000-00000000000b')$q$, 'TAX_OFFICE_MANAGES_ACCOUNTS', 'company blocked');
select public.request_item_tax_review('a5340000-0000-0000-0000-000000000001', ' 거래처 2명 동석, 접대비 아닌지 확인 부탁 ');
select public._t_raises53($q$select public.request_item_tax_review('a5340000-0000-0000-0000-000000000002', '작성 중')$q$, 'NOT_FOUND', 'draft item');
reset role;
select public._t_as53('a5300000-0000-0000-0000-000000000002');
set local role authenticated;
select public._t_raises53($q$select public.request_item_tax_review('a5340000-0000-0000-0000-000000000001', 'x')$q$, '42501', 'employee request');
reset role;
do $$
begin
  if (select tax_review_request from public.expense_items where id = 'a5340000-0000-0000-0000-000000000001') <> '거래처 2명 동석, 접대비 아닌지 확인 부탁' then raise exception 'FAIL [request saved]'; end if;
  if (select tax_review_requested_by from public.expense_items where id = 'a5340000-0000-0000-0000-000000000001') <> '가대표' then raise exception 'FAIL [requested by]'; end if;
end;
$$;

-- 사무소: 세무 자료에 요청이 보이고, 영수증 계정과목을 바꾸면 처리됨 + 이력
select public._t_as53('a5300000-0000-0000-0000-000000000004');
set local role authenticated;
do $$
declare r jsonb; j jsonb;
begin
  r := public.tax_office_month_export('c5300000-0000-0000-0000-00000000000a', '2026-09')->'rows'->0;
  if r->>'tax_review_request' <> '거래처 2명 동석, 접대비 아닌지 확인 부탁' then raise exception 'FAIL [request in export] %', r; end if;
  j := public.tax_office_override_item_account_title('a5340000-0000-0000-0000-000000000001', 'a5320000-0000-0000-0000-00000000000b');
  if j->>'name' <> '기업업무추진비' or not (j->>'overridden')::boolean then raise exception 'FAIL [office override] %', j; end if;
  r := public.tax_office_month_export('c5300000-0000-0000-0000-00000000000a', '2026-09')->'rows'->0;
  if r->>'tax_review_resolved_at' is null or not (r->>'account_title_overridden')::boolean then raise exception 'FAIL [resolved] %', r; end if;
end;
$$;
select public._t_raises53($q$select public.tax_office_override_item_account_title('a5340000-0000-0000-0000-000000000002', null)$q$, 'NOT_FOUND', 'office draft item');
reset role;
-- 다른 사람(사무소 아님)은 불가
select public._t_as53('a5300000-0000-0000-0000-000000000005');
set local role authenticated;
select public._t_raises53($q$select public.tax_office_override_item_account_title('a5340000-0000-0000-0000-000000000001', null)$q$, 'NOT_FOUND', 'stranger');
reset role;
-- 회사 이력에 남음
select public._t_as53('a5300000-0000-0000-0000-000000000001');
set local role authenticated;
do $$
begin
  if (select count(*) from public.account_title_changes where entity = 'item') <> 1 then raise exception 'FAIL [item history]'; end if;
  if (select detail->>'new_title' from public.account_title_changes where entity = 'item') <> '기업업무추진비' then raise exception 'FAIL [history detail]'; end if;
end;
$$;
reset role;
-- 마감된 항목은 사무소도 불가
update public.expense_items set closed_month = '2026-09', closing_seq = 1, closing_kind = 'current' where id = 'a5340000-0000-0000-0000-000000000001';
select public._t_as53('a5300000-0000-0000-0000-000000000004');
set local role authenticated;
select public._t_raises53($q$select public.tax_office_override_item_account_title('a5340000-0000-0000-0000-000000000001', null)$q$, 'ITEM_CLOSED', 'closed');
reset role;

select 'item_account_by_tax_office ok';
rollback;
