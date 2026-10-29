-- =============================================================================
-- 056_fixed_closing_calendar.sql — 영업일 마감·늦은 청구 다음 달 정산·관리자 마감 알림 대상 (D-161, migration 088)
-- =============================================================================
begin;

-- 영업일로 당기기
do $$
begin
  if private.claim_cutoff('2026-09') <> '2026-10-02' then raise exception 'FAIL [cutoff weekday]'; end if;
  if private.claim_cutoff('2026-12') <> '2026-12-31' then raise exception 'FAIL [cutoff 1/2 Sat, 1/1 holiday]'; end if;
  if private.tax_close_due('2026-09') <> '2026-10-02' then raise exception 'FAIL [due 10/5 substitute → 10/2]'; end if;
  if private.prev_working_day('2026-11-01') <> '2026-10-30' then raise exception 'FAIL [sunday → friday]'; end if;
  if private.settlement_month('2026-09-20', '2026-10-02 14:00+00') <> '2026-09' then raise exception 'FAIL [on cutoff day KST 23:00 → same month]'; end if;
  if private.settlement_month('2026-09-20', '2026-10-02 15:30+00') <> '2026-10' then raise exception 'FAIL [after cutoff → next month]'; end if;
  if private.settlement_month('2026-09-20', '2026-11-10 01:00+00') <> '2026-11' then raise exception 'FAIL [much later → submit month]'; end if;
  if private.settlement_month('2026-09-20', null) <> '2026-09' then raise exception 'FAIL [not submitted]'; end if;
end;
$$;

