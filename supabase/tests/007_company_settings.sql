-- =============================================================================
-- 007_company_settings.sql — 회사·정책 설정 저장 권한·격리·사업자번호 재판정 테스트 (T3-2, D-063)
-- 회사 A(대표 a_sup, 관리자 a_adm, 직원 a_emp), 회사 B(대표 b_sup)
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
  'a7000000-0000-0000-0000-000000000001', 'a7000000-0000-0000-0000-000000000002', 'a7000000-0000-0000-0000-000000000003',
  'b7000000-0000-0000-0000-000000000001'
]::uuid[]) u;
insert into public.companies (id, name, invite_code, business_number) values
  ('c7000000-0000-0000-0000-00000000000a', '설정회사A', 'SETTAAAA', '1000000041'),
  ('c7000000-0000-0000-0000-00000000000b', '설정회사B', 'SETTBBBB', '1000000042');
insert into public.members (id, auth_user_id, company_id, name, phone, role, status, privacy_agreed_at) values
  ('a8000000-0000-0000-0000-000000000001', 'a7000000-0000-0000-0000-000000000001', 'c7000000-0000-0000-0000-00000000000a', 'A대표', '01070001000', 'super_admin', 'approved', now()),
  ('a8000000-0000-0000-0000-000000000002', 'a7000000-0000-0000-0000-000000000002', 'c7000000-0000-0000-0000-00000000000a', 'A관리', '01070001001', 'admin', 'approved', now()),
  ('a8000000-0000-0000-0000-000000000003', 'a7000000-0000-0000-0000-000000000003', 'c7000000-0000-0000-0000-00000000000a', 'A직원', '01070001002', 'employee', 'approved', now()),
  ('b8000000-0000-0000-0000-000000000001', 'b7000000-0000-0000-0000-000000000001', 'c7000000-0000-0000-0000-00000000000b', 'B대표', '01080001000', 'super_admin', 'approved', now());

update private.app_settings set value = 'off' where key = 'business_verify_mode';
update private.app_settings set value = '' where key = 'business_verify_bypass_numbers';

