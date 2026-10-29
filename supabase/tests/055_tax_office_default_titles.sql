-- =============================================================================
-- 055_tax_office_default_titles.sql — 사무소 기본 계정과목 저장·일괄 적용 (D-160, migration 087)
-- 관리자만 저장·적용, 볼 수 없는 회사는 건너뜀, 같은 이름은 코드만 맞추고 회사에만 있는 계정과목은 남김, 변경 이력, 다시 적용하면 0줄
-- =============================================================================
begin;

update private.app_settings set value = 'off' where key = 'business_verify_mode';

create function public._t_raises55(p_sql text, p_code text, p_label text)
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
grant execute on function public._t_raises55(text, text, text) to authenticated;
create function public._t_as55(p_uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
end;
$$;

insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at) values
  ('a5500000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sa55@test.local', now()),
  ('a5500000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sb55@test.local', now()),
  ('a5500000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sc55@test.local', now()),
  ('a5500000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'office55@test.local', now()),
  ('a5500000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'staff55@test.local', now());
insert into public.companies (id, name, invite_code, business_number) values
  ('c5500000-0000-0000-0000-00000000000a', '기본A', 'DFTAAAAA', '1000000551'),
  ('c5500000-0000-0000-0000-00000000000b', '기본B', 'DFTBBBBB', '1000000552'),
  ('c5500000-0000-0000-0000-00000000000c', '남의C', 'DFTCCCCC', '1000000553');
insert into public.members (id, auth_user_id, company_id, name, phone, role, status, privacy_agreed_at) values
  ('a5510000-0000-0000-0000-000000000001', 'a5500000-0000-0000-0000-000000000001', 'c5500000-0000-0000-0000-00000000000a', 'A대표', '01095501001', 'super_admin', 'approved', now()),
  ('a5510000-0000-0000-0000-000000000002', 'a5500000-0000-0000-0000-000000000002', 'c5500000-0000-0000-0000-00000000000b', 'B대표', '01095501002', 'super_admin', 'approved', now()),
  ('a5510000-0000-0000-0000-000000000003', 'a5500000-0000-0000-0000-000000000003', 'c5500000-0000-0000-0000-00000000000c', 'C대표', '01095501003', 'super_admin', 'approved', now());

-- A·B는 사무소 연결, C는 연결 안 함
select public._t_as55('a5500000-0000-0000-0000-000000000004');
set local role authenticated;
select public.register_tax_office('기본세무', '2000000551', '기대표', null, true, true);
reset role;
select public._t_as55('a5500000-0000-0000-0000-000000000001');
set local role authenticated;
select public.set_company_tax_office('기본세무', 'office55@test.local', null, null, null);
reset role;
select public._t_as55('a5500000-0000-0000-0000-000000000002');
set local role authenticated;
select public.set_company_tax_office('기본세무', 'office55@test.local', null, null, null);
reset role;

-- A의 계정과목을 사무소 기준으로 바꿔 둔다(코드 변경 + 새 계정과목 + 식대 연결 변경), B에는 B만의 계정과목
do $$
declare a1 uuid; a2 uuid; b1 uuid;
begin
  insert into public.account_titles (company_id, name, code, sort_order) values ('c5500000-0000-0000-0000-00000000000a', '복리후생비', '8111', 1) returning id into a1;
  insert into public.account_titles (company_id, name, code, sort_order) values ('c5500000-0000-0000-0000-00000000000a', '회의비', '8299', 2) returning id into a2;
  insert into public.account_title_mappings (company_id, category, account_title_id) values ('c5500000-0000-0000-0000-00000000000a', 'meal', a1), ('c5500000-0000-0000-0000-00000000000a', 'meeting', a2);
  insert into public.account_titles (company_id, name, code, sort_order) values ('c5500000-0000-0000-0000-00000000000b', '복리후생비', '811', 1) returning id into b1;
  insert into public.account_titles (company_id, name, code, sort_order) values ('c5500000-0000-0000-0000-00000000000b', 'B전용', null, 50);
  insert into public.account_title_mappings (company_id, category, account_title_id) values ('c5500000-0000-0000-0000-00000000000b', 'meeting', b1);
end;
$$;

-- 사무소 관리자 아닌 사람·회사 관리자는 저장 못 함
select public._t_as55('a5500000-0000-0000-0000-000000000001');
set local role authenticated;
select public._t_raises55($q$select public.save_tax_office_default_titles('c5500000-0000-0000-0000-00000000000a')$q$, '42501', 'company admin save');
reset role;

select public._t_as55('a5500000-0000-0000-0000-000000000004');
set local role authenticated;
select public._t_raises55($q$select public.apply_tax_office_default_titles(array['c5500000-0000-0000-0000-00000000000b']::uuid[])$q$, 'NO_DEFAULT_TITLES', 'apply before save');
select public._t_raises55($q$select public.save_tax_office_default_titles('c5500000-0000-0000-0000-00000000000c')$q$, 'NOT_FOUND', 'save from unlinked company');
-- 저장 = 개별 설정이 아닌 고객사(B)에 바로 적용(D-167)
do $$
declare r jsonb;
begin
  r := public.save_tax_office_default_titles('c5500000-0000-0000-0000-00000000000a');
  if (r->>'companies')::int <> 1 or (r->>'changes')::int < 3 then raise exception 'FAIL [auto applied on save] %', r; end if;
end;
$$;
do $$
declare d jsonb := public.tax_office_default_titles();
begin
  if d->>'source_name' <> '기본A' then raise exception 'FAIL [source] %', d; end if;
  if not exists (select 1 from jsonb_array_elements(d->'titles') e where e->>'name' = '회의비' and e->>'code' = '8299') then raise exception 'FAIL [titles saved]'; end if;
  if jsonb_array_length(d->'custom_company_ids') <> 0 then raise exception 'FAIL [no custom yet]'; end if;
end;
$$;
reset role;

do $$
begin
  if (select code from public.account_titles where company_id = 'c5500000-0000-0000-0000-00000000000b' and name = '복리후생비') <> '8111' then raise exception 'FAIL [code synced]'; end if;
  if not exists (select 1 from public.account_titles where company_id = 'c5500000-0000-0000-0000-00000000000b' and name = '회의비') then raise exception 'FAIL [title added]'; end if;
  if not exists (select 1 from public.account_titles where company_id = 'c5500000-0000-0000-0000-00000000000b' and name = 'B전용') then raise exception 'FAIL [company-only kept]'; end if;
  if (select t.name from public.account_title_mappings m join public.account_titles t on t.id = m.account_title_id
       where m.company_id = 'c5500000-0000-0000-0000-00000000000b' and m.category = 'meeting') <> '회의비' then raise exception 'FAIL [mapping applied]'; end if;
  if (select count(*) from public.account_title_changes where company_id = 'c5500000-0000-0000-0000-00000000000b' and office_name = '기본세무' and actor_name = '기대표') < 3 then raise exception 'FAIL [history]'; end if;
  if exists (select 1 from public.account_titles where company_id = 'c5500000-0000-0000-0000-00000000000c' and name = '회의비') then raise exception 'FAIL [C untouched]'; end if;
  if (select custom_titles from public.company_tax_offices where company_id = 'c5500000-0000-0000-0000-00000000000b') then raise exception 'FAIL [apply is not custom]'; end if;
end;
$$;

-- 사무소가 B만 직접 고치면 B는 개별 설정 → 기본값을 다시 저장해도 B는 그대로
select public._t_as55('a5500000-0000-0000-0000-000000000004');
set local role authenticated;
update public.account_titles set code = 'B999' where company_id = 'c5500000-0000-0000-0000-00000000000b' and name = '복리후생비';
reset role;
do $$ begin if not (select custom_titles from public.company_tax_offices where company_id = 'c5500000-0000-0000-0000-00000000000b') then raise exception 'FAIL [direct edit → custom]'; end if; end; $$;
update public.account_titles set code = '8112' where company_id = 'c5500000-0000-0000-0000-00000000000a' and name = '복리후생비';
select public._t_as55('a5500000-0000-0000-0000-000000000004');
set local role authenticated;
do $$
declare r jsonb;
begin
  r := public.save_tax_office_default_titles('c5500000-0000-0000-0000-00000000000a');
  if (r->>'companies')::int <> 0 then raise exception 'FAIL [custom skipped] %', r; end if;
  if jsonb_array_length(public.tax_office_default_titles()->'custom_company_ids') <> 1 then raise exception 'FAIL [custom listed]'; end if;
end;
$$;
reset role;
do $$ begin if (select code from public.account_titles where company_id = 'c5500000-0000-0000-0000-00000000000b' and name = '복리후생비') <> 'B999' then raise exception 'FAIL [custom kept]'; end if; end; $$;

-- [기본값으로 되돌리기]
select public._t_as55('a5500000-0000-0000-0000-000000000004');
set local role authenticated;
do $$
declare r jsonb;
begin
  r := public.apply_tax_office_default_titles(array['c5500000-0000-0000-0000-00000000000b', 'c5500000-0000-0000-0000-00000000000c']::uuid[]);
  if (r->>'companies')::int <> 1 then raise exception 'FAIL [unlinked skipped] %', r; end if;
  r := public.apply_tax_office_default_titles(array['c5500000-0000-0000-0000-00000000000b']::uuid[]);
  if (r->>'changes')::int <> 0 then raise exception 'FAIL [idempotent] %', r; end if;
end;
$$;
reset role;
do $$
begin
  if (select code from public.account_titles where company_id = 'c5500000-0000-0000-0000-00000000000b' and name = '복리후생비') <> '8112' then raise exception 'FAIL [reverted to default]'; end if;
  if (select custom_titles from public.company_tax_offices where company_id = 'c5500000-0000-0000-0000-00000000000b') then raise exception 'FAIL [custom cleared]'; end if;
end;
$$;

-- 새로 연결되는 회사(C)는 연결되는 순간 기본값 + 요약 이력 1줄
select public._t_as55('a5500000-0000-0000-0000-000000000003');
set local role authenticated;
select public.set_company_tax_office('기본세무', 'office55@test.local', null, null, null);
reset role;
do $$
begin
  if (select code from public.account_titles where company_id = 'c5500000-0000-0000-0000-00000000000c' and name = '복리후생비') <> '8112' then raise exception 'FAIL [new client gets default]'; end if;
  if not exists (select 1 from public.account_title_changes where company_id = 'c5500000-0000-0000-0000-00000000000c' and detail->>'summary' = '세무사무소 기본 계정과목 적용') then raise exception 'FAIL [summary history]'; end if;
end;
$$;

-- 회사 B 관리자는 이력을 본다
select public._t_as55('a5500000-0000-0000-0000-000000000002');
set local role authenticated;
do $$ begin if (select count(*) from public.account_title_changes) < 3 then raise exception 'FAIL [B sees history]'; end if; end; $$;
select public._t_raises55($q$select public.apply_tax_office_default_titles(array['c5500000-0000-0000-0000-00000000000b']::uuid[])$q$, 'NOT_A_TAX_OFFICE_MEMBER', 'company admin apply');
reset role;

select 'tax_office_default_titles ok';
rollback;
