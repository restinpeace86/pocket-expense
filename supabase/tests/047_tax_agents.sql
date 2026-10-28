-- =============================================================================
-- 047_tax_agents.sql — 담당 세무사(외부 열람자): 관리자만 설정·연결된 회사만 열람·이메일 변경 시 즉시 해제·
-- 확인 안 된 이메일 불가·멤버 소속과 별개·계정과목 추가/수정만·회사 격리 (D-148, migration 075)
-- 회사 A: 대표 sup, 직원 emp / 회사 B: 대표 bsup / 세무사 tax(소속 없음), 세무사2 tax2, 미확인 이메일 unv
-- =============================================================================
begin;

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

insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at) values
  ('a4700000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sup47@test.local', now()),
  ('a4700000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'emp47@test.local', now()),
  ('a4700000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bsup47@test.local', now()),
  ('a4700000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'Tax47@Test.local', now()),
  ('a4700000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tax47b@test.local', now()),
  ('a4700000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'unv47@test.local', null);
insert into public.companies (id, name, invite_code, business_number) values
  ('c4700000-0000-0000-0000-00000000000a', '세무연결A', 'TAXAGNTA', '1000000471'),
  ('c4700000-0000-0000-0000-00000000000b', '세무연결B', 'TAXAGNTB', '1000000472'),
  ('c4700000-0000-0000-0000-00000000000c', '세무연결C', 'TAXAGNTC', '1000000473');
insert into public.members (id, auth_user_id, company_id, name, phone, role, status, privacy_agreed_at) values
  ('a4710000-0000-0000-0000-000000000001', 'a4700000-0000-0000-0000-000000000001', 'c4700000-0000-0000-0000-00000000000a', '가대표', '01094701001', 'super_admin', 'approved', now()),
  ('a4710000-0000-0000-0000-000000000002', 'a4700000-0000-0000-0000-000000000002', 'c4700000-0000-0000-0000-00000000000a', '나직원', '01094701002', 'employee', 'approved', now()),
  ('a4710000-0000-0000-0000-000000000003', 'a4700000-0000-0000-0000-000000000003', 'c4700000-0000-0000-0000-00000000000b', 'B대표', '01094701003', 'super_admin', 'approved', now()),
  -- 세무사2는 회사 C의 멤버이기도 하다(멤버 소속과 세무사 연결은 별개)
  ('a4710000-0000-0000-0000-000000000005', 'a4700000-0000-0000-0000-000000000005', 'c4700000-0000-0000-0000-00000000000c', '세무사2', '01094701005', 'employee', 'approved', now());
insert into public.account_titles (id, company_id, name, code) values
  ('a4720000-0000-0000-0000-00000000000a', 'c4700000-0000-0000-0000-00000000000a', '복리후생비', '811'),
  ('a4720000-0000-0000-0000-00000000000b', 'c4700000-0000-0000-0000-00000000000b', '복리후생비', '811');
insert into public.expense_claims (id, company_id, member_id, title, status) values
  ('a4730000-0000-0000-0000-000000000001', 'c4700000-0000-0000-0000-00000000000a', 'a4710000-0000-0000-0000-000000000002', '9월 승인', 'approved'),
  ('a4730000-0000-0000-0000-000000000002', 'c4700000-0000-0000-0000-00000000000a', 'a4710000-0000-0000-0000-000000000002', '9월 결재중', 'submitted');
insert into public.expense_items (id, claim_id, company_id, sort_order, category, payment_method, expense_date, amount, headcount) values
  ('a4740000-0000-0000-0000-000000000001', 'a4730000-0000-0000-0000-000000000001', 'c4700000-0000-0000-0000-00000000000a', 1, 'meal', 'personal_card', '2026-09-10', 8000, 1),
  ('a4740000-0000-0000-0000-000000000002', 'a4730000-0000-0000-0000-000000000002', 'c4700000-0000-0000-0000-00000000000a', 1, 'meal', 'personal_card', '2026-09-11', 7000, 1);

-- 직원은 담당 세무사를 넣을 수 없음
select set_config('request.jwt.claims', '{"sub":"a4700000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select public._t_raises47($q$select public.set_tax_agent('OO세무', '홍세무', 'tax47@test.local', null)$q$, '42501', 'employee set');
reset role;

-- 연결 전: 세무사는 아무 회사도 못 봄
select set_config('request.jwt.claims', '{"sub":"a4700000-0000-0000-0000-000000000004","role":"authenticated"}', true);
set local role authenticated;
do $$ begin if (select count(*) from public.my_tax_agent_companies()) <> 0 then raise exception 'FAIL [before link]'; end if; end; $$;
select public._t_raises47($q$select public.tax_agent_month_export('c4700000-0000-0000-0000-00000000000a', '2026-09')$q$, 'NOT_FOUND', 'export before link');
reset role;

-- 대표 A: 잘못된 값 거절 → 대문자 이메일로 저장(소문자로 맞춤)
select set_config('request.jwt.claims', '{"sub":"a4700000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select public._t_raises47($q$select public.set_tax_agent('', '홍세무', 'tax47@test.local', null)$q$, 'INVALID_TAX_OFFICE', 'office blank');
select public._t_raises47($q$select public.set_tax_agent('OO세무', ' ', 'tax47@test.local', null)$q$, 'INVALID_TAX_AGENT_NAME', 'name blank');
select public._t_raises47($q$select public.set_tax_agent('OO세무', '홍세무', 'not-an-email', null)$q$, 'INVALID_TAX_AGENT_EMAIL', 'bad email');
select public._t_raises47($q$select public.set_tax_agent('OO세무', '홍세무', 'tax47@test.local', '12')$q$, 'INVALID_TAX_AGENT_PHONE', 'bad phone');
select public.set_tax_agent(' OO세무사무소 ', '홍길동 세무사', ' TAX47@test.LOCAL ', '02-123-4567');
do $$
begin
  if (select agent_email from public.tax_agent_links) <> 'tax47@test.local' then raise exception 'FAIL [email lower]'; end if;
  if (select agent_phone from public.tax_agent_links) <> '021234567' then raise exception 'FAIL [phone digits]'; end if;
end;
$$;
reset role;
-- 대표 B: 같은 세무사 이메일 → 담당 회사가 자동으로 늘어남
select set_config('request.jwt.claims', '{"sub":"a4700000-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select public.set_tax_agent('OO세무사무소', '홍길동 세무사', 'tax47@test.local', null);
do $$ begin if (select count(*) from public.tax_agent_links) <> 1 then raise exception 'FAIL [B sees only own link]'; end if; end; $$;
reset role;

-- 세무사: 회사 A·B가 보이고, 승인된 지출만, 계정과목 추가·수정 가능, 삭제·직접 열람 불가
select set_config('request.jwt.claims', '{"sub":"a4700000-0000-0000-0000-000000000004","role":"authenticated"}', true);
set local role authenticated;
do $$
declare r jsonb;
begin
  if (select string_agg(company_name, ',' order by company_name) from public.my_tax_agent_companies()) <> '세무연결A,세무연결B' then raise exception 'FAIL [agent companies]'; end if;
  r := public.tax_agent_month_export('c4700000-0000-0000-0000-00000000000a', '2026-09');
  if jsonb_array_length(r->'rows') <> 1 or r->'rows'->0->>'item_id' <> 'a4740000-0000-0000-0000-000000000001' then raise exception 'FAIL [approved only] %', r->'rows'; end if;
  if (r->'excluded'->>'submitted')::int <> 1 then raise exception 'FAIL [excluded count]'; end if;
  -- 회사 데이터 테이블은 직접 못 읽음(멤버가 아님)
  if (select count(*) from public.expense_claims) <> 0 or (select count(*) from public.expense_items) <> 0 or (select count(*) from public.members) <> 0 then raise exception 'FAIL [no direct read]'; end if;
  if (select count(*) from public.tax_agent_links) <> 0 then raise exception 'FAIL [links hidden from agent]'; end if;
  if (select count(*) from public.account_titles) <> 2 then raise exception 'FAIL [titles of A and B]'; end if;
  update public.account_titles set code = '8110' where id = 'a4720000-0000-0000-0000-00000000000a';
  insert into public.account_titles (company_id, name, code) values ('c4700000-0000-0000-0000-00000000000a', '회의비', '819');
end;
$$;
select public._t_raises47($q$select public.tax_agent_month_export('c4700000-0000-0000-0000-00000000000c', '2026-09')$q$, 'NOT_FOUND', 'export other company');
select public._t_raises47($q$select public.tax_agent_month_export('c4700000-0000-0000-0000-00000000000a', '2026-13')$q$, 'INVALID_MONTH', 'bad month');
select public._t_raises47($q$insert into public.account_titles (company_id, name) values ('c4700000-0000-0000-0000-00000000000c', '남의회사')$q$, '42501', 'insert other company title');
select public._t_raises47($q$select public.set_tax_agent('OO', '홍', 'x@y.zz', null)$q$, 'NOT_A_MEMBER', 'agent cannot set');
do $$
begin
  delete from public.account_titles where id = 'a4720000-0000-0000-0000-00000000000a';
  if not found then return; end if;
  raise exception 'FAIL [agent delete]';
end;
$$;
reset role;
do $$
begin
  if (select code from public.account_titles where id = 'a4720000-0000-0000-0000-00000000000a') <> '8110' then raise exception 'FAIL [agent code edit]'; end if;
  if not exists (select 1 from public.account_titles where company_id = 'c4700000-0000-0000-0000-00000000000a' and name = '회의비') then raise exception 'FAIL [agent add]'; end if;
end;
$$;

-- 확인 안 된 이메일은 같은 주소라도 연결 안 됨
update auth.users set email = 'tax47@test.local' where id = 'a4700000-0000-0000-0000-000000000006';
select set_config('request.jwt.claims', '{"sub":"a4700000-0000-0000-0000-000000000006","role":"authenticated"}', true);
set local role authenticated;
do $$ begin if (select count(*) from public.my_tax_agent_companies()) <> 0 then raise exception 'FAIL [unverified]'; end if; end; $$;
reset role;

-- 회사 C의 멤버(세무사2)도 다른 회사의 세무사가 될 수 있음
select set_config('request.jwt.claims', '{"sub":"a4700000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select public.set_tax_agent('새세무', '세무사2', 'tax47b@test.local', null);
reset role;
select set_config('request.jwt.claims', '{"sub":"a4700000-0000-0000-0000-000000000004","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  -- A가 이메일을 바꿨으므로 이전 세무사는 A를 바로 못 봄, B는 그대로
  if (select string_agg(company_name, ',') from public.my_tax_agent_companies()) <> '세무연결B' then raise exception 'FAIL [revoked on change]'; end if;
  if (select count(*) from public.account_titles where company_id = 'c4700000-0000-0000-0000-00000000000a') <> 0 then raise exception 'FAIL [titles revoked]'; end if;
end;
$$;
select public._t_raises47($q$select public.tax_agent_month_export('c4700000-0000-0000-0000-00000000000a', '2026-09')$q$, 'NOT_FOUND', 'export after change');
reset role;
select set_config('request.jwt.claims', '{"sub":"a4700000-0000-0000-0000-000000000005","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  if (select string_agg(company_name, ',') from public.my_tax_agent_companies()) <> '세무연결A' then raise exception 'FAIL [member also agent]'; end if;
  -- 자기 회사(C) 멤버 권한은 그대로(직원이라 계정과목 못 봄), 세무사로 연결된 A 계정과목만 보임
  if (select count(*) from public.account_titles where company_id <> 'c4700000-0000-0000-0000-00000000000a') <> 0 then raise exception 'FAIL [member scope]'; end if;
end;
$$;
reset role;

-- 연결 끊기 → 바로 못 봄
select set_config('request.jwt.claims', '{"sub":"a4700000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select public.clear_tax_agent();
reset role;
select set_config('request.jwt.claims', '{"sub":"a4700000-0000-0000-0000-000000000005","role":"authenticated"}', true);
set local role authenticated;
do $$ begin if (select count(*) from public.my_tax_agent_companies()) <> 0 then raise exception 'FAIL [cleared]'; end if; end; $$;
reset role;

-- 관리자 세무 마감은 그대로(같은 private 함수)
select set_config('request.jwt.claims', '{"sub":"a4700000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
do $$ begin if jsonb_array_length(public.tax_month_export('2026-09')->'rows') <> 1 then raise exception 'FAIL [admin export]'; end if; end; $$;
reset role;

select 'tax_agents ok';
rollback;
