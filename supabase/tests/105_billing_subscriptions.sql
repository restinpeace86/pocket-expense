-- 105_billing_subscriptions.sql — 정기결제(D-298, migration 170)
-- 연 회사만 · 관리자만 · 결제키는 아무도 못 읽음 · 다른 회사 구독 안 보임 · 무료 기간 중 등록 = 끝난 다음 날 · 결제 성공 = 요금제·장수·저장 공간
-- 바꾸기·해지 = 다음 결제일부터 · 실패 → 미납 → 1~3일 재시도 · 8일째 업로드 멈춤 · 30일 해지(미납) 뒤에도 멈춤 · 매월 1일 장수 · 말일 보정
begin;
create function public._t_raises105(p_sql text, p_code text, p_label text)
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
grant execute on function public._t_raises105(text, text, text) to authenticated;
create function public._t_as105(p_uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
end;
$$;

insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at) values
  ('a1050000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bossa105@test.local', now()),
  ('a1050000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'empa105@test.local', now()),
  ('a1050000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bossb105@test.local', now()),
  ('a1050000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bossc105@test.local', now());
insert into public.companies (id, name, invite_code, business_number) values
  ('c1050000-0000-0000-0000-00000000000a', '결제A', 'BPAYAAAA', '1000001105'),
  ('c1050000-0000-0000-0000-00000000000b', '결제B', 'BPAYBBBB', '1000002105'),
  ('c1050000-0000-0000-0000-00000000000c', '결제C', 'BPAYCCCC', '1000003105');
-- A: 무료 기간 남음 · B: 무료 기간 끝남 · C: 결제 안 열림
update public.companies set trial_ends_on = private.kst_today() + 10 where id = 'c1050000-0000-0000-0000-00000000000a';
update public.companies set trial_ends_on = private.kst_today() - 1, receipt_credits_used = 37 where id = 'c1050000-0000-0000-0000-00000000000b';
insert into public.members (id, auth_user_id, company_id, name, phone, role, status, privacy_agreed_at, approved_at) values
  ('a1051000-0000-0000-0000-000000000001', 'a1050000-0000-0000-0000-000000000001', 'c1050000-0000-0000-0000-00000000000a', 'A대표', '01010501001', 'super_admin', 'approved', now(), now()),
  ('a1051000-0000-0000-0000-000000000002', 'a1050000-0000-0000-0000-000000000002', 'c1050000-0000-0000-0000-00000000000a', 'A직원', '01010501002', 'employee', 'approved', now(), now()),
  ('a1051000-0000-0000-0000-000000000003', 'a1050000-0000-0000-0000-000000000003', 'c1050000-0000-0000-0000-00000000000b', 'B대표', '01010501003', 'super_admin', 'approved', now(), now()),
  ('a1051000-0000-0000-0000-000000000004', 'a1050000-0000-0000-0000-000000000004', 'c1050000-0000-0000-0000-00000000000c', 'C대표', '01010501004', 'super_admin', 'approved', now(), now());
update private.app_settings set value = 'test' where key = 'billing_mode';
update private.app_settings set value = 'c1050000-0000-0000-0000-00000000000a, c1050000-0000-0000-0000-00000000000b' where key = 'billing_test_companies';

do $$
begin
  if private.billing_next_date('2026-01-31', 31) <> '2026-02-28' then raise exception 'FAIL [next 1/31]'; end if;
  if private.billing_next_date('2026-02-28', 31) <> '2026-03-31' then raise exception 'FAIL [next anchor 31]'; end if;
  if private.billing_next_date('2026-11-20', 20) <> '2026-12-20' then raise exception 'FAIL [next 11/20]'; end if;
  if private.billing_next_date('2027-12-05', 5) <> '2028-01-05' then raise exception 'FAIL [next year]'; end if;
  if has_table_privilege('authenticated', 'public.billing_keys', 'SELECT') then raise exception 'FAIL [keys readable]'; end if;
  if has_function_privilege('authenticated', 'public.billing_card_saved(uuid, uuid, text, text)', 'EXECUTE') then raise exception 'FAIL [card_saved callable]'; end if;
  if has_function_privilege('authenticated', 'public.billing_charge_info(uuid)', 'EXECUTE') then raise exception 'FAIL [charge_info callable]'; end if;
  if has_function_privilege('anon', 'public.billing_prepare(text, integer)', 'EXECUTE') then raise exception 'FAIL [anon prepare]'; end if;
end;
$$;

-- 직원은 못 함 · 안 열린 회사(C)는 결제 못 함 · 없는 요금제·저장 공간 거절
select public._t_as105('a1050000-0000-0000-0000-000000000002');
set local role authenticated;
select public._t_raises105($q$select public.billing_state()$q$, 'NOT_ALLOWED', 'employee state');
select public._t_raises105($q$select public.billing_prepare('starter', 0)$q$, 'NOT_ALLOWED', 'employee prepare');
reset role;
select public._t_as105('a1050000-0000-0000-0000-000000000004');
set local role authenticated;
select public._t_raises105($q$select public.billing_prepare('starter', 0)$q$, 'BILLING_CLOSED', 'closed company');
do $$ begin if (public.billing_state()->>'open')::boolean then raise exception 'FAIL [C open]'; end if; end $$;
reset role;
select public._t_as105('a1050000-0000-0000-0000-000000000001');
set local role authenticated;
select public._t_raises105($q$select public.billing_prepare('nope', 0)$q$, 'INVALID_PLAN', 'bad plan');
select public._t_raises105($q$select public.billing_prepare('starter', 7)$q$, 'INVALID_PLAN', 'bad storage');
-- A: 무료 기간 중 → 구성 저장
select public.billing_prepare('standard', 10);
reset role;

-- A 카드 등록 → 무료 기간 끝난 다음 날 첫 결제 예정, 적용 요금제는 아직 기본
do $$
declare v text; s public.billing_subscriptions;
begin
  select * into s from public.billing_subscriptions where company_id = 'c1050000-0000-0000-0000-00000000000a';
  begin
    perform public.billing_card_saved('c1050000-0000-0000-0000-00000000000a', gen_random_uuid(), 'bk_x', '국민 1234');
    raise exception 'FAIL [wrong customer key accepted]';
  exception when others then if sqlerrm <> 'NOT_FOUND' then raise; end if;
  end;
  v := public.billing_card_saved('c1050000-0000-0000-0000-00000000000a', s.customer_key, 'bk_a', '국민 4673-09**');
  if v <> 'scheduled' then raise exception 'FAIL [A scheduled] %', v; end if;
  select * into s from public.billing_subscriptions where company_id = 'c1050000-0000-0000-0000-00000000000a';
  if s.next_billing_on <> private.kst_today() + 11 then raise exception 'FAIL [A first date] %', s.next_billing_on; end if;
  if (select billing_key from public.billing_keys where company_id = 'c1050000-0000-0000-0000-00000000000a') <> 'bk_a' then raise exception 'FAIL [A key]'; end if;
  if (private.effective_plan('c1050000-0000-0000-0000-00000000000a')).code <> 'standard' then raise exception 'FAIL [A plan before pay]'; end if;
end;
$$;

-- 첫 결제 전에 바꾸기 = 바로, 해지 = 바로
select public._t_as105('a1050000-0000-0000-0000-000000000001');
set local role authenticated;
do $$
begin
  if public.billing_change('pro', 0) <> 'now' then raise exception 'FAIL [A change now]'; end if;
  if (public.billing_state()->'subscription'->>'plan_code') <> 'pro' then raise exception 'FAIL [A plan changed]'; end if;
  if (select count(*) from public.billing_subscriptions) <> 1 then raise exception 'FAIL [A sees other subs]'; end if;
  if public.billing_set_cancel(true) <> 'canceled' then raise exception 'FAIL [A cancel now]'; end if;
end;
$$;
reset role;

-- B: 무료 기간 끝남 → 카드 등록 = 지금 결제
select public._t_as105('a1050000-0000-0000-0000-000000000003');
set local role authenticated;
select public.billing_prepare('starter', 0);
do $$ begin if (select count(*) from public.billing_subscriptions) <> 1 then raise exception 'FAIL [B sees A]'; end if; end $$;
reset role;
do $$
declare v text; s public.billing_subscriptions; c public.companies; r jsonb; v_rec integer;
begin
  select * into s from public.billing_subscriptions where company_id = 'c1050000-0000-0000-0000-00000000000b';
  v := public.billing_card_saved('c1050000-0000-0000-0000-00000000000b', s.customer_key, 'bk_b', '신한 5365-10**');
  if v <> 'charge' then raise exception 'FAIL [B charge] %', v; end if;
  r := public.billing_charge_info('c1050000-0000-0000-0000-00000000000b');
  if r->>'billing_key' <> 'bk_b' or r->>'plan_code' <> 'starter' or (r->>'plan_price')::integer <> 29000 then raise exception 'FAIL [B info] %', r; end if;
  -- 처음 결제가 실패하면 결제 전 그대로(미납 아님)
  perform public.billing_payment_result('c1050000-0000-0000-0000-00000000000b', 'ord-b-0', 'first', false, 'starter', 0, 29000, 0, 29000, 2900, 31900, false, null, null, 'REJECT_CARD_COMPANY', '한도 초과');
  if (select status from public.billing_subscriptions where company_id = 'c1050000-0000-0000-0000-00000000000b') <> 'pending' then raise exception 'FAIL [B first fail stays pending]'; end if;
  r := public.billing_payment_result('c1050000-0000-0000-0000-00000000000b', 'ord-b-1', 'first', true, 'starter', 0, 29000, 0, 29000, 2900, 31900, false, 'pk_1', 'https://r', null, null);
  select * into s from public.billing_subscriptions where company_id = 'c1050000-0000-0000-0000-00000000000b';
  select * into c from public.companies where id = 'c1050000-0000-0000-0000-00000000000b';
  select monthly_receipts into v_rec from public.billing_plans where code = 'starter';
  if s.status <> 'active' or s.period_start <> private.kst_today() or s.next_billing_on <> private.billing_next_date(private.kst_today(), extract(day from private.kst_today())::integer) then raise exception 'FAIL [B active] %', row_to_json(s); end if;
  if c.first_purchase_at is null or c.receipt_credits_granted <> 37 + v_rec then raise exception 'FAIL [B grant] %', c.receipt_credits_granted; end if;
  if (private.effective_plan('c1050000-0000-0000-0000-00000000000b')).code <> 'starter' then raise exception 'FAIL [B effective starter]'; end if;
  if public.alimtalk_active('c1050000-0000-0000-0000-00000000000b') then raise exception 'FAIL [starter alimtalk]'; end if;
  if private.storage_total_limit('c1050000-0000-0000-0000-00000000000b') <> (select storage_mb from public.billing_plans where code = 'starter')::bigint * 1024 * 1024 then raise exception 'FAIL [B storage]'; end if;
  if (select count(*) from public.billing_payments where company_id = 'c1050000-0000-0000-0000-00000000000b') <> 2 then raise exception 'FAIL [B payments]'; end if;
end;
$$;

-- B 바꾸기 = 다음 결제일부터, 해지 예약·취소
select public._t_as105('a1050000-0000-0000-0000-000000000003');
set local role authenticated;
do $$
begin
  if public.billing_change('standard', 25) <> 'next' then raise exception 'FAIL [B change next]'; end if;
  if (public.billing_state()->'subscription'->>'plan_code') <> 'starter' or (public.billing_state()->'subscription'->>'pending_plan_code') <> 'standard' then raise exception 'FAIL [B pending]'; end if;
  if jsonb_array_length(public.billing_state()->'payments') <> 2 then raise exception 'FAIL [B history]'; end if;
  if public.billing_set_cancel(true) <> 'at_period_end' or public.billing_set_cancel(false) <> 'resumed' then raise exception 'FAIL [B cancel toggle]'; end if;
end;
$$;
reset role;
do $$
declare r jsonb; s public.billing_subscriptions; v_due date;
begin
  r := public.billing_charge_info('c1050000-0000-0000-0000-00000000000b');
  if r->>'plan_code' <> 'standard' or (r->>'storage_gb')::integer <> 25 or (r->>'storage_price')::integer <= 0 then raise exception 'FAIL [B pending in info] %', r; end if;
  select next_billing_on into v_due from public.billing_subscriptions where company_id = 'c1050000-0000-0000-0000-00000000000b';
  if not exists (select 1 from public.billing_due(v_due) where company_id = 'c1050000-0000-0000-0000-00000000000b' and action = 'charge') then raise exception 'FAIL [B due]'; end if;
  -- 결제일 갱신 실패 → 미납
  perform public.billing_payment_result('c1050000-0000-0000-0000-00000000000b', 'ord-b-2', 'renewal', false, 'standard', 25, 69000, 0, 69000, 6900, 75900, false, null, null, 'X', '잔액 부족');
  select * into s from public.billing_subscriptions where company_id = 'c1050000-0000-0000-0000-00000000000b';
  if s.status <> 'past_due' or s.past_due_since <> private.kst_today() then raise exception 'FAIL [B past_due]'; end if;
  if (private.effective_plan('c1050000-0000-0000-0000-00000000000b')).code <> 'starter' then raise exception 'FAIL [past_due keeps plan]'; end if;
  if private.billing_blocked('c1050000-0000-0000-0000-00000000000b') then raise exception 'FAIL [blocked day 0]'; end if;
  if exists (select 1 from public.billing_due(private.kst_today()) where company_id = 'c1050000-0000-0000-0000-00000000000b') then raise exception 'FAIL [retry same day]'; end if;
  if not exists (select 1 from public.billing_due(private.kst_today() + 1) where company_id = 'c1050000-0000-0000-0000-00000000000b' and action = 'retry') then raise exception 'FAIL [retry day 1]'; end if;
  if exists (select 1 from public.billing_due(private.kst_today() + 5) where company_id = 'c1050000-0000-0000-0000-00000000000b') then raise exception 'FAIL [no retry day 5]'; end if;
  if not exists (select 1 from public.billing_due(private.kst_today() + 8) where company_id = 'c1050000-0000-0000-0000-00000000000b' and action = 'block') then raise exception 'FAIL [block day 8]'; end if;
  if not exists (select 1 from public.billing_due(private.kst_today() + 30) where company_id = 'c1050000-0000-0000-0000-00000000000b' and action = 'expire') then raise exception 'FAIL [expire day 30]'; end if;
  -- 7일째까지는 그대로, 8일째부터 멈춤
  update public.billing_subscriptions set past_due_since = private.kst_today() - 7 where company_id = 'c1050000-0000-0000-0000-00000000000b';
  if public.billing_upload_blocked('c1050000-0000-0000-0000-00000000000b') then raise exception 'FAIL [blocked day 7]'; end if;
  update public.billing_subscriptions set past_due_since = private.kst_today() - 8 where company_id = 'c1050000-0000-0000-0000-00000000000b';
  if not public.billing_upload_blocked('c1050000-0000-0000-0000-00000000000b') then raise exception 'FAIL [not blocked day 8]'; end if;
  if public.billing_upload_blocked('c1050000-0000-0000-0000-00000000000a') then raise exception 'FAIL [A blocked]'; end if;
end;
$$;

-- 미납 중 해지 신청은 거절(카드 바꿔 결제 먼저)
select public._t_as105('a1050000-0000-0000-0000-000000000003');
set local role authenticated;
select public._t_raises105($q$select public.billing_set_cancel(true)$q$, 'PAST_DUE_CANCEL', 'past_due cancel');
do $$ begin if not (public.billing_state()->>'blocked')::boolean then raise exception 'FAIL [state blocked]'; end if; end $$;
reset role;

-- 30일 → 미납 해지: 계속 멈춤 · 결제하기만 눌러도 안 풀림 · 카드 등록 → 결제 성공하면 풀림
do $$
declare s public.billing_subscriptions; v text;
begin
  perform public.billing_close('c1050000-0000-0000-0000-00000000000b', 'unpaid');
  if not private.billing_blocked('c1050000-0000-0000-0000-00000000000b') then raise exception 'FAIL [unpaid blocked]'; end if;
  if (private.effective_plan('c1050000-0000-0000-0000-00000000000b')).code <> 'standard' then raise exception 'FAIL [canceled plan default]'; end if;
end;
$$;
select public._t_as105('a1050000-0000-0000-0000-000000000003');
set local role authenticated;
select public.billing_prepare('starter', 0);
reset role;
do $$
declare s public.billing_subscriptions; v text;
begin
  if not private.billing_blocked('c1050000-0000-0000-0000-00000000000b') then raise exception 'FAIL [prepare unblocked]'; end if;
  select * into s from public.billing_subscriptions where company_id = 'c1050000-0000-0000-0000-00000000000b';
  v := public.billing_card_saved('c1050000-0000-0000-0000-00000000000b', s.customer_key, 'bk_b2', '신한');
  if v <> 'charge' then raise exception 'FAIL [B again charge] %', v; end if;
  perform public.billing_payment_result('c1050000-0000-0000-0000-00000000000b', 'ord-b-3', 'first', true, 'starter', 0, 29000, 0, 29000, 2900, 31900, false, 'pk_3', null, null, null);
  if private.billing_blocked('c1050000-0000-0000-0000-00000000000b') then raise exception 'FAIL [paid unblocked]'; end if;
  -- 매월 1일 장수: 1일만, 같은 달 한 번
  if public.billing_monthly_grant('2099-02-02') <> 0 then raise exception 'FAIL [grant not 1st]'; end if;
  if public.billing_monthly_grant('2099-02-01') < 1 then raise exception 'FAIL [grant 1st]'; end if;
  if public.billing_monthly_grant('2099-02-01') <> 0 then raise exception 'FAIL [grant twice]'; end if;
end;
$$;

select 'ok' as billing_105;
rollback;