-- ── A 관리자(off 모드): 저장 가능, 직접 UPDATE는 불가 ─────────────────────────────
select set_config('request.jwt.claims', '{"sub":"a7000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select public.update_company_settings(' 설정회사A(주) ', '123-45-67891', 15000, 'notify', 250, 'days_after', 30);
select public._t_expect($q$update public.companies set business_number = '9999999999' where id = 'c7000000-0000-0000-0000-00000000000a'$q$,
  'permission denied for table companies', 'A_ADM direct business_number');
select public._t_expect($q$update public.companies set meal_limit_per_person = 1 where id = 'c7000000-0000-0000-0000-00000000000a'$q$,
  'permission denied for table companies', 'A_ADM direct meal limit');
select public._t_expect($q$select public.update_company_settings('A', '1234567891', 10000, 'split', 200, 'days_after', null)$q$, 'INVALID_CLAIM_DEADLINE', 'A_ADM days null');
select public._t_expect($q$select public.update_company_settings('A', '1234567891', 10000, 'split', 200, 'days_after', 91)$q$, 'INVALID_CLAIM_DEADLINE', 'A_ADM days 91');
select public._t_expect($q$select public.update_company_settings('A', '1234567891', -1, 'split', 200, 'none', null)$q$, 'INVALID_MEAL_LIMIT', 'A_ADM meal -1');
select public._t_expect($q$select public.update_company_settings('A', '1234567891', 10000, 'split', -5, 'none', null)$q$, 'INVALID_FUEL_RATE', 'A_ADM fuel -5');
select public._t_expect($q$select public.update_company_settings('A', '123', 10000, 'split', 200, 'none', null)$q$, 'INVALID_BUSINESS_NUMBER', 'A_ADM bizno short');
select public._t_expect($q$select public.update_company_settings('   ', '1234567891', 10000, 'split', 200, 'none', null)$q$, 'INVALID_COMPANY_NAME', 'A_ADM empty name');
-- 이벤트 배너 확인은 기존대로 직접 갱신 가능
update public.companies set event_bonus_acknowledged_at = now() where id = 'c7000000-0000-0000-0000-00000000000a';
reset role;

do $$
begin
  if (select row(name, business_number, business_status, meal_limit_per_person, meal_limit_mode, fuel_rate_per_km, claim_deadline_type, claim_deadline_days)::text
        from public.companies where id = 'c7000000-0000-0000-0000-00000000000a')
     <> row('설정회사A(주)', '1234567891', 'skipped', 15000, 'notify'::public.meal_limit_mode, 250, 'days_after'::public.claim_deadline_type, 30)::text then
    raise exception 'FAIL [A_ADM] settings not stored';
  end if;
  if (select event_bonus_acknowledged_at from public.companies where id = 'c7000000-0000-0000-0000-00000000000a') is null then
    raise exception 'FAIL [A_ADM] event ack not stored';
  end if;
end $$;

-- ── A 직원: 저장 불가 ────────────────────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"a7000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select public._t_expect($q$select public.update_company_settings('해킹', '1234567891', 0, 'split', 0, 'none', null)$q$, 'NOT_ALLOWED', 'A_EMP save');
reset role;

-- ── B 대표: 자기 회사만 바뀌고 A는 그대로 ───────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"b7000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select public.update_company_settings('설정회사B', '1000000042', 9000, 'split', 200, 'end_of_month', 5);
do $$
begin
  update public.companies set event_bonus_acknowledged_at = null where id = 'c7000000-0000-0000-0000-00000000000a';
  if (select count(*) from public.companies) <> 1 then raise exception 'FAIL [B_SUP] sees other company'; end if;
end $$;
reset role;

do $$
begin
  if (select row(name, meal_limit_per_person, event_bonus_acknowledged_at is not null)::text from public.companies where id = 'c7000000-0000-0000-0000-00000000000a')
     <> row('설정회사A(주)', 15000, true)::text then
    raise exception 'FAIL [B_SUP] changed company A';
  end if;
  if (select row(meal_limit_per_person, claim_deadline_type, claim_deadline_days)::text from public.companies where id = 'c7000000-0000-0000-0000-00000000000b')
     <> row(9000, 'end_of_month'::public.claim_deadline_type, null::integer)::text then
    raise exception 'FAIL [B_SUP] own settings not stored (days must be cleared unless days_after)';
  end if;
end $$;

-- ── enforce 모드: 사업자번호를 바꿀 때 회사 등록과 같은 판정 ─────────────────────────
set local role service_role;
insert into public.business_verifications (b_no, auth_user_id, status, status_label) values
  ('1248100998', 'a7000000-0000-0000-0000-000000000001', 'closed', '폐업자'),
  ('1248100998', 'a7000000-0000-0000-0000-000000000002', 'active', '계속사업자');
reset role;
update private.app_settings set value = 'enforce' where key = 'business_verify_mode';

-- A 대표: 본인 조회 결과가 폐업 → 거부, 회사 그대로
select set_config('request.jwt.claims', '{"sub":"a7000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select public._t_expect($q$select public.update_company_settings('설정회사A(주)', '1248100998', 15000, 'notify', 250, 'none', null)$q$, 'BUSINESS_CLOSED', 'A_SUP closed bizno');
-- 체크섬이 틀린 번호도 거부
select public._t_expect($q$select public.update_company_settings('설정회사A(주)', '1111111111', 15000, 'notify', 250, 'none', null)$q$, 'INVALID_BUSINESS_NUMBER', 'A_SUP checksum');
-- 번호를 바꾸지 않으면 재판정 없이 다른 값 저장 (기존 번호 1234567891은 체크섬이 틀려도 그대로 유지)
select public.update_company_settings('설정회사A', '1234567891', 15000, 'notify', 250, 'none', null);
reset role;

-- A 관리자: 본인 조회 결과가 계속사업자 → 통과, 상태·확인 시각 기록
select set_config('request.jwt.claims', '{"sub":"a7000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select public.update_company_settings('설정회사A', '124-81-00998', 15000, 'notify', 250, 'none', null);
reset role;

do $$
begin
  if (select row(name, business_number, business_status, business_verified_at is not null, claim_deadline_type)::text
        from public.companies where id = 'c7000000-0000-0000-0000-00000000000a')
     <> row('설정회사A', '1248100998', 'active', true, 'none'::public.claim_deadline_type)::text then
    raise exception 'FAIL [ENFORCE] business number re-verification not applied';
  end if;
end $$;

-- ── 청구 기한 "결제한 다음 달 N일까지" (D-064) ──────────────────────────────────────
update private.app_settings set value = 'off' where key = 'business_verify_mode';
select set_config('request.jwt.claims', '{"sub":"a7000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select public._t_expect($q$select public.update_company_settings('A', '1248100998', 10000, 'split', 200, 'next_month_day', 29)$q$, 'INVALID_CLAIM_DEADLINE', 'A_ADM next month 29');
select public._t_expect($q$select public.update_company_settings('A', '1248100998', 10000, 'split', 200, 'next_month_day', null)$q$, 'INVALID_CLAIM_DEADLINE', 'A_ADM next month null');
select public.update_company_settings('설정회사A', '1248100998', 15000, 'notify', 250, 'next_month_day', 5);
reset role;
insert into public.companies (id, name, invite_code, business_number) values ('c7000000-0000-0000-0000-00000000000c', '기본값회사', 'SETTCCCC', '1000000043');
do $$
begin
  if (select row(claim_deadline_type, claim_deadline_days)::text from public.companies where id = 'c7000000-0000-0000-0000-00000000000a')
     <> row('next_month_day'::public.claim_deadline_type, 5)::text then
    raise exception 'FAIL [NEXT_MONTH] not stored';
  end if;
  if (select row(claim_deadline_type, claim_deadline_days)::text from public.companies where id = 'c7000000-0000-0000-0000-00000000000c')
     <> row('next_month_day'::public.claim_deadline_type, 5)::text then
    raise exception 'FAIL [DEFAULT] new company default is not next month 5th';
  end if;
end $$;

-- ── 사용 안 함 + 정책 확인 시각 (D-068) ──────────────────────────────────────────
do $$
begin
  if (select policy_confirmed_at from public.companies where id = 'c7000000-0000-0000-0000-00000000000c') is not null then
    raise exception 'FAIL [POLICY] new company should not be confirmed';
  end if;
  if (select row(meal_limit_enabled, fuel_enabled)::text from public.companies where id = 'c7000000-0000-0000-0000-00000000000c') <> row(true, true)::text then
    raise exception 'FAIL [POLICY] new company toggles default';
  end if;
end $$;
select set_config('request.jwt.claims', '{"sub":"a7000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select public.update_company_settings('설정회사A', '1248100998', 12000, 'split', 250, 'none', null, false, false);
select public._t_expect($q$select public.update_company_settings('A', '1248100998', 12000, 'split', 250, 'none', null, null, true)$q$, 'INVALID_POLICY', 'A_ADM toggle null');
select public._t_expect($q$update public.companies set meal_limit_enabled = true where id = 'c7000000-0000-0000-0000-00000000000a'$q$,
  'permission denied for table companies', 'A_ADM direct toggle');
reset role;
do $$
begin
  if (select row(meal_limit_enabled, fuel_enabled, meal_limit_per_person, fuel_rate_per_km, policy_confirmed_at is not null)::text
        from public.companies where id = 'c7000000-0000-0000-0000-00000000000a')
     <> row(false, false, 12000, 250, true)::text then
    raise exception 'FAIL [POLICY] toggles/confirmed not stored (values must be kept)';
  end if;
  if (select policy_confirmed_at from public.companies where id = 'c7000000-0000-0000-0000-00000000000b') is null then
    raise exception 'FAIL [POLICY] B saved but not confirmed';
  end if;
end $$;

select 'COMPANY_SETTINGS_OK' as result;
rollback;
