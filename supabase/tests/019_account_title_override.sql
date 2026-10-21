-- =============================================================================
-- 019_account_title_override.sql — 항목별 계정과목 개별 조정 (T11-3, migration 035)
-- =============================================================================
begin;

create or replace function public._t_expect(p_sql text, p_code text, p_label text)
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
from unnest(array['a6100000-0000-0000-0000-000000000001', 'a6100000-0000-0000-0000-000000000002', 'b6100000-0000-0000-0000-000000000001']::uuid[]) u;
insert into public.companies (id, name, invite_code, business_number) values
  ('c6100000-0000-0000-0000-00000000000a', '계정회사A', 'ACTAAAAA', '1000000611'),
  ('c6100000-0000-0000-0000-00000000000b', '계정회사B', 'ACTBBBBB', '1000000612');
select private.seed_account_defaults('c6100000-0000-0000-0000-00000000000a');
select private.seed_account_defaults('c6100000-0000-0000-0000-00000000000b');
insert into public.members (id, auth_user_id, company_id, name, phone, role, status, privacy_agreed_at) values
  ('a6200000-0000-0000-0000-000000000001', 'a6100000-0000-0000-0000-000000000001', 'c6100000-0000-0000-0000-00000000000a', 'A관리자', '01096601000', 'admin', 'approved', now()),
  ('a6200000-0000-0000-0000-000000000002', 'a6100000-0000-0000-0000-000000000002', 'c6100000-0000-0000-0000-00000000000a', 'A직원', '01096601001', 'employee', 'approved', now()),
  ('b6200000-0000-0000-0000-000000000001', 'b6100000-0000-0000-0000-000000000001', 'c6100000-0000-0000-0000-00000000000b', 'B대표', '01097601000', 'super_admin', 'approved', now());
insert into public.expense_claims (id, company_id, member_id, title, status) values
  ('a6300000-0000-0000-0000-000000000001', 'c6100000-0000-0000-0000-00000000000a', 'a6200000-0000-0000-0000-000000000002', '식대', 'draft');
update public.expense_claims set status = 'submitted' where id = 'a6300000-0000-0000-0000-000000000001';
insert into public.expense_items (id, claim_id, company_id, sort_order, category, payment_method, amount, account_title_name, closed_month, closing_seq, closing_kind) values
  ('a6400000-0000-0000-0000-000000000001', 'a6300000-0000-0000-0000-000000000001', 'c6100000-0000-0000-0000-00000000000a', 1, 'meal', 'personal_card', 9000, '복리후생비', null, null, null),
  ('a6400000-0000-0000-0000-000000000002', 'a6300000-0000-0000-0000-000000000001', 'c6100000-0000-0000-0000-00000000000a', 2, 'meal', 'personal_card', 9000, '복리후생비', '2026-09', 1, 'current');
select set_config('t.entertain', (select id::text from public.account_titles where company_id = 'c6100000-0000-0000-0000-00000000000a' and name = '기업업무추진비'), true);
select set_config('t.b_title', (select id::text from public.account_titles where company_id = 'c6100000-0000-0000-0000-00000000000b' and name = '기업업무추진비'), true);

-- 직원은 못 바꾼다
select set_config('request.jwt.claims', '{"sub":"a6100000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select public._t_expect(format($q$select public.override_item_account_title('a6400000-0000-0000-0000-000000000001', %L)$q$, current_setting('t.entertain')), 'NOT_ALLOWED', 'employee');
reset role;

-- 다른 회사 대표: 항목도, 자기 회사 계정과목으로도 못 바꾼다
select set_config('request.jwt.claims', '{"sub":"b6100000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select public._t_expect(format($q$select public.override_item_account_title('a6400000-0000-0000-0000-000000000001', %L)$q$, current_setting('t.b_title')), 'NOT_FOUND', 'other company');
reset role;

-- A 관리자: 다른 회사 계정과목은 불가, 마감 항목 불가, 정상 조정 → 되돌리기
select set_config('request.jwt.claims', '{"sub":"a6100000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select public._t_expect(format($q$select public.override_item_account_title('a6400000-0000-0000-0000-000000000001', %L)$q$, current_setting('t.b_title')), 'NOT_FOUND', 'other company title');
select public._t_expect(format($q$select public.override_item_account_title('a6400000-0000-0000-0000-000000000002', %L)$q$, current_setting('t.entertain')), 'ITEM_CLOSED', 'closed item');
do $$
begin
  perform public.override_item_account_title('a6400000-0000-0000-0000-000000000001', current_setting('t.entertain')::uuid);
  if (select row(account_title_name, account_title_overridden, amount)::text from public.expense_items where id = 'a6400000-0000-0000-0000-000000000001') <> row('기업업무추진비', true, 9000)::text then
    raise exception 'FAIL override';
  end if;
  perform public.override_item_account_title('a6400000-0000-0000-0000-000000000001', null);
  if (select row(account_title_name, account_title_overridden)::text from public.expense_items where id = 'a6400000-0000-0000-0000-000000000001') <> row('복리후생비', false)::text then
    raise exception 'FAIL reset';
  end if;
end $$;
reset role;

select 'ACCOUNT_TITLE_OVERRIDE_OK' as result;
rollback;
