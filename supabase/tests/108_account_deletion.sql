-- =============================================================================
-- 108_account_deletion.sql — 계정 삭제(D-314, 174)
-- 회사 A(최고 관리자 sup, 직원 emp, 결재라인 직원 ln), 회사 B(혼자인 최고 관리자 solo)
-- 확인: 직원 정리(기록 남김·개인정보 지움·로그인 연결 끊김) · 최고 관리자 막힘(넘기기/해지 안내) · 결재라인 막힘
--       · 다시 불러도 같음 · 지운 계정 다시 활성화 불가 · auth 사용자 삭제 가능 · 다른 회사 영향 없음
-- =============================================================================
begin;

insert into auth.users (id, instance_id, aud, role, email)
select u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u::text || '@test.local'
from unnest(array[
  'ad000000-0000-0000-0000-000000000001', 'ad000000-0000-0000-0000-000000000002', 'ad000000-0000-0000-0000-000000000003',
  'bd000000-0000-0000-0000-000000000001'
]::uuid[]) u;
insert into public.companies (id, name, invite_code, business_number) values
  ('cad00000-0000-0000-0000-000000000000', '삭제회사A', 'DELAAAAA', '1000000021'),
  ('cbd00000-0000-0000-0000-000000000000', '삭제회사B', 'DELBBBBB', '1000000022');
insert into public.members (id, auth_user_id, company_id, name, phone, email, vehicle_number, role, status, privacy_agreed_at) values
  ('ad900000-0000-0000-0000-000000000001', 'ad000000-0000-0000-0000-000000000001', 'cad00000-0000-0000-0000-000000000000', 'A대표', '01030001000', null, null, 'super_admin', 'approved', now()),
  ('ad900000-0000-0000-0000-000000000002', 'ad000000-0000-0000-0000-000000000002', 'cad00000-0000-0000-0000-000000000000', 'A직원', '01030001001', 'e@x.kr', '12가3456', 'employee', 'approved', now()),
  ('ad900000-0000-0000-0000-000000000003', 'ad000000-0000-0000-0000-000000000003', 'cad00000-0000-0000-0000-000000000000', 'A결재', '01030001002', null, null, 'admin', 'approved', now()),
  ('bd900000-0000-0000-0000-000000000001', 'bd000000-0000-0000-0000-000000000001', 'cbd00000-0000-0000-0000-000000000000', 'B혼자', '01040001000', null, null, 'super_admin', 'approved', now());
insert into public.member_bank_accounts (member_id, company_id, bank_name, account_number, account_holder)
values ('ad900000-0000-0000-0000-000000000002', 'cad00000-0000-0000-0000-000000000000', '은행', '123', 'A직원');
insert into public.approval_lines (id, company_id, name, department_id) values ('ad800000-0000-0000-0000-000000000001', 'cad00000-0000-0000-0000-000000000000', '기본', null);
insert into public.approval_line_steps (company_id, approval_line_id, step_order, approver_member_id)
values ('cad00000-0000-0000-0000-000000000000', 'ad800000-0000-0000-0000-000000000001', 1, 'ad900000-0000-0000-0000-000000000003');

-- 직원: 확인 → 정리
select set_config('request.jwt.claims', '{"sub":"ad000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
do $$
declare c jsonb := public.account_deletion_check();
begin
  if c->>'blocked' is not null or c->>'company' <> '삭제회사A' then raise exception 'FAIL [EMP] check %', c; end if;
  perform public.prepare_account_deletion();
  perform public.prepare_account_deletion(); -- 다시 불러도 오류 없음(이미 연결 끊김)
end $$;
reset role;
do $$
declare m public.members;
begin
  select * into m from public.members where id = 'ad900000-0000-0000-0000-000000000002';
  if m.status <> 'inactive' or m.auth_user_id is not null or m.account_deleted_at is null then raise exception 'FAIL [EMP] not unlinked %', m; end if;
  if m.name <> 'A직원' then raise exception 'FAIL [EMP] name should stay for company records'; end if;
  if m.phone <> '' or m.email is not null or m.vehicle_number is not null then raise exception 'FAIL [EMP] personal info left'; end if;
  if exists (select 1 from public.member_bank_accounts where member_id = m.id) then raise exception 'FAIL [EMP] bank left'; end if;
  delete from auth.users where id = 'ad000000-0000-0000-0000-000000000002'; -- 서버가 하는 auth 삭제가 막히지 않음
end $$;

-- 결재라인에 든 관리자: 막힘
select set_config('request.jwt.claims', '{"sub":"ad000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
do $$
declare v_ok boolean;
begin
  if public.account_deletion_check()->>'blocked' <> 'SELF_IN_APPROVAL_LINE' then raise exception 'FAIL [LINE] check'; end if;
  begin perform public.prepare_account_deletion(); v_ok := false;
  exception when others then v_ok := sqlerrm = 'SELF_IN_APPROVAL_LINE'; end;
  if not v_ok then raise exception 'FAIL [LINE] not blocked'; end if;
end $$;
reset role;

-- 최고 관리자(다른 직원 있음): 넘기기 안내 / 혼자: 회사 해지 안내
select set_config('request.jwt.claims', '{"sub":"ad000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
do $$
declare v_ok boolean;
begin
  if public.account_deletion_check()->>'blocked' <> 'SUPER_ADMIN_MUST_TRANSFER' then raise exception 'FAIL [SUP] check'; end if;
  begin perform public.prepare_account_deletion(); v_ok := false;
  exception when others then v_ok := sqlerrm = 'SUPER_ADMIN_MUST_TRANSFER'; end;
  if not v_ok then raise exception 'FAIL [SUP] not blocked'; end if;
  -- 지운 계정은 다시 활성화 불가
  begin perform public.reactivate_member('ad900000-0000-0000-0000-000000000002'); v_ok := false;
  exception when others then v_ok := sqlerrm = 'ACCOUNT_DELETED'; end;
  if not v_ok then raise exception 'FAIL [SUP] reactivated deleted account'; end if;
end $$;
reset role;
select set_config('request.jwt.claims', '{"sub":"bd000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  if public.account_deletion_check()->>'blocked' <> 'SOLE_ADMIN_CLOSE_COMPANY' then raise exception 'FAIL [SOLO] check'; end if;
end $$;
reset role;

-- 회사도 소속도 없는 계정: 바로 정리 가능
insert into auth.users (id, instance_id, aud, role, email) values ('ed000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'none@test.local');
select set_config('request.jwt.claims', '{"sub":"ed000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
do $$
declare c jsonb := public.account_deletion_check();
begin
  if c->>'blocked' is not null or c->>'company' is not null then raise exception 'FAIL [NONE] %', c; end if;
  perform public.prepare_account_deletion();
end $$;
reset role;

-- 다른 회사·다른 직원 영향 없음
do $$
begin
  if (select count(*) from public.members where account_deleted_at is not null and company_id in ('cad00000-0000-0000-0000-000000000000', 'cbd00000-0000-0000-0000-000000000000')) <> 1 then raise exception 'FAIL [ISO] other members touched'; end if;
  if (select auth_user_id from public.members where id = 'bd900000-0000-0000-0000-000000000001') is null then raise exception 'FAIL [ISO] B touched'; end if;
end $$;

rollback;
