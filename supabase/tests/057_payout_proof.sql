-- =============================================================================
-- 057_payout_proof.sql — 송금 확인증: 관리자만, 자기 회사·지급 완료 결의서만, 자기 회사 폴더만 (D-164, migration 089)
-- =============================================================================
begin;

create function public._t_raises57(p_sql text, p_code text, p_label text)
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
grant execute on function public._t_raises57(text, text, text) to authenticated;

insert into auth.users (id, instance_id, aud, role, email)
select u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u::text || '@test.local'
from unnest(array['a5700000-0000-0000-0000-000000000001', 'a5700000-0000-0000-0000-000000000002', 'a5700000-0000-0000-0000-000000000003']::uuid[]) u;
insert into public.companies (id, name, invite_code, business_number) values
  ('c5700000-0000-0000-0000-00000000000a', '지급A', 'PAYAAAAA', '1000000571'),
  ('c5700000-0000-0000-0000-00000000000b', '지급B', 'PAYBBBBB', '1000000572');
insert into public.members (id, auth_user_id, company_id, name, phone, role, status, privacy_agreed_at) values
  ('a5710000-0000-0000-0000-000000000001', 'a5700000-0000-0000-0000-000000000001', 'c5700000-0000-0000-0000-00000000000a', 'A대표', '01095701001', 'super_admin', 'approved', now()),
  ('a5710000-0000-0000-0000-000000000002', 'a5700000-0000-0000-0000-000000000002', 'c5700000-0000-0000-0000-00000000000a', 'A직원', '01095701002', 'employee', 'approved', now()),
  ('a5710000-0000-0000-0000-000000000003', 'a5700000-0000-0000-0000-000000000003', 'c5700000-0000-0000-0000-00000000000b', 'B대표', '01095701003', 'super_admin', 'approved', now());
insert into public.expense_claims (id, company_id, member_id, title, status) values
  ('c5720000-0000-0000-0000-000000000001', 'c5700000-0000-0000-0000-00000000000a', 'a5710000-0000-0000-0000-000000000002', '지급됨1', 'paid'),
  ('c5720000-0000-0000-0000-000000000002', 'c5700000-0000-0000-0000-00000000000a', 'a5710000-0000-0000-0000-000000000002', '지급됨2', 'paid'),
  ('c5720000-0000-0000-0000-000000000003', 'c5700000-0000-0000-0000-00000000000a', 'a5710000-0000-0000-0000-000000000002', '승인만', 'approved');

select set_config('request.jwt.claims', '{"sub":"a5700000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select public._t_raises57($q$select public.set_payout_proof(array['c5720000-0000-0000-0000-000000000001']::uuid[], 'c5700000-0000-0000-0000-00000000000a/x.png', 'x.png')$q$, '42501', 'employee');
reset role;

select set_config('request.jwt.claims', '{"sub":"a5700000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select public._t_raises57($q$select public.set_payout_proof(array['c5720000-0000-0000-0000-000000000001']::uuid[], 'c5700000-0000-0000-0000-00000000000b/x.png', 'x.png')$q$, 'INVALID_PAYOUT_PROOF', 'other folder');
select public._t_raises57($q$select public.set_payout_proof(array['c5720000-0000-0000-0000-000000000003']::uuid[], 'c5700000-0000-0000-0000-00000000000a/x.png', 'x.png')$q$, 'NOT_FOUND', 'not paid');
do $$
begin
  if public.set_payout_proof(array['c5720000-0000-0000-0000-000000000001', 'c5720000-0000-0000-0000-000000000002', 'c5720000-0000-0000-0000-000000000003']::uuid[],
                             'c5700000-0000-0000-0000-00000000000a/p1.png', ' 이체확인.png ') <> 2 then raise exception 'FAIL [only paid updated]'; end if;
end;
$$;
reset role;
do $$
begin
  if (select count(*) from public.expense_claims where payout_proof_path = 'c5700000-0000-0000-0000-00000000000a/p1.png' and payout_proof_name = '이체확인.png') <> 2 then raise exception 'FAIL [stored]'; end if;
end;
$$;

select set_config('request.jwt.claims', '{"sub":"a5700000-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select public._t_raises57($q$select public.set_payout_proof(array['c5720000-0000-0000-0000-000000000001']::uuid[], 'c5700000-0000-0000-0000-00000000000b/x.png', 'x.png')$q$, 'NOT_FOUND', 'other company claim');
reset role;

select 'payout_proof ok';
rollback;
