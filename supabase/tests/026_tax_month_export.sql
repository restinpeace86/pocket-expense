-- =============================================================================
-- 026_tax_month_export.sql — 세무 마감 데이터: 관리자만, 자기 회사만, 순번·결재자·빠진 건 (migration 044)
-- =============================================================================
begin;

insert into auth.users (id, instance_id, aud, role, email)
select u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u::text || '@test.local'
from unnest(array['a2600000-0000-0000-0000-000000000001', 'a2600000-0000-0000-0000-000000000002', 'b2600000-0000-0000-0000-000000000001']::uuid[]) u;
insert into public.companies (id, name, invite_code, business_number) values
  ('c2600000-0000-0000-0000-00000000000a', '내보내기A', 'XPRTAAAA', '1000000261'),
  ('c2600000-0000-0000-0000-00000000000b', '내보내기B', 'XPRTBBBB', '1000000262');
insert into public.departments (id, company_id, name) values ('a2650000-0000-0000-0000-000000000001', 'c2600000-0000-0000-0000-00000000000a', '영업팀');
insert into public.members (id, auth_user_id, company_id, name, phone, role, status, privacy_agreed_at, department_id) values
  ('a2610000-0000-0000-0000-000000000001', 'a2600000-0000-0000-0000-000000000001', 'c2600000-0000-0000-0000-00000000000a', '이대표', '01092601001', 'super_admin', 'approved', now(), null),
  ('a2610000-0000-0000-0000-000000000002', 'a2600000-0000-0000-0000-000000000002', 'c2600000-0000-0000-0000-00000000000a', '김직원', '01092601002', 'employee', 'approved', now(), 'a2650000-0000-0000-0000-000000000001'),
  ('b2610000-0000-0000-0000-000000000001', 'b2600000-0000-0000-0000-000000000001', 'c2600000-0000-0000-0000-00000000000b', 'B대표', '01092602001', 'super_admin', 'approved', now(), null);
insert into public.expense_claims (id, company_id, member_id, title, status, current_round) values
  ('a2620000-0000-0000-0000-000000000001', 'c2600000-0000-0000-0000-00000000000a', 'a2610000-0000-0000-0000-000000000002', '승인됨', 'approved', 1),
  ('a2620000-0000-0000-0000-000000000002', 'c2600000-0000-0000-0000-00000000000a', 'a2610000-0000-0000-0000-000000000002', '작성중', 'draft', 0),
  ('a2620000-0000-0000-0000-000000000003', 'c2600000-0000-0000-0000-00000000000a', 'a2610000-0000-0000-0000-000000000002', '반려', 'rejected', 1);
insert into public.claim_approvals (claim_id, company_id, round, step_order, step_kind, status, acted_by_member_id, acted_at) values
  ('a2620000-0000-0000-0000-000000000001', 'c2600000-0000-0000-0000-00000000000a', 1, 1, 'final', 'approved', 'a2610000-0000-0000-0000-000000000001', '2026-09-13 01:00:00+00');
insert into public.expense_items (claim_id, company_id, sort_order, category, payment_method, expense_date, merchant_name, amount, headcount) values
  ('a2620000-0000-0000-0000-000000000001', 'c2600000-0000-0000-0000-00000000000a', 1, 'meal', 'personal_card', '2026-09-10', '김밥천국', 8000, 1),
  ('a2620000-0000-0000-0000-000000000002', 'c2600000-0000-0000-0000-00000000000a', 1, 'meal', 'personal_card', '2026-09-11', '작성중가게', 1000, 1),
  ('a2620000-0000-0000-0000-000000000002', 'c2600000-0000-0000-0000-00000000000a', 2, 'meal', 'personal_card', '2026-09-12', '작성중가게2', 1000, 1),
  ('a2620000-0000-0000-0000-000000000003', 'c2600000-0000-0000-0000-00000000000a', 1, 'meal', 'personal_card', '2026-09-12', '반려가게', 1000, 1);

select set_config('request.jwt.claims', '{"sub":"a2600000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
do $$
declare r jsonb;
begin
  r := public.tax_month_export('2026-09');
  if r->>'status' <> 'pending' or jsonb_array_length(r->'rows') <> 1 then raise exception 'FAIL [SUP] rows %', r; end if;
  if (r->'rows'->0->>'merchant_name') <> '김밥천국' or (r->'rows'->0->>'department') <> '영업팀' or (r->'rows'->0->>'approvers') <> '이대표(9/13)' or (r->'rows'->0->>'seq')::int <> 1 then
    raise exception 'FAIL [SUP] row %', r->'rows'->0;
  end if;
  if r->'excluded' <> '{"draft": 2, "submitted": 0, "rejected": 1, "claims": 2}'::jsonb then raise exception 'FAIL [SUP] excluded %', r->'excluded'; end if;
  perform public.close_tax_month('2026-09');
  r := public.tax_month_export('2026-09');
  if r->>'status' <> 'closed' or jsonb_array_length(r->'rows') <> 1 then raise exception 'FAIL [SUP] closed export %', r; end if;
end;
$$;
reset role;

-- 직원 불가, 다른 회사는 자기 회사 데이터만(0건)
select set_config('request.jwt.claims', '{"sub":"a2600000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  begin
    perform public.tax_month_export('2026-09');
    raise exception 'FAIL [E] employee export';
  exception when others then if sqlerrm <> 'NOT_ALLOWED' then raise; end if;
  end;
end;
$$;
reset role;
select set_config('request.jwt.claims', '{"sub":"b2600000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
do $$
declare r jsonb := public.tax_month_export('2026-09');
begin
  if jsonb_array_length(r->'rows') <> 0 or r->>'status' <> 'pending' or (r->'excluded'->>'claims')::int <> 0 then raise exception 'FAIL [B] sees A %', r; end if;
end;
$$;
reset role;

select 'TAX_MONTH_EXPORT_OK' as result;
rollback;
