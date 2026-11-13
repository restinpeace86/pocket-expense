-- 095_budgets.sql — 예산 한도·초과 알림(9-23, migration 156)
-- 플랜(프로부터) / 예산 없으면 쓴 만큼만·알림 없음 / 저장(전체+계정과목) / 결재 올림 → 80% 알림 한 번 → 100% 알림 한 번(80% 다시 안 옴) /
-- 임시 저장·반려는 안 셈 / 결재 화면 영향 / 직원·다른 회사 막힘 / 표 직접 읽기 막힘
begin;
create function public._t_raises95(p_sql text, p_code text, p_label text)
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
grant execute on function public._t_raises95(text, text, text) to authenticated;
create function public._t_as95(p_uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
end;
$$;

insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at) values
  ('a9500000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'boss95@test.local', now()),
  ('a9500000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'emp95@test.local', now()),
  ('a9500000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bboss95@test.local', now());
insert into public.companies (id, name, invite_code, business_number) values
  ('c9500000-0000-0000-0000-00000000000a', '예산A', 'BGAAAAAA', '1000000951'),
  ('c9500000-0000-0000-0000-00000000000b', '예산B', 'BGBBBBBB', '1000000952');
insert into public.members (id, auth_user_id, company_id, name, phone, role, status, privacy_agreed_at, approved_at) values
  ('a9510000-0000-0000-0000-000000000001', 'a9500000-0000-0000-0000-000000000001', 'c9500000-0000-0000-0000-00000000000a', 'A대표', '01099501001', 'super_admin', 'approved', now(), now()),
  ('a9510000-0000-0000-0000-000000000002', 'a9500000-0000-0000-0000-000000000002', 'c9500000-0000-0000-0000-00000000000a', 'A직원', '01099501002', 'employee', 'approved', now(), now()),
  ('a9510000-0000-0000-0000-000000000003', 'a9500000-0000-0000-0000-000000000003', 'c9500000-0000-0000-0000-00000000000b', 'B대표', '01099501003', 'super_admin', 'approved', now(), now());
insert into public.company_features (company_id, feature, enabled) values ('c9500000-0000-0000-0000-00000000000a', 'messenger', true)
on conflict (company_id, feature) do update set enabled = true;
insert into public.account_titles (id, company_id, name) values
  ('b9500000-0000-0000-0000-000000000001', 'c9500000-0000-0000-0000-00000000000a', '예산테스트복리'),
  ('b9500000-0000-0000-0000-000000000002', 'c9500000-0000-0000-0000-00000000000a', '예산테스트교통');
select set_config('t.m', to_char(now() at time zone 'Asia/Seoul', 'YYYY-MM'), true);
select set_config('t.d', to_char(now() at time zone 'Asia/Seoul', 'YYYY-MM-DD'), true);
-- 결의서 3개(모두 임시 저장): c1 복리 40만, c2 복리 50만, c3 교통 10만
insert into public.expense_claims (id, company_id, member_id, title, status) values
  ('e9500000-0000-0000-0000-000000000001', 'c9500000-0000-0000-0000-00000000000a', 'a9510000-0000-0000-0000-000000000002', 'c1', 'draft'),
  ('e9500000-0000-0000-0000-000000000002', 'c9500000-0000-0000-0000-00000000000a', 'a9510000-0000-0000-0000-000000000002', 'c2', 'draft'),
  ('e9500000-0000-0000-0000-000000000003', 'c9500000-0000-0000-0000-00000000000a', 'a9510000-0000-0000-0000-000000000002', 'c3', 'draft');
insert into public.expense_items (claim_id, company_id, sort_order, category, payment_method, expense_date, amount, company_supported_amount, personal_burden_amount, headcount, account_title_id, account_title_name, account_title_overridden) values
  ('e9500000-0000-0000-0000-000000000001', 'c9500000-0000-0000-0000-00000000000a', 1, 'meal', 'corporate_card', current_setting('t.d')::date, 400000, 400000, 0, 1, 'b9500000-0000-0000-0000-000000000001', '예산테스트복리', true),
  ('e9500000-0000-0000-0000-000000000002', 'c9500000-0000-0000-0000-00000000000a', 1, 'meal', 'corporate_card', current_setting('t.d')::date, 500000, 500000, 0, 1, 'b9500000-0000-0000-0000-000000000001', '예산테스트복리', true),
  ('e9500000-0000-0000-0000-000000000003', 'c9500000-0000-0000-0000-00000000000a', 1, 'meeting', 'corporate_card', current_setting('t.d')::date, 100000, 100000, 0, 1, 'b9500000-0000-0000-0000-000000000002', '예산테스트교통', true);
-- 항목 트리거가 계정과목을 바꿨을 수 있어 다시 고정
update public.expense_items set account_title_id = 'b9500000-0000-0000-0000-000000000001', account_title_name = '예산테스트복리' where claim_id in ('e9500000-0000-0000-0000-000000000001', 'e9500000-0000-0000-0000-000000000002');
update public.expense_items set account_title_id = 'b9500000-0000-0000-0000-000000000002', account_title_name = '예산테스트교통' where claim_id = 'e9500000-0000-0000-0000-000000000003';

create function public._t_notices95() returns integer language sql security definer set search_path = '' as $$
  select count(*)::int from public.chat_messages where company_id = 'c9500000-0000-0000-0000-00000000000a' and kind = 'notice' and body like '%예산%'
$$;

-- ① 플랜
do $$
begin
  if (select budget_alerts from public.billing_plans where code = 'starter') or not (select budget_alerts from public.billing_plans where code = 'standard') or not (select budget_alerts from public.billing_plans where code = 'pro') then raise exception 'FAIL [plan]'; end if;
end;
$$;

-- ② 예산 없음: 결재 올려도 알림 없음, 현황은 쓴 만큼
update public.expense_claims set status = 'submitted', submitted_at = now() where id = 'e9500000-0000-0000-0000-000000000003';
do $$
begin
  if public._t_notices95() <> 0 then raise exception 'FAIL [no budget no notice]'; end if;
end;
$$;
select public._t_as95('a9500000-0000-0000-0000-000000000001');
set local role authenticated;
do $$
declare s jsonb;
begin
  s := public.budget_status(null);
  if (s ->> 'total_spent')::bigint <> 100000 or s -> 'total_budget' <> 'null'::jsonb or not (s ->> 'enabled')::boolean then raise exception 'FAIL [status no budget %]', s; end if;
  if (s -> 'titles' -> 0 ->> 'name') <> '예산테스트교통' or (s -> 'titles' -> 0 ->> 'spent')::int <> 100000 then raise exception 'FAIL [titles %]', s; end if;
  -- 저장: 전체 200만, 복리 100만
  perform public.budget_save(2000000, jsonb_build_array(jsonb_build_object('account_title_id', 'b9500000-0000-0000-0000-000000000001', 'amount', 1000000), jsonb_build_object('account_title_id', 'b9500000-0000-0000-0000-000000000002', 'amount', null)));
  s := public.budget_status(null);
  if (s ->> 'total_budget')::int <> 2000000 then raise exception 'FAIL [saved total %]', s; end if;
  perform public._t_raises95($q$select public.budget_save(-1, null)$q$, 'INVALID_AMOUNT', 'negative');
  perform public._t_raises95($q$select public.budget_save(null, '[{"account_title_id":"b9500000-0000-0000-0000-0000000000ff","amount":1}]'::jsonb)$q$, 'NOT_FOUND', 'other title');
  perform public._t_raises95('select count(*) from public.company_budgets', '42501', 'table hidden');
end;
$$;
reset role;

-- ③ c1 올림(복리 40만 = 40%) → 알림 없음 / c2 올림(복리 90만 = 90%) → 80% 알림 1(관리자 1명)
update public.expense_claims set status = 'submitted', submitted_at = now() where id = 'e9500000-0000-0000-0000-000000000001';
do $$ begin if public._t_notices95() <> 0 then raise exception 'FAIL [40%% no notice]'; end if; end; $$;
update public.expense_claims set status = 'submitted', submitted_at = now() where id = 'e9500000-0000-0000-0000-000000000002';
do $$
begin
  if public._t_notices95() <> 1 then raise exception 'FAIL [80%% notice once: %]', public._t_notices95(); end if;
  if not exists (select 1 from public.chat_messages where company_id = 'c9500000-0000-0000-0000-00000000000a' and kind = 'notice' and body like '예산테스트복리 예산의 90%를 썼어요%' and link like '%/admin/settings/budget') then raise exception 'FAIL [80%% text]'; end if;
end;
$$;

-- ④ 결재 화면 영향(관리자): c2 → 복리 90%
select public._t_as95('a9500000-0000-0000-0000-000000000001');
set local role authenticated;
do $$
declare v jsonb;
begin
  v := public.budget_claim_impact('e9500000-0000-0000-0000-000000000002');
  if jsonb_array_length(v) <> 1 or (v -> 0 ->> 'name') <> '예산테스트복리' or (v -> 0 ->> 'pct')::int <> 90 then raise exception 'FAIL [impact %]', v; end if;
end;
$$;
reset role;

-- ⑤ 반려했다가 다시 올려도 같은 단계는 다시 안 옴 / 복리 20만 더 → 100% 알림 1 / 전체(200만) = 110만이라 알림 없음
update public.expense_claims set status = 'rejected' where id = 'e9500000-0000-0000-0000-000000000002';
update public.expense_claims set status = 'submitted' where id = 'e9500000-0000-0000-0000-000000000002';
do $$ begin if public._t_notices95() <> 1 then raise exception 'FAIL [same level once: %]', public._t_notices95(); end if; end; $$;
insert into public.expense_claims (id, company_id, member_id, title, status) values ('e9500000-0000-0000-0000-000000000004', 'c9500000-0000-0000-0000-00000000000a', 'a9510000-0000-0000-0000-000000000002', 'c4', 'draft');
insert into public.expense_items (claim_id, company_id, sort_order, category, payment_method, expense_date, amount, company_supported_amount, personal_burden_amount, headcount, account_title_id, account_title_name, account_title_overridden) values
  ('e9500000-0000-0000-0000-000000000004', 'c9500000-0000-0000-0000-00000000000a', 1, 'meal', 'corporate_card', current_setting('t.d')::date, 200000, 200000, 0, 1, 'b9500000-0000-0000-0000-000000000001', '예산테스트복리', true);
update public.expense_items set account_title_id = 'b9500000-0000-0000-0000-000000000001' where claim_id = 'e9500000-0000-0000-0000-000000000004';
update public.expense_claims set status = 'approved', submitted_at = now() where id = 'e9500000-0000-0000-0000-000000000004';
do $$
begin
  if public._t_notices95() <> 2 then raise exception 'FAIL [100%% notice: %]', public._t_notices95(); end if;
  if not exists (select 1 from public.chat_messages where company_id = 'c9500000-0000-0000-0000-00000000000a' and kind = 'notice' and body like '예산테스트복리 예산을 넘었어요 (110%)%') then raise exception 'FAIL [100%% text]'; end if;
end;
$$;

-- ⑥ 직원·다른 회사 막힘
select public._t_as95('a9500000-0000-0000-0000-000000000002');
set local role authenticated;
do $$
begin
  perform public._t_raises95('select public.budget_status(null)', 'NOT_ALLOWED', 'employee status');
  perform public._t_raises95('select public.budget_save(1, null)', 'NOT_ALLOWED', 'employee save');
end;
$$;
reset role;
select public._t_as95('a9500000-0000-0000-0000-000000000003');
set local role authenticated;
do $$
declare s jsonb;
begin
  s := public.budget_status(null);
  if (s ->> 'total_spent')::bigint <> 0 or s -> 'total_budget' <> 'null'::jsonb then raise exception 'FAIL [B isolated %]', s; end if;
  perform public._t_raises95($q$select public.budget_claim_impact('e9500000-0000-0000-0000-000000000002')$q$, 'NOT_FOUND', 'cross impact');
end;
$$;
reset role;

select 'ok' as budgets_095;
rollback;
