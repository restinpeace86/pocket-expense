-- =============================================================================
-- 027_admin_dashboard.sql — 관리자 홈 숫자: 집계 규칙·관리자만·회사 격리 (migration 045)
-- =============================================================================
begin;

insert into auth.users (id, instance_id, aud, role, email)
select u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u::text || '@test.local'
from unnest(array['a2700000-0000-0000-0000-000000000001', 'a2700000-0000-0000-0000-000000000002', 'a2700000-0000-0000-0000-000000000003', 'b2700000-0000-0000-0000-000000000001']::uuid[]) u;
insert into public.companies (id, name, invite_code, business_number, policy_confirmed_at) values
  ('c2700000-0000-0000-0000-00000000000a', '대시보드A', 'DASHAAAA', '1000000271', now()),
  ('c2700000-0000-0000-0000-00000000000b', '대시보드B', 'DASHBBBB', '1000000272', null);
insert into public.departments (id, company_id, name) values ('a2750000-0000-0000-0000-000000000001', 'c2700000-0000-0000-0000-00000000000a', '영업팀');
insert into public.members (id, auth_user_id, company_id, name, phone, role, status, privacy_agreed_at, department_id) values
  ('a2710000-0000-0000-0000-000000000001', 'a2700000-0000-0000-0000-000000000001', 'c2700000-0000-0000-0000-00000000000a', '이대표', '01092701001', 'super_admin', 'approved', now(), null),
  ('a2710000-0000-0000-0000-000000000002', 'a2700000-0000-0000-0000-000000000002', 'c2700000-0000-0000-0000-00000000000a', '김직원', '01092701002', 'employee', 'approved', now(), 'a2750000-0000-0000-0000-000000000001'),
  ('a2710000-0000-0000-0000-000000000003', 'a2700000-0000-0000-0000-000000000003', 'c2700000-0000-0000-0000-00000000000a', '대기자', '01092701003', 'employee', 'pending', now(), null),
  ('b2710000-0000-0000-0000-000000000001', 'b2700000-0000-0000-0000-000000000001', 'c2700000-0000-0000-0000-00000000000b', 'B대표', '01092702001', 'super_admin', 'approved', now(), null);
insert into public.expense_claims (id, company_id, member_id, title, status, submitted_at) values
  ('a2720000-0000-0000-0000-000000000001', 'c2700000-0000-0000-0000-00000000000a', 'a2710000-0000-0000-0000-000000000002', '승인됨', 'approved', now() - interval '5 days'),
  ('a2720000-0000-0000-0000-000000000002', 'c2700000-0000-0000-0000-00000000000a', 'a2710000-0000-0000-0000-000000000002', '결재중', 'submitted', now() - interval '3 days'),
  ('a2720000-0000-0000-0000-000000000003', 'c2700000-0000-0000-0000-00000000000a', 'a2710000-0000-0000-0000-000000000002', '작성중', 'draft', null),
  ('a2720000-0000-0000-0000-000000000004', 'c2700000-0000-0000-0000-00000000000a', 'a2710000-0000-0000-0000-000000000002', '지난달', 'paid', now() - interval '40 days');
