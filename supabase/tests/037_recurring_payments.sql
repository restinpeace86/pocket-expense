-- =============================================================================
-- 037_recurring_payments.sql — 정기 결제(D-110, migration 056)
-- 회사 A: 관리자 a1, 직원 e1(담당자), 직원 e2(비활성) / 회사 B: 관리자 b1
-- =============================================================================
begin;

create function public._t_raises(p_sql text, p_code text, p_label text)
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
grant execute on function public._t_raises(text, text, text) to authenticated;

insert into auth.users (id, instance_id, aud, role, email)
select u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u::text || '@test.local'
from unnest(array['a3700000-0000-0000-0000-000000000001', 'a3700000-0000-0000-0000-000000000002', 'a3700000-0000-0000-0000-000000000003', 'b3700000-0000-0000-0000-000000000001']::uuid[]) u;
insert into public.companies (id, name, invite_code, business_number) values
  ('c3700000-0000-0000-0000-00000000000a', '정기결제A', 'RCPYAAAA', '1000000371'),
  ('c3700000-0000-0000-0000-00000000000b', '정기결제B', 'RCPYBBBB', '1000000372');
insert into public.members (id, auth_user_id, company_id, name, phone, role, status, privacy_agreed_at) values
  ('a3710000-0000-0000-0000-000000000001', 'a3700000-0000-0000-0000-000000000001', 'c3700000-0000-0000-0000-00000000000a', 'A관리자', '01093701001', 'super_admin', 'approved', now()),
  ('a3710000-0000-0000-0000-000000000002', 'a3700000-0000-0000-0000-000000000002', 'c3700000-0000-0000-0000-00000000000a', 'A담당자', '01093701002', 'employee', 'approved', now()),
  ('a3710000-0000-0000-0000-000000000003', 'a3700000-0000-0000-0000-000000000003', 'c3700000-0000-0000-0000-00000000000a', 'A퇴사자', '01093701003', 'employee', 'inactive', now()),
  ('b3710000-0000-0000-0000-000000000001', 'b3700000-0000-0000-0000-000000000001', 'c3700000-0000-0000-0000-00000000000b', 'B관리자', '01093702001', 'super_admin', 'approved', now());
insert into public.corporate_cards (id, company_id, nickname, last4) values ('a3750000-0000-0000-0000-000000000001', 'c3700000-0000-0000-0000-00000000000a', 'A 법인', '7890');
select private.seed_account_defaults('c3700000-0000-0000-0000-00000000000a');

-- ── 관리자 등록 ────────────────────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"a3700000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
insert into public.recurring_payments (id, company_id, service_name, amount, cycle, billing_day, billing_month, corporate_card_id, assignee_member_id, starts_on) values
  ('a3760000-0000-0000-0000-000000000001', 'c3700000-0000-0000-0000-00000000000a', '노션 팀 플랜', 48000, 'monthly', 5, null, 'a3750000-0000-0000-0000-000000000001', 'a3710000-0000-0000-0000-000000000002', '2026-09-01'),
  ('a3760000-0000-0000-0000-000000000002', 'c3700000-0000-0000-0000-00000000000a', '피그마', 30000, 'monthly', 31, null, null, 'a3710000-0000-0000-0000-000000000002', '2026-01-01'),
  ('a3760000-0000-0000-0000-000000000003', 'c3700000-0000-0000-0000-00000000000a', '도메인 연장', 22000, 'yearly', 10, 3, null, 'a3710000-0000-0000-0000-000000000002', '2026-01-01'),
  ('a3760000-0000-0000-0000-000000000004', 'c3700000-0000-0000-0000-00000000000a', '퇴사자 담당', 10000, 'monthly', 1, null, null, 'a3710000-0000-0000-0000-000000000003', '2026-01-01'),
  ('a3760000-0000-0000-0000-000000000005', 'c3700000-0000-0000-0000-00000000000a', '나중 등록', 10000, 'monthly', 1, null, null, 'a3710000-0000-0000-0000-000000000002', '2026-10-20');
-- 매년인데 결제 월 없음 / 다른 회사 카드 → 거부
select public._t_raises($q$insert into public.recurring_payments (company_id, service_name, amount, cycle, billing_day, assignee_member_id) values ('c3700000-0000-0000-0000-00000000000a', 'x', 1, 'yearly', 1, 'a3710000-0000-0000-0000-000000000002')$q$, '23514', 'yearly no month');
select public._t_raises($q$insert into public.recurring_payments (company_id, service_name, amount, cycle, billing_day, assignee_member_id) values ('c3700000-0000-0000-0000-00000000000b', 'x', 1, 'monthly', 1, 'b3710000-0000-0000-0000-000000000001')$q$, '42501', 'other company insert');
-- 서버 전용 함수는 직원·관리자가 부를 수 없다
select public._t_raises($q$select public.generate_recurring_claims('2026-10-05')$q$, '42501', 'admin generate');
reset role;

