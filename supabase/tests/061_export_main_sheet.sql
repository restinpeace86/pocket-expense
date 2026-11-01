-- =============================================================================
-- 061_export_main_sheet.sql — 세무용 엑셀 회계 프로그램 시트 설정 (D-189, migration 099)
-- 고객사 법인카드 수집 방식: 그 고객사를 볼 수 있는 사무소 구성원만 / 사무소 기본 양식: 사무소 관리자만, 자기 양식만, 양식을 지우면 위하고로
-- 설정 읽기: 그 회사 관리자·볼 수 있는 사무소 구성원만, 연결 없으면 기본값
-- =============================================================================
begin;

update private.app_settings set value = 'off' where key = 'business_verify_mode';

create function public._t_raises61(p_sql text, p_code text, p_label text)
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
grant execute on function public._t_raises61(text, text, text) to authenticated;
create function public._t_as61(p_uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
end;
$$;

insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at) values
  ('a6100000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sa61@test.local', now()),
  ('a6100000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sb61@test.local', now()),
  ('a6100000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sc61@test.local', now()),
  ('a6100000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'office61@test.local', now()),
  ('a6100000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'staff61@test.local', now()),
  ('a6100000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'emp61@test.local', now());
insert into public.companies (id, name, invite_code, business_number) values
  ('c6100000-0000-0000-0000-00000000000a', '엑셀A', 'XLSAAAAA', '1000000611'),
  ('c6100000-0000-0000-0000-00000000000b', '엑셀B', 'XLSBBBBB', '1000000612'),
  ('c6100000-0000-0000-0000-00000000000c', '엑셀C', 'XLSCCCCC', '1000000613');
insert into public.members (id, auth_user_id, company_id, name, phone, role, status, privacy_agreed_at) values
  ('a6110000-0000-0000-0000-000000000001', 'a6100000-0000-0000-0000-000000000001', 'c6100000-0000-0000-0000-00000000000a', 'A대표', '01096101001', 'super_admin', 'approved', now()),
  ('a6110000-0000-0000-0000-000000000002', 'a6100000-0000-0000-0000-000000000002', 'c6100000-0000-0000-0000-00000000000b', 'B대표', '01096101002', 'super_admin', 'approved', now()),
  ('a6110000-0000-0000-0000-000000000003', 'a6100000-0000-0000-0000-000000000003', 'c6100000-0000-0000-0000-00000000000c', 'C대표', '01096101003', 'super_admin', 'approved', now()),
  ('a6110000-0000-0000-0000-000000000006', 'a6100000-0000-0000-0000-000000000006', 'c6100000-0000-0000-0000-00000000000a', 'A직원', '01096101006', 'employee', 'approved', now());

-- 사무소 등록, A·B 연결(C는 연결 안 함), 세무사 합류 → A 배정
select public._t_as61('a6100000-0000-0000-0000-000000000004');
set local role authenticated;
select public.register_tax_office('엑셀세무', '2000000611', '엑대표', null, true, true);
reset role;
select public._t_as61('a6100000-0000-0000-0000-000000000001');
set local role authenticated;
select public.set_company_tax_office('엑셀세무', 'office61@test.local', null, null, null);
reset role;
select public._t_as61('a6100000-0000-0000-0000-000000000002');
set local role authenticated;
select public.set_company_tax_office('엑셀세무', 'office61@test.local', null, null, null);
reset role;
do $$
begin
  perform set_config('t.code', (select invite_code from public.tax_offices where contact_email = 'office61@test.local'), true);
end;
$$;
select public._t_as61('a6100000-0000-0000-0000-000000000005');
set local role authenticated;
do $$ begin perform public.join_tax_office(current_setting('t.code'), '엑세무', null, true, true); end; $$;
reset role;
do $$
begin
  perform set_config('t.staff', (select m.id::text from public.tax_office_members m where m.auth_user_id = 'a6100000-0000-0000-0000-000000000005'), true);
end;
$$;
select public._t_as61('a6100000-0000-0000-0000-000000000004');
set local role authenticated;
do $$ begin perform public.assign_tax_office_agent('c6100000-0000-0000-0000-00000000000a', current_setting('t.staff')::uuid); end; $$;
reset role;

-- 기본값: 회사 관리자가 읽으면 법인카드 홈택스 수집 켬, 위하고(양식 없음). 연결 없는 C도 기본값
select public._t_as61('a6100000-0000-0000-0000-000000000001');
set local role authenticated;
do $$
declare o jsonb := public.tax_export_options('c6100000-0000-0000-0000-00000000000a');
begin
  if (o->>'card_via_hometax')::boolean is not true or o->'main_template' <> 'null'::jsonb or o->>'office_name' <> '엑셀세무' then raise exception 'FAIL [default options] %', o; end if;
end;
$$;
select public._t_raises61($q$select public.tax_export_options('c6100000-0000-0000-0000-00000000000b')$q$, 'NOT_FOUND', 'A admin reads B');
select public._t_raises61($q$select public.set_company_card_via_hometax('c6100000-0000-0000-0000-00000000000a', false)$q$, 'NOT_FOUND', 'company admin sets card');
reset role;
select public._t_as61('a6100000-0000-0000-0000-000000000003');
set local role authenticated;
do $$
declare o jsonb := public.tax_export_options('c6100000-0000-0000-0000-00000000000c');
begin
  if (o->>'card_via_hometax')::boolean is not true or o->'main_template' <> 'null'::jsonb then raise exception 'FAIL [unlinked default] %', o; end if;
end;
$$;
reset role;
select public._t_as61('a6100000-0000-0000-0000-000000000006');
set local role authenticated;
select public._t_raises61($q$select public.tax_export_options('c6100000-0000-0000-0000-00000000000a')$q$, 'NOT_FOUND', 'employee reads options');
reset role;

-- 배정된 세무사: A만 끌 수 있음, B는 못 봄, 사무소 기본 양식은 못 고름
select public._t_as61('a6100000-0000-0000-0000-000000000005');
set local role authenticated;
select public.set_company_card_via_hometax('c6100000-0000-0000-0000-00000000000a', false);
select public._t_raises61($q$select public.set_company_card_via_hometax('c6100000-0000-0000-0000-00000000000b', false)$q$, 'NOT_FOUND', 'staff sets unassigned B');
select public._t_raises61($q$select public.tax_export_options('c6100000-0000-0000-0000-00000000000b')$q$, 'NOT_FOUND', 'staff reads B');
select public._t_raises61($q$select public.set_tax_office_main_template(null)$q$, '42501', 'staff sets main template');
do $$
begin
  if (public.tax_export_options('c6100000-0000-0000-0000-00000000000a')->>'card_via_hometax')::boolean is not false then raise exception 'FAIL [staff turned off A]'; end if;
end;
$$;
reset role;

-- 회사 A 관리자도 바뀐 값을 읽음(회사 엑셀에 같이 적용)
select public._t_as61('a6100000-0000-0000-0000-000000000001');
set local role authenticated;
do $$
begin
  if (public.tax_export_options('c6100000-0000-0000-0000-00000000000a')->>'card_via_hometax')::boolean is not false then raise exception 'FAIL [company sees off]'; end if;
end;
$$;
reset role;

-- 사무소 관리자: 양식 저장 → 기본 양식으로 → 읽기에 양식 / 없는 양식은 거절 / 양식을 지우면 위하고로
select public._t_as61('a6100000-0000-0000-0000-000000000004');
set local role authenticated;
do $$
declare t uuid; o jsonb;
begin
  t := public.save_tax_office_template(null, '세무사랑 일반전표', 'personal', null, null, null, 1, '[{"index":1,"header":"일자","field":"date"},{"index":2,"header":"금액","field":"amount"}]');
  perform public.set_tax_office_main_template(t);
  if public.tax_office_main_template_id() <> t then raise exception 'FAIL [main id]'; end if;
  o := public.tax_export_options('c6100000-0000-0000-0000-00000000000b');
  if o->'main_template'->>'name' <> '세무사랑 일반전표' or o->'main_template'->>'target' <> 'personal' or jsonb_array_length(o->'main_template'->'columns') <> 2 then raise exception 'FAIL [main template read] %', o; end if;
  perform set_config('t.tpl', t::text, true);
end;
$$;
select public._t_raises61($q$select public.set_tax_office_main_template('00000000-0000-0000-0000-000000000099')$q$, 'NOT_FOUND', 'unknown template');
do $$
begin
  perform public.delete_tax_office_template(current_setting('t.tpl')::uuid);
  if public.tax_office_main_template_id() is not null then raise exception 'FAIL [deleted template resets]'; end if;
  perform public.set_tax_office_main_template(null);
end;
$$;
reset role;

rollback;