insert into public.expense_items (claim_id, company_id, sort_order, category, trip_type, payment_method, expense_date, amount, company_supported_amount, personal_burden_amount, headcount, account_title_name) values
  ('a2720000-0000-0000-0000-000000000001', 'c2700000-0000-0000-0000-00000000000a', 1, 'meal', null, 'personal_card', '2026-10-05', 10000, 10000, 0, 1, '복리후생비'),
  ('a2720000-0000-0000-0000-000000000001', 'c2700000-0000-0000-0000-00000000000a', 2, 'trip', 'own_car', 'personal_card', '2026-10-06', 75400, 75400, 0, 1, '여비교통비'),
  ('a2720000-0000-0000-0000-000000000001', 'c2700000-0000-0000-0000-00000000000a', 3, 'meal', null, 'corporate_card', '2026-10-07', 13000, 10000, 3000, 1, '복리후생비'),
  ('a2720000-0000-0000-0000-000000000002', 'c2700000-0000-0000-0000-00000000000a', 1, 'meeting', null, 'personal_card', '2026-10-08', 20000, 20000, 0, 1, null),
  ('a2720000-0000-0000-0000-000000000003', 'c2700000-0000-0000-0000-00000000000a', 1, 'meal', null, 'personal_card', '2026-10-09', 99999, 99999, 0, 1, null),
  ('a2720000-0000-0000-0000-000000000004', 'c2700000-0000-0000-0000-00000000000a', 1, 'meal', null, 'personal_card', '2026-09-20', 59200, 59200, 0, 1, '복리후생비');
insert into public.notification_logs (company_id, template_code, status, payload, recipient_phone, provider) values ('c2700000-0000-0000-0000-00000000000a', 'APPROVAL_REQUEST', 'failed', '{}', '', 'log');

select set_config('request.jwt.claims', '{"sub":"a2700000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
do $$
declare r jsonb := public.admin_dashboard('2026-10');
begin
  -- 10월 지출 = 승인 98,400 + 결재중 20,000 (작성중 제외), 9월 = 59,200
  if (r->'kpi'->>'spend')::int <> 118400 or (r->'kpi'->>'spend_prev')::int <> 59200 then raise exception 'FAIL spend %', r->'kpi'; end if;
  if (r->'kpi'->>'pending_claims')::int <> 1 or (r->'kpi'->>'pending_oldest_days')::int <> 3 then raise exception 'FAIL pending %', r->'kpi'; end if;
  -- 미지급 사비: 승인 결의서의 개인카드 회사지원금 85,400 / 미수 납부: 법인카드 개인부담 3,000
  if (r->'kpi'->>'unpaid_payout')::int <> 85400 or (r->'kpi'->>'unpaid_payback')::int <> 3000 then raise exception 'FAIL settle %', r->'kpi'; end if;
  if r->'todo' <> '{"pending_members": 1, "unmapped_items": 1, "settle_claims": 1, "failed_notifications": 1}'::jsonb then raise exception 'FAIL todo %', r->'todo'; end if;
  if r->'checklist' <> '{"approved_members": 2, "departments": 1, "policy_confirmed": true, "review_steps": 0}'::jsonb then raise exception 'FAIL checklist %', r->'checklist'; end if;
  if (r->'categories'->0->>'category') <> 'trip' or (r->'categories'->0->>'trip_type') <> 'own_car' or jsonb_array_length(r->'categories') <> 3 then raise exception 'FAIL categories %', r->'categories'; end if;
  if (r->'top_members'->0->>'name') <> '김직원' or (r->'top_members'->0->>'department') <> '영업팀' or (r->'top_members'->0->>'amount')::int <> 118400 then raise exception 'FAIL top %', r->'top_members'; end if;
end;
$$;
reset role;

-- 직원 불가 / 다른 회사는 0
select set_config('request.jwt.claims', '{"sub":"a2700000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  begin
    perform public.admin_dashboard('2026-10');
    raise exception 'FAIL employee dashboard';
  exception when others then if sqlerrm <> 'NOT_ALLOWED' then raise; end if;
  end;
end;
$$;
reset role;
select set_config('request.jwt.claims', '{"sub":"b2700000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
do $$
declare r jsonb := public.admin_dashboard('2026-10');
begin
  if (r->'kpi'->>'spend')::int <> 0 or (r->'todo'->>'pending_members')::int <> 0 or jsonb_array_length(r->'top_members') <> 0 or (r->'checklist'->>'policy_confirmed')::boolean then
    raise exception 'FAIL [B] %', r;
  end if;
end;
$$;
reset role;

select 'ADMIN_DASHBOARD_OK' as result;
rollback;