-- 늦은 청구: 9월 사용, 마감(10/2) 안 상신 1건 + 10/5 상신 1건 → 9월 대상은 1건, 10월 대상에 전월 추가분 1건
insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at) values
  ('a5600000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'boss56@test.local', now()),
  ('a5600000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bboss56@test.local', now());
insert into public.companies (id, name, invite_code, business_number) values
  ('c5600000-0000-0000-0000-00000000000a', '마감A', 'CLSEAAAA', '1000000561'),
  ('c5600000-0000-0000-0000-00000000000b', '마감B', 'CLSEBBBB', '1000000562');
insert into public.members (id, auth_user_id, company_id, name, phone, role, status, privacy_agreed_at) values
  ('a5610000-0000-0000-0000-000000000001', 'a5600000-0000-0000-0000-000000000001', 'c5600000-0000-0000-0000-00000000000a', 'A대표', '01095601001', 'super_admin', 'approved', now()),
  ('a5610000-0000-0000-0000-000000000002', 'a5600000-0000-0000-0000-000000000002', 'c5600000-0000-0000-0000-00000000000b', 'B대표', '01095601002', 'super_admin', 'approved', now());
insert into public.expense_claims (id, company_id, member_id, title, category, status, submitted_at, approved_at, current_round) values
  ('c5620000-0000-0000-0000-000000000001', 'c5600000-0000-0000-0000-00000000000a', 'a5610000-0000-0000-0000-000000000001', '제때', 'meal', 'approved', '2026-10-01 01:00+00', '2026-10-01 02:00+00', 1),
  ('c5620000-0000-0000-0000-000000000002', 'c5600000-0000-0000-0000-00000000000a', 'a5610000-0000-0000-0000-000000000001', '늦게', 'meal', 'approved', '2026-10-05 01:00+00', '2026-10-05 02:00+00', 1);
insert into public.expense_items (claim_id, company_id, sort_order, category, payment_method, expense_date, amount, headcount, merchant_name, evidence_type) values
  ('c5620000-0000-0000-0000-000000000001', 'c5600000-0000-0000-0000-00000000000a', 1, 'meal', 'personal_card', '2026-09-10', 10000, 1, '제때식당', 'card_slip'),
  ('c5620000-0000-0000-0000-000000000002', 'c5600000-0000-0000-0000-00000000000a', 1, 'meal', 'personal_card', '2026-09-11', 20000, 1, '늦은식당', 'card_slip');
do $$
begin
  if (select count(*) from private.tax_month_pending_items('c5600000-0000-0000-0000-00000000000a', '2026-09')) <> 1 then raise exception 'FAIL [sep has only on-time]'; end if;
  if not exists (select 1 from private.tax_month_pending_items('c5600000-0000-0000-0000-00000000000a', '2026-10') t
                  join public.expense_items i on i.id = t.item_id where i.merchant_name = '늦은식당' and t.kind = 'carryover') then raise exception 'FAIL [late → oct carryover]'; end if;
  if exists (select 1 from private.tax_month_pending_items('c5600000-0000-0000-0000-00000000000a', '2026-10') t
              join public.expense_items i on i.id = t.item_id where i.merchant_name = '제때식당') then raise exception 'FAIL [on-time not in oct while sep open]'; end if;
end;
$$;

-- 관리자 마감 알림: 2026-10-30(금) = 11/1(일)의 앞 영업일 → week_start(10월분), 11/3(화) = hometax_missing, 10/2(금) = close_due(9월분)
insert into public.hometax_uploads (company_id, month, kind, file_path, file_name, file_size) values
  ('c5600000-0000-0000-0000-00000000000a', '2026-10', 'tax_invoice', 'c5600000-0000-0000-0000-00000000000a/x.xlsx', 'x.xlsx', 10);
insert into public.monthly_closings (company_id, year_month, status, closed_at) values ('c5600000-0000-0000-0000-00000000000b', '2026-09', 'closed', now());
do $$
declare j jsonb;
begin
  j := public.closing_admin_targets('2026-10-30');
  if not exists (select 1 from jsonb_array_elements(j) e where e->>'member_id' = 'a5610000-0000-0000-0000-000000000001' and e->>'kind' = 'week_start' and e->>'month' = '2026-10') then raise exception 'FAIL [week_start A] %', j; end if;
  if not exists (select 1 from jsonb_array_elements(j) e where e->>'member_id' = 'a5610000-0000-0000-0000-000000000002' and e->>'kind' = 'week_start') then raise exception 'FAIL [week_start B]'; end if;
  j := public.closing_admin_targets('2026-11-03');
  if exists (select 1 from jsonb_array_elements(j) e where e->>'member_id' = 'a5610000-0000-0000-0000-000000000001') then raise exception 'FAIL [A uploaded → no hometax nag]'; end if;
  if not exists (select 1 from jsonb_array_elements(j) e where e->>'member_id' = 'a5610000-0000-0000-0000-000000000002' and e->>'kind' = 'hometax_missing') then raise exception 'FAIL [B hometax nag]'; end if;
  j := public.closing_admin_targets('2026-10-02');
  if not exists (select 1 from jsonb_array_elements(j) e where e->>'member_id' = 'a5610000-0000-0000-0000-000000000001' and e->>'kind' = 'close_due' and e->>'month' = '2026-09') then raise exception 'FAIL [close_due A] %', j; end if;
  if exists (select 1 from jsonb_array_elements(j) e where e->>'member_id' = 'a5610000-0000-0000-0000-000000000002') then raise exception 'FAIL [B closed → no close nag]'; end if;
  if jsonb_array_length(public.closing_admin_targets('2026-10-14')) <> 0 then raise exception 'FAIL [ordinary day]'; end if;
end;
$$;

-- 직원 마감 푸시: 다음 마감(11/2 월)의 3일 전 = 10/30
insert into public.expense_claims (company_id, member_id, title, category, status, current_round) values
  ('c5600000-0000-0000-0000-00000000000a', 'a5610000-0000-0000-0000-000000000001', '작성중', 'meal', 'draft', 1) ;
update public.expense_claims set item_count = 1 where title = '작성중' and company_id = 'c5600000-0000-0000-0000-00000000000a';
do $$
declare j jsonb := public.push_deadline_targets('2026-10-30');
begin
  if not exists (select 1 from jsonb_array_elements(j) e where e->>'member_id' = 'a5610000-0000-0000-0000-000000000001' and (e->>'days_left')::int = 3 and e->>'deadline' = '2026-11-02') then raise exception 'FAIL [push D-3] %', j; end if;
  if jsonb_array_length(public.push_deadline_targets('2026-10-29')) <> 0 then raise exception 'FAIL [push ordinary]'; end if;
end;
$$;

-- 화면용 달력: 로그인 사용자
select set_config('request.jwt.claims', json_build_object('sub', 'a5600000-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin if public.closing_calendar('2026-09')->>'tax_due' <> '2026-10-02' then raise exception 'FAIL [calendar]'; end if; end; $$;
do $$ begin if (select count(*) from public.kr_holidays) < 20 then raise exception 'FAIL [holidays readable]'; end if; end; $$;
reset role;

select 'fixed_closing_calendar ok';
rollback;
