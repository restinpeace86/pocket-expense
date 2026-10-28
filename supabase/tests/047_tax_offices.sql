-- =============================================================================
-- 047_tax_offices.sql — 세무사무소 워크스페이스 (D-149, migration 076)
-- 회사 A(대표 sup, 직원 emp), 회사 B(대표 bsup), 회사 C(사무소 X 고객 아님)
-- 사무소 X: 관리자 xa(먼저 요청 → 등록), 세무사 xs(초대 코드 합류), 세무사 xs2 / 사무소 Y: 관리자 ya / 미확인 이메일 unv
-- =============================================================================
begin;

-- 이 테스트는 가짜 번호로 회사·사무소를 만든다: 트랜잭션 안에서만 국세청 확인을 끈다(검증 자체는 003 테스트, D-155)
update private.app_settings set value = 'off' where key = 'business_verify_mode';

create function public._t_raises47(p_sql text, p_code text, p_label text)
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
grant execute on function public._t_raises47(text, text, text) to authenticated;
create function public._t_as47(p_uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
end;
$$;

insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at) values
  ('a4700000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sup47@test.local', now()),
  ('a4700000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'emp47@test.local', now()),
  ('a4700000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bsup47@test.local', now()),
  ('a4700000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'Office47X@Test.local', now()),
  ('a4700000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'staff47@test.local', now()),
  ('a4700000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'unv47@test.local', null),
  ('a4700000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'office47y@test.local', now()),
  ('a4700000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'staff47b@test.local', now());
insert into public.companies (id, name, invite_code, business_number) values
  ('c4700000-0000-0000-0000-00000000000a', '세무연결A', 'TAXAGNTA', '1000000471'),
  ('c4700000-0000-0000-0000-00000000000b', '세무연결B', 'TAXAGNTB', '1000000472'),
  ('c4700000-0000-0000-0000-00000000000c', '세무연결C', 'TAXAGNTC', '1000000473');
insert into public.members (id, auth_user_id, company_id, name, phone, role, status, privacy_agreed_at) values
  ('a4710000-0000-0000-0000-000000000001', 'a4700000-0000-0000-0000-000000000001', 'c4700000-0000-0000-0000-00000000000a', '가대표', '01094701001', 'super_admin', 'approved', now()),
  ('a4710000-0000-0000-0000-000000000002', 'a4700000-0000-0000-0000-000000000002', 'c4700000-0000-0000-0000-00000000000a', '나직원', '01094701002', 'employee', 'approved', now()),
  ('a4710000-0000-0000-0000-000000000003', 'a4700000-0000-0000-0000-000000000003', 'c4700000-0000-0000-0000-00000000000b', 'B대표', '01094701003', 'super_admin', 'approved', now()),
  -- 세무사 xs2는 회사 C의 직원이기도 하다(회사 멤버와 사무소 구성원은 별개)
  ('a4710000-0000-0000-0000-000000000008', 'a4700000-0000-0000-0000-000000000008', 'c4700000-0000-0000-0000-00000000000c', '세무사겸직원', '01094701008', 'employee', 'approved', now());
insert into public.account_titles (id, company_id, name, code) values
  ('a4720000-0000-0000-0000-00000000000a', 'c4700000-0000-0000-0000-00000000000a', '복리후생비', '811'),
  ('a4720000-0000-0000-0000-00000000000b', 'c4700000-0000-0000-0000-00000000000b', '복리후생비', '811'),
  ('a4720000-0000-0000-0000-00000000000c', 'c4700000-0000-0000-0000-00000000000c', '복리후생비', '811');
insert into public.expense_claims (id, company_id, member_id, title, status) values
  ('a4730000-0000-0000-0000-000000000001', 'c4700000-0000-0000-0000-00000000000a', 'a4710000-0000-0000-0000-000000000002', '9월 승인', 'approved'),
  ('a4730000-0000-0000-0000-000000000002', 'c4700000-0000-0000-0000-00000000000a', 'a4710000-0000-0000-0000-000000000002', '9월 결재중', 'submitted');
insert into public.expense_items (id, claim_id, company_id, sort_order, category, payment_method, expense_date, amount, headcount) values
  ('a4740000-0000-0000-0000-000000000001', 'a4730000-0000-0000-0000-000000000001', 'c4700000-0000-0000-0000-00000000000a', 1, 'meal', 'personal_card', '2026-09-10', 8000, 1),
  ('a4740000-0000-0000-0000-000000000002', 'a4730000-0000-0000-0000-000000000002', 'c4700000-0000-0000-0000-00000000000a', 1, 'meal', 'personal_card', '2026-09-11', 7000, 1);

-- ── 회사: 직원은 지정 불가, 대표 A가 아직 없는 사무소 X를 지정(담당 = staff47) ─────────
select public._t_as47('a4700000-0000-0000-0000-000000000002');
set local role authenticated;
select public._t_raises47($q$select public.set_company_tax_office('X세무', 'office47x@test.local', null, null, null)$q$, '42501', 'employee set');
reset role;
select public._t_as47('a4700000-0000-0000-0000-000000000001');
set local role authenticated;
select public._t_raises47($q$select public.set_company_tax_office('', 'office47x@test.local', null, null, null)$q$, 'INVALID_TAX_OFFICE', 'office blank');
select public._t_raises47($q$select public.set_company_tax_office('X세무', 'nope', null, null, null)$q$, 'INVALID_TAX_OFFICE_EMAIL', 'bad email');
select public._t_raises47($q$select public.set_company_tax_office('X세무', 'office47x@test.local', '홍', 'bad', null)$q$, 'INVALID_TAX_AGENT_EMAIL', 'bad agent email');
select public.set_company_tax_office(' X세무사무소 ', ' OFFICE47X@test.local ', '김세무', 'STAFF47@test.local', '02-123-4567');
do $$
declare j jsonb := public.my_company_tax_office();
begin
  if (j->>'registered')::boolean or j->>'office_email' <> 'office47x@test.local' or j->>'agent_email' <> 'staff47@test.local' then raise exception 'FAIL [A pending] %', j; end if;
end;
$$;
reset role;
-- 대표 B도 사무소 X(담당 미정)
select public._t_as47('a4700000-0000-0000-0000-000000000003');
set local role authenticated;
select public.set_company_tax_office('X세무사무소', 'office47x@test.local', null, null, null);
reset role;

-- ── 등록 전: 사무소 이메일 주인은 요청만 보고, 자료는 못 봄 ──────────────────────────
select public._t_as47('a4700000-0000-0000-0000-000000000004');
set local role authenticated;
do $$
declare j jsonb := public.my_tax_office();
begin
  if j->>'member_id' is not null or jsonb_array_length(j->'requests') <> 2 then raise exception 'FAIL [requests before register] %', j; end if;
  if (select count(*) from public.tax_office_clients()) <> 0 then raise exception 'FAIL [no clients before register]'; end if;
end;
$$;
select public._t_raises47($q$select public.tax_office_month_export('c4700000-0000-0000-0000-00000000000a', '2026-09')$q$, 'NOT_FOUND', 'export before register');
select public._t_raises47($q$select public.register_tax_office('X세무사무소', '2000000471', '엑스대표', null, false, true)$q$, 'TERMS_REQUIRED', 'terms');
-- 사무소 등록 → 요청 2곳이 고객사로, 관리자는 둘 다 봄
do $$
declare r jsonb;
begin
  perform public.register_tax_office('X세무사무소', '200-00-00471', '엑스대표', '010-4700-0004', true, true);
  if (select count(*) from public.tax_office_clients()) <> 2 then raise exception 'FAIL [admin sees all clients]'; end if;
  r := public.tax_office_month_export('c4700000-0000-0000-0000-00000000000a', '2026-09');
  if jsonb_array_length(r->'rows') <> 1 or (r->'excluded'->>'submitted')::int <> 1 then raise exception 'FAIL [approved only] %', r; end if;
  if (select count(*) from public.account_titles) <> 2 then raise exception 'FAIL [admin titles A,B]'; end if;
  -- 회사 테이블 직접 열람 불가(멤버 아님)
  if (select count(*) from public.expense_claims) <> 0 or (select count(*) from public.members) <> 0 or (select count(*) from public.company_tax_offices) <> 0 then raise exception 'FAIL [no direct read]'; end if;
end;
$$;
select public._t_raises47($q$select public.register_tax_office('또등록', '2000000479', '엑스대표', null, true, true)$q$, 'ALREADY_TAX_OFFICE_MEMBER', 'register twice');
select public._t_raises47($q$select public.tax_office_month_export('c4700000-0000-0000-0000-00000000000c', '2026-09')$q$, 'NOT_FOUND', 'export non-client');
reset role;

-- 같은 사업자번호·같은 이메일로 또 등록 불가, 미확인 이메일은 등록 불가
select public._t_as47('a4700000-0000-0000-0000-000000000007');
set local role authenticated;
select public._t_raises47($q$select public.register_tax_office('Y', '2000000471', 'Y대표', null, true, true)$q$, 'TAX_OFFICE_ALREADY_REGISTERED', 'dup bizno');
reset role;
select public._t_as47('a4700000-0000-0000-0000-000000000006');
set local role authenticated;
select public._t_raises47($q$select public.register_tax_office('U', '2000000476', 'U', null, true, true)$q$, 'EMAIL_NOT_VERIFIED', 'unverified');
reset role;

-- ── 세무사 합류: 회사 A가 적은 담당 이메일과 같아 A에 자동 배정, B는 못 봄 ───────────────
select public._t_as47('a4700000-0000-0000-0000-000000000005');
set local role authenticated;
select public._t_raises47($q$select public.join_tax_office('ZZZZZZZZ', '김세무', null, true, true)$q$, 'INVALID_TAX_OFFICE_CODE', 'bad code');
select public._t_raises47($q$select invite_code from public.tax_offices$q$, '42501', 'office table hidden');
select public._t_raises47($q$select * from public.tax_office_members$q$, '42501', 'office members hidden');
reset role;
do $$
declare v_code text;
begin
  select invite_code into v_code from public.tax_offices where contact_email = 'office47x@test.local';
  perform set_config('t.code', v_code, true);
end;
$$;
select public._t_as47('a4700000-0000-0000-0000-000000000005');
set local role authenticated;
do $$
begin
  if public.get_tax_office_by_code(current_setting('t.code')) <> 'X세무사무소' then raise exception 'FAIL [code lookup]'; end if;
  perform public.join_tax_office(lower(current_setting('t.code')), '김세무', null, true, true);
  if (select string_agg(company_name, ',') from public.tax_office_clients()) <> '세무연결A' then raise exception 'FAIL [staff assigned only A]'; end if;
  if (select count(*) from public.account_titles) <> 1 then raise exception 'FAIL [staff titles A only]'; end if;
  update public.account_titles set code = '8110' where id = 'a4720000-0000-0000-0000-00000000000a';
  insert into public.account_titles (company_id, name, code) values ('c4700000-0000-0000-0000-00000000000a', '회의비', '819');
  delete from public.account_titles where id = 'a4720000-0000-0000-0000-00000000000a';
  if not exists (select 1 from public.account_titles where id = 'a4720000-0000-0000-0000-00000000000a') then raise exception 'FAIL [staff cannot delete]'; end if;
end;
$$;
select public._t_raises47($q$select public.tax_office_month_export('c4700000-0000-0000-0000-00000000000b', '2026-09')$q$, 'NOT_FOUND', 'staff unassigned B');
select public._t_raises47($q$select public.assign_tax_office_agent('c4700000-0000-0000-0000-00000000000b', null)$q$, '42501', 'staff cannot assign');
select public._t_raises47($q$select * from public.tax_office_member_list()$q$, '42501', 'staff cannot list members');
select public._t_raises47($q$insert into public.account_titles (company_id, name) values ('c4700000-0000-0000-0000-00000000000b', '남의회사')$q$, '42501', 'staff insert B');
reset role;

-- 세무사2(회사 C 직원) 합류 → 관리자가 B 배정
select public._t_as47('a4700000-0000-0000-0000-000000000008');
set local role authenticated;
do $$ begin perform public.join_tax_office(current_setting('t.code'), '박세무', null, true, true); end; $$;
reset role;
select public._t_as47('a4700000-0000-0000-0000-000000000004');
set local role authenticated;
do $$
declare v_s2 uuid;
begin
  select id into v_s2 from public.tax_office_member_list() where name = '박세무';
  perform public.assign_tax_office_agent('c4700000-0000-0000-0000-00000000000b', v_s2);
  if (select assigned_name from public.tax_office_clients() where company_id = 'c4700000-0000-0000-0000-00000000000b') <> '박세무' then raise exception 'FAIL [assign]'; end if;
end;
$$;
select public._t_raises47($q$select public.assign_tax_office_agent('c4700000-0000-0000-0000-00000000000c', null)$q$, 'NOT_FOUND', 'assign non-client');
reset role;
select public._t_as47('a4700000-0000-0000-0000-000000000008');
set local role authenticated;
do $$
begin
  if (select string_agg(company_name, ',') from public.tax_office_clients()) <> '세무연결B' then raise exception 'FAIL [staff2 sees B]'; end if;
  -- 자기 회사(C)는 직원이라 계정과목 못 봄, 사무소로 배정된 B만
  if (select string_agg(company_id::text, ',') from public.account_titles) <> 'c4700000-0000-0000-0000-00000000000b' then raise exception 'FAIL [staff2 titles scope]'; end if;
end;
$$;
reset role;

-- 회사 쪽 표시: A는 등록됨 + 담당 김세무
select public._t_as47('a4700000-0000-0000-0000-000000000001');
set local role authenticated;
do $$
declare j jsonb := public.my_company_tax_office();
begin
  if not (j->>'registered')::boolean or j->>'assigned_name' <> '김세무' or j->>'registered_name' <> 'X세무사무소' then raise exception 'FAIL [A view] %', j; end if;
end;
$$;
reset role;

-- 관리자가 세무사 이용 중지 → 배정 풀리고 즉시 못 봄
select public._t_as47('a4700000-0000-0000-0000-000000000004');
set local role authenticated;
do $$
declare v_s uuid; v_me uuid;
begin
  select id into v_s from public.tax_office_member_list() where name = '김세무';
  select id into v_me from public.tax_office_member_list() where role = 'admin';
  perform public.set_tax_office_member_status(v_s, 'inactive');
  if (select assigned_member_id from public.tax_office_clients() where company_id = 'c4700000-0000-0000-0000-00000000000a') is not null then raise exception 'FAIL [unassigned on inactive]'; end if;
  perform public._t_raises47(format('select public.set_tax_office_member_status(%L, %L)', v_me, 'inactive'), 'INVALID_TARGET', 'self inactive');
end;
$$;
reset role;
select public._t_as47('a4700000-0000-0000-0000-000000000005');
set local role authenticated;
do $$ begin if (select count(*) from public.tax_office_clients()) <> 0 or (select count(*) from public.account_titles) <> 0 then raise exception 'FAIL [inactive blocked]'; end if; end; $$;
reset role;

-- 회사 A가 사무소를 Y로 바꾸면 X는 즉시 A를 못 봄(사무소 Y는 아직 미등록 → 대기)
select public._t_as47('a4700000-0000-0000-0000-000000000001');
set local role authenticated;
select public.set_company_tax_office('Y세무', 'office47y@test.local', null, null, null);
reset role;
select public._t_as47('a4700000-0000-0000-0000-000000000004');
set local role authenticated;
do $$ begin if (select string_agg(company_name, ',') from public.tax_office_clients()) <> '세무연결B' then raise exception 'FAIL [X lost A]'; end if; end; $$;
select public._t_raises47($q$select public.tax_office_month_export('c4700000-0000-0000-0000-00000000000a', '2026-09')$q$, 'NOT_FOUND', 'X after change');
reset role;
-- Y 등록 → A가 바로 Y 목록에
select public._t_as47('a4700000-0000-0000-0000-000000000007');
set local role authenticated;
do $$
begin
  perform public.register_tax_office('Y세무사무소', '2000000472', 'Y대표', null, true, true);
  if (select string_agg(company_name, ',') from public.tax_office_clients()) <> '세무연결A' then raise exception 'FAIL [Y gets A]'; end if;
end;
$$;
reset role;
-- B가 연결 해제 → X 목록에서 사라짐
select public._t_as47('a4700000-0000-0000-0000-000000000003');
set local role authenticated;
select public.clear_company_tax_office();
reset role;
select public._t_as47('a4700000-0000-0000-0000-000000000004');
set local role authenticated;
do $$ begin if (select count(*) from public.tax_office_clients()) <> 0 then raise exception 'FAIL [cleared]'; end if; end; $$;
reset role;

-- 관리자 세무 마감은 그대로
select public._t_as47('a4700000-0000-0000-0000-000000000001');
set local role authenticated;
do $$ begin if jsonb_array_length(public.tax_month_export('2026-09')->'rows') <> 1 then raise exception 'FAIL [admin export]'; end if; end; $$;
reset role;

select 'tax_offices ok';
rollback;
