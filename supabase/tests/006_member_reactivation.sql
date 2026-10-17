-- =============================================================================
-- 006_member_reactivation.sql — 비활성 멤버 다시 활성화 권한·격리 테스트 (D-062)
-- 회사 A(대표 a_sup, 관리자 a_adm, 비활성 직원 a_off, 비활성 관리자 a_offadm, 활성 직원 a_emp), 회사 B(대표 b_sup)
-- =============================================================================
begin;

create function public._t_expect(p_sql text, p_code text, p_label text)
returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlerrm = p_code then return; end if;
    raise exception 'FAIL [%] expected % but got %', p_label, p_code, sqlerrm;
  end;
  raise exception 'FAIL [%] expected % but succeeded', p_label, p_code;
end;
$$;
grant execute on function public._t_expect(text, text, text) to authenticated;

insert into auth.users (id, instance_id, aud, role, email)
select u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u::text || '@test.local'
from unnest(array[
  'af000000-0000-0000-0000-000000000001', 'af000000-0000-0000-0000-000000000002', 'af000000-0000-0000-0000-000000000003',
  'af000000-0000-0000-0000-000000000004', 'af000000-0000-0000-0000-000000000005', 'bf000000-0000-0000-0000-000000000001'
]::uuid[]) u;
insert into public.companies (id, name, invite_code, business_number) values
  ('ce000000-0000-0000-0000-000000000000', '복귀회사A', 'REACTAAA', '1000000031'),
  ('cf000000-0000-0000-0000-000000000000', '복귀회사B', 'REACTBBB', '1000000032');
insert into public.members (id, auth_user_id, company_id, name, phone, role, status, privacy_agreed_at) values
  ('ad000000-0000-0000-0000-000000000001', 'af000000-0000-0000-0000-000000000001', 'ce000000-0000-0000-0000-000000000000', 'A대표', '01050001000', 'super_admin', 'approved', now()),
  ('ad000000-0000-0000-0000-000000000002', 'af000000-0000-0000-0000-000000000002', 'ce000000-0000-0000-0000-000000000000', 'A관리', '01050001001', 'admin', 'approved', now()),
  ('ad000000-0000-0000-0000-000000000003', 'af000000-0000-0000-0000-000000000003', 'ce000000-0000-0000-0000-000000000000', 'A퇴사직원', '01050001002', 'employee', 'inactive', now()),
  ('ad000000-0000-0000-0000-000000000004', 'af000000-0000-0000-0000-000000000004', 'ce000000-0000-0000-0000-000000000000', 'A퇴사관리', '01050001003', 'admin', 'inactive', now()),
  ('ad000000-0000-0000-0000-000000000005', 'af000000-0000-0000-0000-000000000005', 'ce000000-0000-0000-0000-000000000000', 'A직원', '01050001004', 'employee', 'approved', now()),
  ('bd000000-0000-0000-0000-000000000001', 'bf000000-0000-0000-0000-000000000001', 'cf000000-0000-0000-0000-000000000000', 'B대표', '01060001000', 'super_admin', 'approved', now());

-- B 대표: A의 비활성 멤버를 되살릴 수 없다
select set_config('request.jwt.claims', '{"sub":"bf000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select public._t_expect($q$select public.reactivate_member('ad000000-0000-0000-0000-000000000003')$q$, 'NOT_FOUND', 'B_SUP reactivate A');
reset role;

-- A 직원: 불가
select set_config('request.jwt.claims', '{"sub":"af000000-0000-0000-0000-000000000005","role":"authenticated"}', true);
set local role authenticated;
select public._t_expect($q$select public.reactivate_member('ad000000-0000-0000-0000-000000000003')$q$, 'NOT_ALLOWED', 'A_EMP reactivate');
reset role;

-- 비활성 본인: 스스로 되살릴 수 없다
select set_config('request.jwt.claims', '{"sub":"af000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select public._t_expect($q$select public.reactivate_member('ad000000-0000-0000-0000-000000000003')$q$, 'NOT_A_MEMBER', 'A_OFF self');
reset role;

-- A 관리자: 일반 멤버만, 관리자는 불가, 활성 멤버는 NOT_INACTIVE
select set_config('request.jwt.claims', '{"sub":"af000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select public._t_expect($q$select public.reactivate_member('ad000000-0000-0000-0000-000000000004')$q$, 'NOT_ALLOWED', 'A_ADM reactivate admin');
select public._t_expect($q$select public.reactivate_member('ad000000-0000-0000-0000-000000000005')$q$, 'NOT_INACTIVE', 'A_ADM reactivate active');
select public.reactivate_member('ad000000-0000-0000-0000-000000000003');
reset role;

-- A 대표: 관리자도 되살릴 수 있다(역할 유지)
select set_config('request.jwt.claims', '{"sub":"af000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select public.reactivate_member('ad000000-0000-0000-0000-000000000004');
reset role;

-- 되살아난 직원은 다시 회사 데이터를 볼 수 있다
select set_config('request.jwt.claims', '{"sub":"af000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  if (select count(*) from public.members) <> 5 then raise exception 'FAIL [A_OFF] reactivated member cannot see company members'; end if;
end $$;
reset role;

do $$
begin
  if (select status from public.members where id = 'ad000000-0000-0000-0000-000000000003') <> 'approved'
     or (select row(status, role)::text from public.members where id = 'ad000000-0000-0000-0000-000000000004')
        <> row('approved'::public.member_status, 'admin'::public.member_role)::text then
    raise exception 'FAIL [FINAL] reactivation not stored';
  end if;
end $$;

select 'MEMBER_REACTIVATION_OK' as result;
rollback;
