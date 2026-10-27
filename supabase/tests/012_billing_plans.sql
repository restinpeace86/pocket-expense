-- =============================================================================
-- 012_billing_plans.sql — 요금제·추가 크레딧 데이터 확인 (D-133). 누구나 읽을 수 있고, 앱 사용자는 바꿀 수 없다.
-- =============================================================================
begin;

do $$
begin
  if (select string_agg(code || ':' || monthly_receipts || ':' || monthly_price || ':' || coalesce(annual_price::text, '-') || ':' || is_unlimited || ':' || is_featured, ',' order by sort_order) from public.billing_plans)
     <> 'starter:150:29000:-:false:false,standard:400:49000:-:false:true,pro:800:89000:-:false:false' then
    raise exception 'FAIL [PLANS] unexpected plans: %', (select string_agg(code, ',' order by sort_order) from public.billing_plans);
  end if;
  if exists (select 1 from public.billing_plans where is_purchasable) then raise exception 'FAIL [PLANS] purchasable before payment integration'; end if;
  -- 첫 결제 시각(D-134): 앱 사용자는 바꿀 수 없음(할인 재사용 방지)
  if has_column_privilege('authenticated', 'public.companies', 'first_purchase_at', 'UPDATE') then raise exception 'FAIL [FIRST] user can update first_purchase_at'; end if;
  if not has_column_privilege('authenticated', 'public.companies', 'first_purchase_at', 'SELECT') then raise exception 'FAIL [FIRST] cannot read first_purchase_at'; end if;
  -- 추가 크레딧: 50장 8,000원, 결제 연동 전이라 살 수 없음
  if (select string_agg(code || ':' || receipts || ':' || price || ':' || is_purchasable, ',') from public.billing_addons) <> 'receipts_50:50:8000:false' then
    raise exception 'FAIL [ADDONS] unexpected addons';
  end if;
end $$;

insert into auth.users (id, instance_id, aud, role, email) values
  ('a0900000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'plans@test.local');
select set_config('request.jwt.claims', '{"sub":"a0900000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
do $$
declare n integer;
begin
  if (select count(*) from public.billing_plans) <> 3 then raise exception 'FAIL [AUTH] cannot read plans'; end if;
  if (select count(*) from public.billing_addons) <> 1 then raise exception 'FAIL [AUTH] cannot read addons'; end if;
  begin
    update public.billing_addons set price = 1;
    raise exception 'FAIL [AUTH] user changed addon price';
  exception when insufficient_privilege then null; end;
  begin
    update public.billing_plans set monthly_price = 1;
    get diagnostics n = row_count;
    if n > 0 then raise exception 'FAIL [AUTH] user changed plan price'; end if;
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- 비로그인: 요금제는 랜딩용으로 읽을 수 있고, 추가 크레딧은 못 읽음
set local role anon;
do $$
begin
  if (select count(*) from public.billing_plans) <> 3 then raise exception 'FAIL [ANON] plans'; end if;
  begin
    perform 1 from public.billing_addons;
    raise exception 'FAIL [ANON] read addons';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

select 'BILLING_PLANS_OK' as result;
rollback;