-- ── 직원·다른 회사 관리자는 정기 결제를 못 본다 ───────────────────────────────
select set_config('request.jwt.claims', '{"sub":"a3700000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  if exists (select 1 from public.recurring_payments) then raise exception 'FAIL [employee sees]'; end if;
end $$;
select public._t_raises($q$insert into public.recurring_payments (company_id, service_name, amount, billing_day, assignee_member_id) values ('c3700000-0000-0000-0000-00000000000a', 'x', 1, 1, 'a3710000-0000-0000-0000-000000000002')$q$, '42501', 'employee insert');
reset role;
select set_config('request.jwt.claims', '{"sub":"b3700000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  if exists (select 1 from public.recurring_payments) then raise exception 'FAIL [other company sees]'; end if;
  update public.recurring_payments set amount = 1 where id = 'a3760000-0000-0000-0000-000000000001';
end $$;
reset role;

-- ── 생성 (서버) ─────────────────────────────────────────────────────────────
do $$
declare v jsonb; c record; i record;
begin
  -- 결제일 전: 없음
  v := public.generate_recurring_claims('2026-10-04');
  if jsonb_array_length(v) <> 0 then raise exception 'FAIL [before day] %', v; end if;
  -- 결제일: 노션 1건만(피그마는 31일, 도메인은 3월, 퇴사자 담당 건너뜀, 나중 등록은 10/20부터라 10/1은 안 만듦)
  v := public.generate_recurring_claims('2026-10-05');
  if jsonb_array_length(v) <> 1 or v->0->>'service_name' <> '노션 팀 플랜' then raise exception 'FAIL [on day] %', v; end if;
  select * into c from public.expense_claims where id = (v->0->>'claim_id')::uuid;
  if row(c.member_id, c.status, c.category, c.title, c.recurring_period)::text
     <> row('a3710000-0000-0000-0000-000000000002'::uuid, 'draft'::public.claim_status, 'saas'::public.expense_category, '[온라인 SaaS 구독료] 노션 팀 플랜 2026년 10월', '2026-10-05'::date)::text then
    raise exception 'FAIL [claim] %', row(c.member_id, c.status, c.category, c.title, c.recurring_period);
  end if;
  select * into i from public.expense_items where claim_id = c.id;
  if row(i.category, i.amount, i.expense_date, i.corporate_card_id, i.payment_method, i.merchant_name, i.receipt_path)::text
     <> row('saas'::public.expense_category, 48000, '2026-10-05'::date, 'a3750000-0000-0000-0000-000000000001'::uuid, 'corporate_card'::public.payment_method, '노션 팀 플랜', null::text)::text then
    raise exception 'FAIL [item]';
  end if;
  if c.total_amount <> 48000 then raise exception 'FAIL [totals] %', c.total_amount; end if;
  -- 증빙은 담당자가 붙여야 상신 가능
  if not (private.claim_problems(c.id)->'items'->0->'fields' ? 'receipt') then raise exception 'FAIL [needs evidence]'; end if;
  -- 다시 돌려도(같은 날·다음 날) 중복 없음
  v := public.generate_recurring_claims('2026-10-06');
  if jsonb_array_length(v) <> 0 then raise exception 'FAIL [dup] %', v; end if;
  -- 짧은 달: 31일 결제 → 11/30 / 매년 3월 10일 → 3/10 (31일 안 따라잡기 3/20)
  v := public.generate_recurring_claims('2026-11-30');
  if not exists (select 1 from jsonb_array_elements(v) e where e->>'service_name' = '피그마') then raise exception 'FAIL [short month] %', v; end if;
  v := public.generate_recurring_claims('2027-03-20');
  if not exists (select 1 from jsonb_array_elements(v) e where e->>'service_name' = '도메인 연장' and e->>'period_label' = '2027년') then raise exception 'FAIL [yearly] %', v; end if;
  -- 사용 안 함이면 안 만든다
  update public.recurring_payments set is_active = false where id = 'a3760000-0000-0000-0000-000000000001';
  v := public.generate_recurring_claims('2026-12-05');
  if exists (select 1 from jsonb_array_elements(v) e where e->>'service_name' = '노션 팀 플랜') then raise exception 'FAIL [inactive] %', v; end if;
  if exists (select 1 from public.expense_claims where member_id = 'a3710000-0000-0000-0000-000000000003') then raise exception 'FAIL [inactive assignee]'; end if;
end;
$$;

-- 담당자 본인은 만들어진 결의서를 보고 고칠 수 있다(일반 작성 중 결의서)
select set_config('request.jwt.claims', '{"sub":"a3700000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  if (select count(*) from public.expense_claims where recurring_payment_id is not null) < 3 then raise exception 'FAIL [assignee sees claims]'; end if;
end $$;
reset role;

select 'RECURRING_PAYMENTS_OK' as result;
rollback;
