-- =============================================================================
-- 051_tax_export_downloads.sql — 세무 자료 내려받기 기록: 권한 있는 사람만 남기고, 회사 관리자만 본다 (D-153, migration 081)
-- =============================================================================
begin;

create function public._t_raises51(p_sql text, p_code text, p_label text)
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
grant execute on function public._t_raises51(text, text, text) to authenticated;
create function public._t_as51(p_uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
end;
$$;

insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at) values
  ('a5100000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sup51@test.local', now()),
  ('a5100000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'emp51@test.local', now()),
  ('a5100000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bsup51@test.local', now()),
  ('a5100000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'office51@test.local', now());
insert into public.companies (id, name, invite_code, business_number) values
  ('c5100000-0000-0000-0000-00000000000a', '기록A', 'DWNLAAAA', '1000000511'),
  ('c5100000-0000-0000-0000-00000000000b', '기록B', 'DWNLBBBB', '1000000512');
insert into public.members (id, auth_user_id, company_id, name, phone, role, status, privacy_agreed_at) values
  ('a5110000-0000-0000-0000-000000000001', 'a5100000-0000-0000-0000-000000000001', 'c5100000-0000-0000-0000-00000000000a', '가대표', '01095101001', 'super_admin', 'approved', now()),
  ('a5110000-0000-0000-0000-000000000002', 'a5100000-0000-0000-0000-000000000002', 'c5100000-0000-0000-0000-00000000000a', '나직원', '01095101002', 'employee', 'approved', now()),
  ('a5110000-0000-0000-0000-000000000003', 'a5100000-0000-0000-0000-000000000003', 'c5100000-0000-0000-0000-00000000000b', 'B대표', '01095101003', 'super_admin', 'approved', now());

-- 회사 A가 사무소 X 지정, 사무소 등록
select public._t_as51('a5100000-0000-0000-0000-000000000001');
set local role authenticated;
select public.set_company_tax_office('X세무', 'office51@test.local', null, null, null);
select public.log_tax_export('c5100000-0000-0000-0000-00000000000a', '2026-09', 'package', 12, null, true);
select public._t_raises51($q$select public.log_tax_export('c5100000-0000-0000-0000-00000000000b', '2026-09', 'package', 1, null, true)$q$, 'NOT_FOUND', 'other company');
select public._t_raises51($q$select public.log_tax_export('c5100000-0000-0000-0000-00000000000a', '2026-09', 'office_zip', 1, null, true)$q$, 'NOT_FOUND', 'company cannot log office kind');
select public._t_raises51($q$insert into public.tax_export_downloads (company_id, actor_kind, month, kind) values ('c5100000-0000-0000-0000-00000000000a', 'company', '2026-09', 'package')$q$, '42501', 'no direct insert');
reset role;
select public._t_as51('a5100000-0000-0000-0000-000000000004');
set local role authenticated;
select public.register_tax_office('X세무사무소', '2000000511', 'X대표', null, true, true);
select public.log_tax_export('c5100000-0000-0000-0000-00000000000a', '2026-09', 'office_zip', 12, null, false);
select public.log_tax_export('c5100000-0000-0000-0000-00000000000a', '2026-09', 'template', 3, '위하고 카드', false);
select public._t_raises51($q$select public.log_tax_export('c5100000-0000-0000-0000-00000000000b', '2026-09', 'office_xlsx', 1, null, false)$q$, 'NOT_FOUND', 'office non-client');
do $$ begin if (select count(*) from public.tax_export_downloads) <> 0 then raise exception 'FAIL [office cannot read]'; end if; end; $$;
reset role;

-- 직원은 남길 수 없고 못 봄
select public._t_as51('a5100000-0000-0000-0000-000000000002');
set local role authenticated;
select public._t_raises51($q$select public.log_tax_export('c5100000-0000-0000-0000-00000000000a', '2026-09', 'preview', 1, null, false)$q$, 'NOT_FOUND', 'employee');
do $$ begin if (select count(*) from public.tax_export_downloads) <> 0 then raise exception 'FAIL [employee read]'; end if; end; $$;
reset role;

-- 회사 A 관리자: 3건(회사 패키지 + 사무소 ZIP + 사무소 결산 양식), 회사 B는 0건
select public._t_as51('a5100000-0000-0000-0000-000000000001');
set local role authenticated;
do $$
begin
  if (select count(*) from public.tax_export_downloads) <> 3 then raise exception 'FAIL [A sees 3]'; end if;
  if (select actor_name || '/' || office_name from public.tax_export_downloads where kind = 'office_zip') <> 'X대표/X세무사무소' then raise exception 'FAIL [office actor]'; end if;
  if (select template_name from public.tax_export_downloads where kind = 'template') <> '위하고 카드' then raise exception 'FAIL [template name]'; end if;
end;
$$;
reset role;
select public._t_as51('a5100000-0000-0000-0000-000000000003');
set local role authenticated;
do $$ begin if (select count(*) from public.tax_export_downloads) <> 0 then raise exception 'FAIL [B isolation]'; end if; end; $$;
reset role;

select 'tax_export_downloads ok';
rollback;
