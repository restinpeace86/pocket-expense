-- =============================================================================
-- 030_member_invitations_admin.sql — 개별 초대 관리: 관리자 만들기·보기·취소, 직원·다른 회사 불가, 취소하면 링크 무효 (T3-6, D-042)
-- =============================================================================
begin;

insert into auth.users (id, instance_id, aud, role, email)
select u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u::text || '@test.local'
from unnest(array['a3000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000002', 'b3000000-0000-0000-0000-000000000001']::uuid[]) u;
insert into public.companies (id, name, invite_code, business_number) values
  ('c3000000-0000-0000-0000-00000000000a', '초대A', 'NVTEAAAA', '1000000301'),
  ('c3000000-0000-0000-0000-00000000000b', '초대B', 'NVTEBBBB', '1000000302');
insert into public.departments (id, company_id, name) values
  ('a3050000-0000-0000-0000-000000000001', 'c3000000-0000-0000-0000-00000000000a', '영업팀'),
  ('b3050000-0000-0000-0000-000000000001', 'c3000000-0000-0000-0000-00000000000b', 'B팀');
insert into public.members (id, auth_user_id, company_id, name, phone, role, status, privacy_agreed_at) values
  ('a3010000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000001', 'c3000000-0000-0000-0000-00000000000a', 'A관리', '01093001001', 'admin', 'approved', now()),
  ('a3010000-0000-0000-0000-000000000002', 'a3000000-0000-0000-0000-000000000002', 'c3000000-0000-0000-0000-00000000000a', 'A직원', '01093001002', 'employee', 'approved', now()),
  ('b3010000-0000-0000-0000-000000000001', 'b3000000-0000-0000-0000-000000000001', 'c3000000-0000-0000-0000-00000000000b', 'B대표', '01093002001', 'super_admin', 'approved', now());

-- A 관리자: 초대 만들기(자기 회사 부서만), 보기, 취소
select set_config('request.jwt.claims', '{"sub":"a3000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
do $$
declare v_token text; n int;
begin
  insert into public.member_invitations (company_id, name, phone, department_id, position, invited_by_member_id)
  values ('c3000000-0000-0000-0000-00000000000a', '최신입', '01033334444', 'a3050000-0000-0000-0000-000000000001', '사원', 'a3010000-0000-0000-0000-000000000001')
  returning token into v_token;
  perform set_config('t.token', v_token, true);
  if (select count(*) from public.member_invitations) <> 1 then raise exception 'FAIL [A_ADM] list'; end if;
  begin
    insert into public.member_invitations (company_id, name, phone, department_id, invited_by_member_id)
    values ('c3000000-0000-0000-0000-00000000000a', '남부서', '01011112222', 'b3050000-0000-0000-0000-000000000001', 'a3010000-0000-0000-0000-000000000001');
    raise exception 'FAIL [A_ADM] other company department';
  exception when foreign_key_violation then null;
  end;
  begin
    insert into public.member_invitations (company_id, name, phone, invited_by_member_id) values ('c3000000-0000-0000-0000-00000000000b', 'B에 끼우기', '01011112222', 'a3010000-0000-0000-0000-000000000001');
    raise exception 'FAIL [A_ADM] insert into B';
  exception when insufficient_privilege or foreign_key_violation then null;
  end;
end;
$$;
reset role;
do $$ begin if public.get_invitation_public(current_setting('t.token')) is null then raise exception 'FAIL link should work'; end if; end; $$;

-- 직원: 못 보고 못 만든다
select set_config('request.jwt.claims', '{"sub":"a3000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  if exists (select 1 from public.member_invitations) then raise exception 'FAIL [A_E] sees invitations'; end if;
  begin
    insert into public.member_invitations (company_id, name, phone, invited_by_member_id) values ('c3000000-0000-0000-0000-00000000000a', '몰래', '01055556666', 'a3010000-0000-0000-0000-000000000002');
    raise exception 'FAIL [A_E] insert';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;

-- B 대표: A 초대가 안 보이고 취소도 안 된다
select set_config('request.jwt.claims', '{"sub":"b3000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
do $$
declare n int;
begin
  if exists (select 1 from public.member_invitations) then raise exception 'FAIL [B] sees A'; end if;
  update public.member_invitations set status = 'canceled' where token = current_setting('t.token');
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL [B] canceled A invite'; end if;
end;
$$;
reset role;

-- A 관리자가 취소하면 링크 무효
select set_config('request.jwt.claims', '{"sub":"a3000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
update public.member_invitations set status = 'canceled' where token = current_setting('t.token');
reset role;
do $$ begin if public.get_invitation_public(current_setting('t.token')) is not null then raise exception 'FAIL canceled link still works'; end if; end; $$;

select 'MEMBER_INVITATIONS_ADMIN_OK' as result;
rollback;
