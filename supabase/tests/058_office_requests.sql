-- =============================================================================
-- 058_office_requests.sql — 세무사 → 회사 자료 요청, 마감 알림 받는 사람 (D-168·D-169, migration 092)
-- =============================================================================
begin;

update private.app_settings set value = 'off' where key = 'business_verify_mode';

create function public._t_raises58(p_sql text, p_code text, p_label text)
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
grant execute on function public._t_raises58(text, text, text) to authenticated;
create function public._t_as58(p_uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
end;
$$;

insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at) values
  ('a5800000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'boss58@test.local', now()),
  ('a5800000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'emp58@test.local', now()),
  ('a5800000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bboss58@test.local', now()),
  ('a5800000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'office58@test.local', now()),
  ('a5800000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'other58@test.local', now());
insert into public.companies (id, name, invite_code, business_number) values
  ('c5800000-0000-0000-0000-00000000000a', '요청A', 'REQAAAAA', '1000000581'),
  ('c5800000-0000-0000-0000-00000000000b', '요청B', 'REQBBBBB', '1000000582');
insert into public.members (id, auth_user_id, company_id, name, phone, role, status, privacy_agreed_at) values
  ('a5810000-0000-0000-0000-000000000001', 'a5800000-0000-0000-0000-000000000001', 'c5800000-0000-0000-0000-00000000000a', 'A대표', '01095801001', 'super_admin', 'approved', now()),
  ('a5810000-0000-0000-0000-000000000002', 'a5800000-0000-0000-0000-000000000002', 'c5800000-0000-0000-0000-00000000000a', 'A직원', '01095801002', 'employee', 'approved', now()),
  ('a5810000-0000-0000-0000-000000000003', 'a5800000-0000-0000-0000-000000000003', 'c5800000-0000-0000-0000-00000000000b', 'B대표', '01095801003', 'super_admin', 'approved', now());
insert into public.expense_claims (id, company_id, member_id, title, status) values
  ('c5820000-0000-0000-0000-000000000001', 'c5800000-0000-0000-0000-00000000000a', 'a5810000-0000-0000-0000-000000000002', '9월', 'approved'),
  ('c5820000-0000-0000-0000-000000000002', 'c5800000-0000-0000-0000-00000000000b', 'a5810000-0000-0000-0000-000000000003', 'B9월', 'approved');
insert into public.expense_items (id, claim_id, company_id, sort_order, category, payment_method, expense_date, amount, headcount, merchant_name) values
  ('c5830000-0000-0000-0000-000000000001', 'c5820000-0000-0000-0000-000000000001', 'c5800000-0000-0000-0000-00000000000a', 1, 'meal', 'personal_card', '2026-09-10', 12000, 1, '김밥집'),
  ('c5830000-0000-0000-0000-000000000002', 'c5820000-0000-0000-0000-000000000002', 'c5800000-0000-0000-0000-00000000000b', 1, 'meal', 'personal_card', '2026-09-10', 9000, 1, 'B식당');

-- A만 사무소 연결
select public._t_as58('a5800000-0000-0000-0000-000000000004');
set local role authenticated;
select public.register_tax_office('요청세무', '2000000581', '요대표', '01095809999', true, true);
reset role;
select public._t_as58('a5800000-0000-0000-0000-000000000001');
set local role authenticated;
select public.set_company_tax_office('요청세무', 'office58@test.local', null, null, null);
reset role;

-- 마감 알림 받는 사람: 담당 없으면 사무소 관리자
do $$
declare j jsonb := public.tax_office_notice_targets('c5800000-0000-0000-0000-00000000000a');
begin
  if jsonb_array_length(j) <> 1 or j->0->>'name' <> '요대표' or j->0->>'phone' <> '01095809999' then raise exception 'FAIL [notice target] %', j; end if;
  if jsonb_array_length(public.tax_office_notice_targets('c5800000-0000-0000-0000-00000000000b')) <> 0 then raise exception 'FAIL [unlinked none]'; end if;
end;
$$;

-- 세무사: 요청 남기기(달·영수증), 다른 회사·다른 회사 영수증은 막힘
select public._t_as58('a5800000-0000-0000-0000-000000000004');
set local role authenticated;
select public._t_raises58($q$select public.create_tax_office_request('c5800000-0000-0000-0000-00000000000b', '2026-09', null, '요청')$q$, 'NOT_FOUND', 'unlinked company');
select public._t_raises58($q$select public.create_tax_office_request('c5800000-0000-0000-0000-00000000000a', '2026-09', 'c5830000-0000-0000-0000-000000000002', '요청')$q$, 'NOT_FOUND', 'other company item');
select public._t_raises58($q$select public.create_tax_office_request('c5800000-0000-0000-0000-00000000000a', '2026-09', null, '   ')$q$, 'INVALID_REQUEST', 'empty');
do $$
begin
  perform public.create_tax_office_request('c5800000-0000-0000-0000-00000000000a', '2026-09', null, '9월 ○○상사 세금계산서에 맞는 결의서가 없어요');
  perform public.create_tax_office_request('c5800000-0000-0000-0000-00000000000a', '2026-09', 'c5830000-0000-0000-0000-000000000001', '사업자번호 확인 부탁드려요');
  if (select count(*) from public.tax_office_requests) <> 2 then raise exception 'FAIL [office sees 2]'; end if;
  if (select item_label from public.tax_office_requests where item_id is not null) <> '2026-09-10 · 김밥집 · 12,000원' then raise exception 'FAIL [item label] %', (select item_label from public.tax_office_requests where item_id is not null); end if;
end;
$$;
select public._t_raises58($q$select public.answer_tax_office_request((select id from public.tax_office_requests limit 1), '답')$q$, '42501', 'office cannot answer');
reset role;

-- 회사: 직원은 못 봄·못 답함, 관리자는 답변, 다른 회사는 못 봄
select public._t_as58('a5800000-0000-0000-0000-000000000002');
set local role authenticated;
do $$ begin if (select count(*) from public.tax_office_requests) <> 0 then raise exception 'FAIL [employee hidden]'; end if; end; $$;
reset role;
select public._t_as58('a5800000-0000-0000-0000-000000000003');
set local role authenticated;
do $$ begin if (select count(*) from public.tax_office_requests) <> 0 then raise exception 'FAIL [other company hidden]'; end if; end; $$;
reset role;
do $$ begin perform set_config('t.req', (select id::text from public.tax_office_requests where item_id is null), true); end; $$;
select public._t_as58('a5800000-0000-0000-0000-000000000003');
set local role authenticated;
select public._t_raises58($q$select public.answer_tax_office_request(current_setting('t.req')::uuid, '답')$q$, 'NOT_FOUND', 'other company answer');
reset role;
select public._t_as58('a5800000-0000-0000-0000-000000000001');
set local role authenticated;
select public.answer_tax_office_request(current_setting('t.req')::uuid, ' 법카 개인 사용으로 처리했어요(카드 대조 참고) ');
do $$
begin
  if (select status || '|' || answer || '|' || answered_by_name from public.tax_office_requests where id = current_setting('t.req')::uuid) <> 'answered|법카 개인 사용으로 처리했어요(카드 대조 참고)|A대표' then raise exception 'FAIL [answered]'; end if;
end;
$$;
reset role;

-- 세무사: 해결 → 다시 열기(답변이 있으면 답변 상태로)
select public._t_as58('a5800000-0000-0000-0000-000000000004');
set local role authenticated;
select public.set_tax_office_request_status(current_setting('t.req')::uuid, true);
do $$ begin if (select status from public.tax_office_requests where id = current_setting('t.req')::uuid) <> 'resolved' then raise exception 'FAIL [resolved]'; end if; end; $$;
select public.set_tax_office_request_status(current_setting('t.req')::uuid, false);
do $$ begin if (select status from public.tax_office_requests where id = current_setting('t.req')::uuid) <> 'answered' then raise exception 'FAIL [reopened]'; end if; end; $$;
reset role;
select public._t_as58('a5800000-0000-0000-0000-000000000005');
set local role authenticated;
select public._t_raises58($q$select public.set_tax_office_request_status(current_setting('t.req')::uuid, true)$q$, '42501', 'non office member');
reset role;

-- 사무소 웹푸시 구독 표는 로그인 사용자가 직접 못 씀
select public._t_as58('a5800000-0000-0000-0000-000000000004');
set local role authenticated;
select public._t_raises58($q$insert into public.tax_office_push_subscriptions (office_member_id, endpoint, p256dh, auth) values (gen_random_uuid(), 'https://x', repeat('a', 30), repeat('b', 20))$q$, '42501', 'no direct push insert');
reset role;

select 'office_requests ok';
rollback;
