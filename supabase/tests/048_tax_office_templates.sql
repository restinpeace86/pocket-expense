-- =============================================================================
-- 048_tax_office_templates.sql — 세무사무소 월말 결산 양식: 관리자만 저장·삭제, 구성원 목록, 칸 검사, 10개 제한,
-- 내려받기 권한(사무소 = 볼 수 있는 고객사, 회사 = 연결된 사무소의 관리자) (D-150, migration 077)
-- =============================================================================
begin;

create function public._t_raises48(p_sql text, p_code text, p_label text)
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
grant execute on function public._t_raises48(text, text, text) to authenticated;
create function public._t_as48(p_uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
end;
$$;

insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at) values
  ('a4800000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sup48@test.local', now()),
  ('a4800000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'emp48@test.local', now()),
  ('a4800000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'csup48@test.local', now()),
  ('a4800000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'office48@test.local', now()),
  ('a4800000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'staff48@test.local', now()),
  ('a4800000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'other48@test.local', now());
insert into public.companies (id, name, invite_code, business_number) values
  ('c4800000-0000-0000-0000-00000000000a', '양식A', 'TMPLAAAA', '1000000481'),
  ('c4800000-0000-0000-0000-00000000000c', '양식C', 'TMPLCCCC', '1000000483');
insert into public.members (id, auth_user_id, company_id, name, phone, role, status, privacy_agreed_at) values
  ('a4810000-0000-0000-0000-000000000001', 'a4800000-0000-0000-0000-000000000001', 'c4800000-0000-0000-0000-00000000000a', '가대표', '01094801001', 'super_admin', 'approved', now()),
  ('a4810000-0000-0000-0000-000000000002', 'a4800000-0000-0000-0000-000000000002', 'c4800000-0000-0000-0000-00000000000a', '나직원', '01094801002', 'employee', 'approved', now()),
  ('a4810000-0000-0000-0000-000000000003', 'a4800000-0000-0000-0000-000000000003', 'c4800000-0000-0000-0000-00000000000c', 'C대표', '01094801003', 'super_admin', 'approved', now());

-- 회사 A → 사무소 X(이메일) 지정, 사무소 X 등록, 세무사 합류(배정 없음), 다른 사무소 Y
select public._t_as48('a4800000-0000-0000-0000-000000000001');
set local role authenticated;
select public.set_company_tax_office('X세무', 'office48@test.local', null, null, null);
reset role;
select public._t_as48('a4800000-0000-0000-0000-000000000004');
set local role authenticated;
select public.register_tax_office('X세무사무소', '2000000481', 'X대표', null, true, true);
reset role;
do $$ begin perform set_config('t.code', (select invite_code from public.tax_offices where contact_email = 'office48@test.local'), true); end; $$;
select public._t_as48('a4800000-0000-0000-0000-000000000005');
set local role authenticated;
do $$ begin perform public.join_tax_office(current_setting('t.code'), '김세무', null, true, true); end; $$;
select public._t_raises48($q$select public.save_tax_office_template(null, '양식', 'all', null, null, null, 1, '[{"index":1,"header":"일자","field":"date"}]')$q$, '42501', 'staff cannot save');
reset role;
select public._t_as48('a4800000-0000-0000-0000-000000000006');
set local role authenticated;
select public.register_tax_office('Y세무', '2000000489', 'Y대표', null, true, true);
reset role;

-- 사무소 X 관리자: 검사·저장·고치기
select public._t_as48('a4800000-0000-0000-0000-000000000004');
set local role authenticated;
select public._t_raises48($q$select public.save_tax_office_template(null, '', 'all', null, null, null, 1, '[{"index":1,"header":"일자","field":"date"}]')$q$, 'INVALID_TEMPLATE_NAME', 'name');
select public._t_raises48($q$select public.save_tax_office_template(null, '양식', 'all', null, null, null, 1, '[{"index":1,"header":"일자","field":"nope"}]')$q$, 'INVALID_TEMPLATE', 'field');
select public._t_raises48($q$select public.save_tax_office_template(null, '양식', 'all', null, null, null, 1, '[{"index":1,"header":"a","field":"date"},{"index":1,"header":"b","field":"amount"}]')$q$, 'INVALID_TEMPLATE', 'dup index');
select public._t_raises48($q$select public.save_tax_office_template(null, '양식', 'all', null, null, null, 1, '[]')$q$, 'INVALID_TEMPLATE', 'empty');
select public._t_raises48($q$select public.save_tax_office_template(null, '양식', 'card', null, null, null, 1, '[{"index":1,"header":"a","field":"date"}]')$q$, 'INVALID_TEMPLATE', 'target');
select public._t_raises48($q$select public.save_tax_office_template(null, '양식', 'all', 'c4800000-0000-0000-0000-00000000000a/c4800000-0000-0000-0000-00000000000a.xlsx', null, null, 1, '[{"index":1,"header":"a","field":"date"}]')$q$, 'INVALID_TEMPLATE', 'other folder');
do $$
declare v_id uuid;
begin
  v_id := public.save_tax_office_template(null, '위하고 카드', 'corporate_card', null, null, null, 1, '[{"index":1,"header":"거래일자","field":"date"},{"index":2,"header":"구분","field":"fixed","fixed":"출금"}]');
  perform public.save_tax_office_template(v_id, '위하고 카드매입', 'corporate_card', null, null, null, 1, '[{"index":1,"header":"거래일자","field":"date"}]');
  if (select name from public.tax_office_template_list()) <> '위하고 카드매입' then raise exception 'FAIL [update]'; end if;
  perform set_config('t.tpl', v_id::text, true);
  -- 10개 제한
  for i in 2..10 loop perform public.save_tax_office_template(null, '양식' || i, 'all', null, null, null, 1, '[{"index":1,"header":"a","field":"amount"}]'); end loop;
end;
$$;
select public._t_raises48($q$select public.save_tax_office_template(null, '11번째', 'all', null, null, null, 1, '[{"index":1,"header":"a","field":"amount"}]')$q$, 'TEMPLATE_LIMIT', 'limit');
select public._t_raises48($q$select * from public.tax_office_templates$q$, '42501', 'table hidden');
-- 사무소 관리자 = 고객사 A 내려받기 가능, C(고객 아님)는 불가
do $$ begin if public.tax_template_for_export(current_setting('t.tpl')::uuid, 'c4800000-0000-0000-0000-00000000000a')->>'office_name' <> 'X세무사무소' then raise exception 'FAIL [office export]'; end if; end; $$;
select public._t_raises48($q$select public.tax_template_for_export(current_setting('t.tpl')::uuid, 'c4800000-0000-0000-0000-00000000000c')$q$, 'NOT_FOUND', 'office non-client');
reset role;

-- 세무사: 목록은 보지만, 배정 안 된 A 양식 내려받기는 불가 → 배정 뒤 가능
select public._t_as48('a4800000-0000-0000-0000-000000000005');
set local role authenticated;
do $$ begin if (select count(*) from public.tax_office_template_list()) <> 10 then raise exception 'FAIL [staff list]'; end if; end; $$;
select public._t_raises48($q$select public.tax_template_for_export(current_setting('t.tpl')::uuid, 'c4800000-0000-0000-0000-00000000000a')$q$, 'NOT_FOUND', 'staff unassigned');
reset role;
select public._t_as48('a4800000-0000-0000-0000-000000000004');
set local role authenticated;
do $$ begin perform public.assign_tax_office_agent('c4800000-0000-0000-0000-00000000000a', (select id from public.tax_office_member_list() where name = '김세무')); end; $$;
reset role;
select public._t_as48('a4800000-0000-0000-0000-000000000005');
set local role authenticated;
do $$ begin perform public.tax_template_for_export(current_setting('t.tpl')::uuid, 'c4800000-0000-0000-0000-00000000000a'); end; $$;
reset role;

-- 다른 사무소 Y: 목록 0, 내려받기 불가, 지우기 불가
select public._t_as48('a4800000-0000-0000-0000-000000000006');
set local role authenticated;
do $$ begin if (select count(*) from public.tax_office_template_list()) <> 0 then raise exception 'FAIL [Y list]'; end if; end; $$;
select public._t_raises48($q$select public.tax_template_for_export(current_setting('t.tpl')::uuid, 'c4800000-0000-0000-0000-00000000000a')$q$, 'NOT_FOUND', 'Y export');
select public._t_raises48($q$select public.delete_tax_office_template(current_setting('t.tpl')::uuid)$q$, 'NOT_FOUND', 'Y delete');
reset role;

-- 회사 A 관리자: 연결된 사무소 양식 목록·내려받기 / 직원 불가 / 회사 C 관리자는 A 것 불가
select public._t_as48('a4800000-0000-0000-0000-000000000001');
set local role authenticated;
do $$
begin
  if (select count(*) from public.my_company_tax_templates()) <> 10 then raise exception 'FAIL [company list]'; end if;
  perform public.tax_template_for_export(current_setting('t.tpl')::uuid, 'c4800000-0000-0000-0000-00000000000a');
end;
$$;
select public._t_raises48($q$select public.tax_template_for_export(current_setting('t.tpl')::uuid, 'c4800000-0000-0000-0000-00000000000c')$q$, 'NOT_FOUND', 'company other id');
reset role;
select public._t_as48('a4800000-0000-0000-0000-000000000002');
set local role authenticated;
select public._t_raises48($q$select public.tax_template_for_export(current_setting('t.tpl')::uuid, 'c4800000-0000-0000-0000-00000000000a')$q$, 'NOT_FOUND', 'employee');
select public._t_raises48($q$select * from public.my_company_tax_templates()$q$, '42501', 'employee list');
reset role;
select public._t_as48('a4800000-0000-0000-0000-000000000003');
set local role authenticated;
do $$ begin if (select count(*) from public.my_company_tax_templates()) <> 0 then raise exception 'FAIL [C list]'; end if; end; $$;
select public._t_raises48($q$select public.tax_template_for_export(current_setting('t.tpl')::uuid, 'c4800000-0000-0000-0000-00000000000a')$q$, 'NOT_FOUND', 'C export A');
reset role;

-- 회사 A가 연결을 끊으면 양식 목록·내려받기 불가
select public._t_as48('a4800000-0000-0000-0000-000000000001');
set local role authenticated;
select public.clear_company_tax_office();
do $$ begin if (select count(*) from public.my_company_tax_templates()) <> 0 then raise exception 'FAIL [cleared]'; end if; end; $$;
select public._t_raises48($q$select public.tax_template_for_export(current_setting('t.tpl')::uuid, 'c4800000-0000-0000-0000-00000000000a')$q$, 'NOT_FOUND', 'after clear');
reset role;

-- 관리자 지우기
select public._t_as48('a4800000-0000-0000-0000-000000000004');
set local role authenticated;
do $$ begin perform public.delete_tax_office_template(current_setting('t.tpl')::uuid); if (select count(*) from public.tax_office_template_list()) <> 9 then raise exception 'FAIL [delete]'; end if; end; $$;
reset role;

select 'tax_office_templates ok';
rollback;
