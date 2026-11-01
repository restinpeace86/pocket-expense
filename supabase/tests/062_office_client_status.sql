-- =============================================================================
-- 062_office_client_status.sql — 세무사무소 고객사 현황 달별 마감 상태 (D-193, migration 101)
-- 관리자는 모든 고객사, 배정된 세무사는 맡은 곳만, 회사 사람은 못 봄. 마감 여부·자료 요청(답변 대기·답변 옴) 수
-- =============================================================================
begin;

update private.app_settings set value = 'off' where key = 'business_verify_mode';

create function public._t_raises62(p_sql text, p_code text, p_label text)
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
grant execute on function public._t_raises62(text, text, text) to authenticated;
create function public._t_as62(p_uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
end;
$$;

insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at) values
  ('a6200000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sa62@test.local', now()),
  ('a6200000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sb62@test.local', now()),
  ('a6200000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'office62@test.local', now()),
  ('a6200000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'staff62@test.local', now());
insert into public.companies (id, name, invite_code, business_number) values
  ('c6200000-0000-0000-0000-00000000000a', '현황A', 'STSAAAAA', '1000000621'),
  ('c6200000-0000-0000-0000-00000000000b', '현황B', 'STSBBBBB', '1000000622');
insert into public.members (id, auth_user_id, company_id, name, phone, role, status, privacy_agreed_at) values
  ('a6210000-0000-0000-0000-000000000001', 'a6200000-0000-0000-0000-000000000001', 'c6200000-0000-0000-0000-00000000000a', 'A대표', '01096201001', 'super_admin', 'approved', now()),
  ('a6210000-0000-0000-0000-000000000002', 'a6200000-0000-0000-0000-000000000002', 'c6200000-0000-0000-0000-00000000000b', 'B대표', '01096201002', 'super_admin', 'approved', now());

select public._t_as62('a6200000-0000-0000-0000-000000000004');
set local role authenticated;
select public.register_tax_office('현황세무', '2000000621', '현대표', null, true, true);
reset role;
select public._t_as62('a6200000-0000-0000-0000-000000000001');
set local role authenticated;
select public.set_company_tax_office('현황세무', 'office62@test.local', null, null, null);
reset role;
select public._t_as62('a6200000-0000-0000-0000-000000000002');
set local role authenticated;
select public.set_company_tax_office('현황세무', 'office62@test.local', null, null, null);
reset role;
do $$
begin
  perform set_config('t.code', (select invite_code from public.tax_offices where contact_email = 'office62@test.local'), true);
end;
$$;
select public._t_as62('a6200000-0000-0000-0000-000000000005');
set local role authenticated;
do $$ begin perform public.join_tax_office(current_setting('t.code'), '현세무', null, true, true); end; $$;
reset role;
do $$
begin
  perform set_config('t.staff', (select m.id::text from public.tax_office_members m where m.auth_user_id = 'a6200000-0000-0000-0000-000000000005'), true);
end;
$$;
select public._t_as62('a6200000-0000-0000-0000-000000000004');
set local role authenticated;
do $$ begin perform public.assign_tax_office_agent('c6200000-0000-0000-0000-00000000000a', current_setting('t.staff')::uuid); end; $$;
reset role;

-- A는 10월 마감, B는 안 함. B에 요청 2건(답변 대기 1, 답변 옴 1) + 처리됨 1
insert into public.monthly_closings (company_id, year_month, status, closed_at) values ('c6200000-0000-0000-0000-00000000000a', '2026-10', 'closed', '2026-11-04 01:00+00');
insert into public.tax_office_requests (company_id, month, body, status) values
  ('c6200000-0000-0000-0000-00000000000b', '2026-10', '세금계산서 없음', 'open'),
  ('c6200000-0000-0000-0000-00000000000b', '2026-09', '영수증 흐림', 'answered'),
  ('c6200000-0000-0000-0000-00000000000b', '2026-09', '확인', 'resolved');

select public._t_as62('a6200000-0000-0000-0000-000000000004');
set local role authenticated;
do $$
declare j jsonb := public.tax_office_client_status('2026-10');
begin
  if jsonb_array_length(j) <> 2 then raise exception 'FAIL [admin sees 2] %', j; end if;
  if not exists (select 1 from jsonb_array_elements(j) e where e->>'company_id' = 'c6200000-0000-0000-0000-00000000000a' and (e->>'closed')::boolean and e->>'closed_at' is not null) then raise exception 'FAIL [A closed] %', j; end if;
  if not exists (select 1 from jsonb_array_elements(j) e where e->>'company_id' = 'c6200000-0000-0000-0000-00000000000b' and not (e->>'closed')::boolean
                   and (e->>'requests_open')::int = 1 and (e->>'requests_answered')::int = 1) then raise exception 'FAIL [B open/answered] %', j; end if;
  if exists (select 1 from jsonb_array_elements(public.tax_office_client_status('2026-09')) e where (e->>'closed')::boolean) then raise exception 'FAIL [sep none closed]'; end if;
end;
$$;
select public._t_raises62($q$select public.tax_office_client_status('2026-13')$q$, 'INVALID_MONTH', 'bad month');
reset role;

select public._t_as62('a6200000-0000-0000-0000-000000000005');
set local role authenticated;
do $$
declare j jsonb := public.tax_office_client_status('2026-10');
begin
  if jsonb_array_length(j) <> 1 or j->0->>'company_id' <> 'c6200000-0000-0000-0000-00000000000a' then raise exception 'FAIL [staff only A] %', j; end if;
end;
$$;
reset role;

select public._t_as62('a6200000-0000-0000-0000-000000000001');
set local role authenticated;
do $$
begin
  if jsonb_array_length(public.tax_office_client_status('2026-10')) <> 0 then raise exception 'FAIL [company admin sees none]'; end if;
end;
$$;
reset role;

rollback;
