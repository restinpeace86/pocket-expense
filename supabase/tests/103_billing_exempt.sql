-- 103: 운영사 결제 면제(D-294) — 면제 번호 첫 회사만 면제 · 같은 번호 두 번째 회사·다른 번호는 아님 · 요금제/저장 공간 · 스스로 못 켬
begin;
do $$
declare a uuid; b uuid; c uuid; v record; n integer;
begin
  -- 이미 운영에서 면제 번호로 가입했으면 첫 회사 검사는 건너뛰고 두 번째 회사 검사만
  select count(*) into n from public.companies where business_number = '5482302343';
  insert into public.companies (name, business_number, invite_code) values ('t103 면제', '5482302343', 'TQAZXW23') returning id into a;
  insert into public.companies (name, business_number, invite_code) values ('t103 같은 번호', '5482302343', 'TQBZXW34') returning id into b;
  insert into public.companies (name, business_number, invite_code) values ('t103 일반', '1234567891', 'TQCZXW45') returning id into c;

  if n = 0 then
    select * into v from public.companies where id = a;
    if not v.billing_exempt or v.trial_ends_on is not null or v.receipt_credits_granted < 1000000 then raise exception 'FAIL first exempt %', row_to_json(v); end if;
    if (private.effective_plan(a)).code <> 'pro' then raise exception 'FAIL exempt plan'; end if;
    if private.storage_total_limit(a) <> (select storage_mb from public.billing_plans where code = 'pro')::bigint * 1024 * 1024 then raise exception 'FAIL exempt storage'; end if;
    if private.form_slot_limit(a) <> (select case when form_slots_unlimited then 1000 else form_slots end from public.billing_plans where code = 'pro') then raise exception 'FAIL exempt slots'; end if;
  end if;

  select * into v from public.companies where id = b;
  if v.billing_exempt or v.trial_ends_on is null then raise exception 'FAIL second same number exempt'; end if;
  select * into v from public.companies where id = c;
  if v.billing_exempt or v.trial_ends_on is null or v.receipt_credits_granted >= 1000000 then raise exception 'FAIL normal'; end if;
  if (private.effective_plan(c)).code <> 'standard' then raise exception 'FAIL normal plan'; end if;
  if private.storage_total_limit(c) <> 10240::bigint * 1024 * 1024 then raise exception 'FAIL normal storage'; end if;

  -- 로그인 사용자는 면제 칸·면제 번호 목록을 못 고친다
  if has_column_privilege('authenticated', 'public.companies', 'billing_exempt', 'UPDATE') then raise exception 'FAIL can update exempt'; end if;
  if has_table_privilege('authenticated', 'private.billing_exempt_business_numbers', 'SELECT') then raise exception 'FAIL can read list'; end if;
  -- 운영 키로 회사를 넣어도 트리거가 돌게(105·168): 두 트리거 함수 모두 security definer
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'private' and p.proname in ('company_trial_defaults', 'company_billing_exempt') and not p.prosecdef) then raise exception 'FAIL trigger not definer'; end if;
  raise notice 'billing_exempt ok';
end $$;
select 'ok' as billing_exempt;
rollback;
