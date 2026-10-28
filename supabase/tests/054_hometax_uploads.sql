-- =============================================================================
-- 054_hometax_uploads.sql — 홈택스 자료: 회사 관리자만 올리고 지움, 세무사무소는 읽기만, 회사 격리 (D-158, migration 085)
-- =============================================================================
begin;

update private.app_settings set value = 'off' where key = 'business_verify_mode'; -- 가짜 번호로 사무소 등록(검증은 003, D-155)

create function public._t_raises54(p_sql text, p_code text, p_label text)
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
grant execute on function public._t_raises54(text, text, text) to authenticated;
create function public._t_as54(p_uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
end;
$$;

insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at) values
  ('a5400000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sup54@test.local', now()),
  ('a5400000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'emp54@test.local', now()),
  ('a5400000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bsup54@test.local', now()),
  ('a5400000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'office54@test.local', now());
insert into public.companies (id, name, invite_code, business_number) values
  ('c5400000-0000-0000-0000-00000000000a', '홈택스A', 'HMTXAAAA', '1000000541'),
  ('c5400000-0000-0000-0000-00000000000b', '홈택스B', 'HMTXBBBB', '1000000542');
insert into public.members (id, auth_user_id, company_id, name, phone, role, status, privacy_agreed_at) values
  ('a5410000-0000-0000-0000-000000000001', 'a5400000-0000-0000-0000-000000000001', 'c5400000-0000-0000-0000-00000000000a', '가대표', '01095401001', 'super_admin', 'approved', now()),
  ('a5410000-0000-0000-0000-000000000002', 'a5400000-0000-0000-0000-000000000002', 'c5400000-0000-0000-0000-00000000000a', '나직원', '01095401002', 'employee', 'approved', now()),
  ('a5410000-0000-0000-0000-000000000003', 'a5400000-0000-0000-0000-000000000003', 'c5400000-0000-0000-0000-00000000000b', 'B대표', '01095401003', 'super_admin', 'approved', now());

select public._t_as54('a5400000-0000-0000-0000-000000000002');
set local role authenticated;
select public._t_raises54($q$select public.add_hometax_upload('2026-09', 'tax_invoice', 'c5400000-0000-0000-0000-00000000000a/x.xlsx', 'x.xlsx', 10, '[]', '[]', 0, null)$q$, '42501', 'employee add');
reset role;

select public._t_as54('a5400000-0000-0000-0000-000000000001');
set local role authenticated;
select public._t_raises54($q$select public.add_hometax_upload('2026-09', 'tax_invoice', 'c5400000-0000-0000-0000-00000000000b/x.xlsx', 'x.xlsx', 10, '[]', '[]', 0, null)$q$, 'INVALID_HOMETAX', 'other company folder');
select public._t_raises54($q$select public.add_hometax_upload('2026-09', 'weird', 'c5400000-0000-0000-0000-00000000000a/x.xlsx', 'x.xlsx', 10, '[]', '[]', 0, null)$q$, 'INVALID_HOMETAX', 'bad kind');
select public._t_raises54($q$select public.add_hometax_upload('2026-13', 'tax_invoice', 'c5400000-0000-0000-0000-00000000000a/x.xlsx', 'x.xlsx', 10, '[]', '[]', 0, null)$q$, 'INVALID_MONTH', 'bad month');
do $$
declare v_id uuid;
begin
  v_id := public.add_hometax_upload('2026-09', 'tax_invoice', 'c5400000-0000-0000-0000-00000000000a/a1.xlsx', '9월 세금계산서.xlsx', 2048,
    '["작성일자","공급자사업자등록번호","상호","공급가액","세액","합계금액"]', '[["2026-09-01","1234567890","철물점","10000","1000","11000"]]', 1, ' 매입 전자세금계산서 ');
  perform public.add_hometax_upload('2026-09', 'cash_receipt', 'c5400000-0000-0000-0000-00000000000a/a2.csv', '9월 현금영수증.csv', 512, '[]', '[]', 3, null);
  if (select count(*) from public.hometax_uploads) <> 2 then raise exception 'FAIL [two uploads]'; end if;
  if (select memo from public.hometax_uploads where id = v_id) <> '매입 전자세금계산서' then raise exception 'FAIL [memo trimmed]'; end if;
  if (select uploaded_by_name from public.hometax_uploads where id = v_id) <> '가대표' then raise exception 'FAIL [uploader]'; end if;
end;
$$;
select public._t_raises54($q$insert into public.hometax_uploads (company_id, month, kind, file_path, file_name, file_size) values ('c5400000-0000-0000-0000-00000000000a', '2026-09', 'other', 'c5400000-0000-0000-0000-00000000000a/z', 'z', 1)$q$, '42501', 'no direct insert');
select public.set_company_tax_office('X세무', 'office54@test.local', null, null, null);
select public.log_tax_export('c5400000-0000-0000-0000-00000000000a', '2026-09', 'hometax', 1, '9월 세금계산서.xlsx', false);
reset role;

-- 다른 회사: 못 보고 못 지움
select public._t_as54('a5400000-0000-0000-0000-000000000003');
set local role authenticated;
do $$ begin if (select count(*) from public.hometax_uploads) <> 0 then raise exception 'FAIL [isolation]'; end if; end; $$;
select public._t_raises54(format('select public.delete_hometax_upload(%L)', (select id from public.hometax_uploads limit 1)), 'NOT_FOUND', 'other delete null');
reset role;
do $$ begin perform set_config('t.up', (select id::text from public.hometax_uploads where kind = 'cash_receipt'), true); end; $$;
select public._t_as54('a5400000-0000-0000-0000-000000000003');
set local role authenticated;
select public._t_raises54($q$select public.delete_hometax_upload(current_setting('t.up')::uuid)$q$, 'NOT_FOUND', 'other company delete');
reset role;

-- 세무사무소: 등록 뒤 읽기만, 받기 기록 가능
select public._t_as54('a5400000-0000-0000-0000-000000000004');
set local role authenticated;
select public.register_tax_office('X세무사무소', '2000000541', 'X대표', null, true, true);
do $$ begin if (select count(*) from public.hometax_uploads) <> 2 then raise exception 'FAIL [office reads]'; end if; end; $$;
select public._t_raises54($q$select public.delete_hometax_upload(current_setting('t.up')::uuid)$q$, 'NOT_A_MEMBER', 'office cannot delete');
select public.log_tax_export('c5400000-0000-0000-0000-00000000000a', '2026-09', 'hometax', 3, '9월 현금영수증.csv', false);
reset role;

-- 회사 관리자 지우기 → 경로 반환
select public._t_as54('a5400000-0000-0000-0000-000000000001');
set local role authenticated;
do $$
declare v_path text;
begin
  v_path := public.delete_hometax_upload(current_setting('t.up')::uuid);
  if v_path <> 'c5400000-0000-0000-0000-00000000000a/a2.csv' then raise exception 'FAIL [path] %', v_path; end if;
  if (select count(*) from public.tax_export_downloads where kind = 'hometax') <> 2 then raise exception 'FAIL [hometax logs]'; end if;
end;
$$;
reset role;

select 'hometax_uploads ok';
rollback;
