-- =============================================================================
-- 060_accounting_format_requests.sql — 회계 양식 접수: 회사 관리자만 등록, 자기 회사 것만 보임, 회사 격리 (D-180, migration 098)
-- =============================================================================
begin;

create function public._t_raises60(p_sql text, p_code text, p_label text)
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
grant execute on function public._t_raises60(text, text, text) to authenticated;
create function public._t_as60(p_uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
end;
$$;

insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at) values
  ('a6000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sup60@test.local', now()),
  ('a6000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'emp60@test.local', now()),
  ('a6000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bsup60@test.local', now());
insert into public.companies (id, name, invite_code, business_number) values
  ('c6000000-0000-0000-0000-00000000000a', '양식A', 'FMTAAAAA', '1000000601'),
  ('c6000000-0000-0000-0000-00000000000b', '양식B', 'FMTBBBBB', '1000000602');
insert into public.members (id, auth_user_id, company_id, name, phone, role, status, privacy_agreed_at) values
  ('a6010000-0000-0000-0000-000000000001', 'a6000000-0000-0000-0000-000000000001', 'c6000000-0000-0000-0000-00000000000a', '가대표', '01096001001', 'super_admin', 'approved', now()),
  ('a6010000-0000-0000-0000-000000000002', 'a6000000-0000-0000-0000-000000000002', 'c6000000-0000-0000-0000-00000000000a', '나직원', '01096001002', 'employee', 'approved', now()),
  ('a6010000-0000-0000-0000-000000000003', 'a6000000-0000-0000-0000-000000000003', 'c6000000-0000-0000-0000-00000000000b', 'B대표', '01096001003', 'super_admin', 'approved', now());

-- 직원은 등록 못 함
select public._t_as60('a6000000-0000-0000-0000-000000000002');
set local role authenticated;
select public._t_raises60($q$select public.add_accounting_format_request('ecount', 'c6000000-0000-0000-0000-00000000000a/x.xlsx', 'x.xlsx', 10, null)$q$, '42501', 'employee add');
reset role;

-- 관리자: 다른 회사 폴더·모르는 프로그램 거절, 정상 등록
select public._t_as60('a6000000-0000-0000-0000-000000000001');
set local role authenticated;
select public._t_raises60($q$select public.add_accounting_format_request('ecount', 'c6000000-0000-0000-0000-00000000000b/x.xlsx', 'x.xlsx', 10, null)$q$, 'INVALID_FORMAT_REQUEST', 'other company folder');
select public._t_raises60($q$select public.add_accounting_format_request('weird', 'c6000000-0000-0000-0000-00000000000a/x.xlsx', 'x.xlsx', 10, null)$q$, 'INVALID_FORMAT_REQUEST', 'bad program');
select public._t_raises60($q$insert into public.accounting_format_requests (company_id, program, file_path, file_name, file_size) values ('c6000000-0000-0000-0000-00000000000a', 'ecount', 'c6000000-0000-0000-0000-00000000000a/y.xlsx', 'y.xlsx', 1)$q$, '42501', 'direct insert');
do $$
declare v_id uuid;
begin
  v_id := public.add_accounting_format_request('ecount', 'c6000000-0000-0000-0000-00000000000a/a1.xlsx', '이카운트 지출결의서.xlsx', 2048, ' 사비는 미지급금 ');
  if (select count(*) from public.accounting_format_requests) <> 1 then raise exception 'FAIL [own visible]'; end if;
  if (select memo from public.accounting_format_requests where id = v_id) <> '사비는 미지급금' then raise exception 'FAIL [memo trimmed]'; end if;
  if (select requested_by_name || status from public.accounting_format_requests where id = v_id) <> '가대표received' then raise exception 'FAIL [uploader/status]'; end if;
end;
$$;
select public._t_raises60($q$update public.accounting_format_requests set status = 'done'$q$, '42501', 'company cannot mark done');
reset role;

-- 다른 회사 관리자·직원에게는 안 보임
select public._t_as60('a6000000-0000-0000-0000-000000000003');
set local role authenticated;
do $$ begin if (select count(*) from public.accounting_format_requests) <> 0 then raise exception 'FAIL [isolation B]'; end if; end $$;
reset role;
select public._t_as60('a6000000-0000-0000-0000-000000000002');
set local role authenticated;
do $$ begin if (select count(*) from public.accounting_format_requests) <> 0 then raise exception 'FAIL [employee hidden]'; end if; end $$;
reset role;

-- 회사당 20개까지
select public._t_as60('a6000000-0000-0000-0000-000000000001');
set local role authenticated;
do $$ begin for i in 2..20 loop perform public.add_accounting_format_request('sesarang', 'c6000000-0000-0000-0000-00000000000a/f' || i || '.xls', 'f.xls', 10, null); end loop; end $$;
select public._t_raises60($q$select public.add_accounting_format_request('sesarang', 'c6000000-0000-0000-0000-00000000000a/f21.xls', 'f.xls', 10, null)$q$, 'FORMAT_REQUEST_LIMIT', 'limit 20');
reset role;

select 'accounting_format_requests ok';
rollback;
