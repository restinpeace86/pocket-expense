-- =============================================================================
-- 012_billing_plans.sql — 요금제 데이터 확인 (D-081). 누구나 읽을 수 있고, 앱 사용자는 바꿀 수 없다.
-- =============================================================================
begin;

do $$
begin
  if (select string_agg(code || ':' || monthly_receipts || ':' || monthly_price || ':' || annual_price || ':' || is_unlimited || ':' || is_featured, ',' order by sort_order) from public.billing_plans)
     <> 'starter:150:30000:324000:false:false,standard:400:60000:648000:false:true,pro:800:110000:1188000:false:false' then
    raise exception 'FAIL [PLANS] unexpected plans: %', (select string_agg(code, ',' order by sort_order) from public.billing_plans);
  end if;
  if exists (select 1 from public.billing_plans where is_purchasable) then raise exception 'FAIL [PLANS] purchasable before payment integration'; end if;
  -- 연간 선결제 = 월 요금 × 12 × 0.9 (10% 할인)
  if exists (select 1 from public.billing_plans where annual_price <> monthly_price * 12 * 9 / 10) then raise exception 'FAIL [PLANS] annual price is not 10%% off'; end if;
end $$;

insert into auth.users (id, instance_id, aud, role, email) values
  ('a0900000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'plans@test.local');
select set_config('request.jwt.claims', '{"sub":"a0900000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
do $$
declare n integer;
begin
  if (select count(*) from public.billing_plans) <> 3 then raise exception 'FAIL [AUTH] cannot read plans'; end if;
  begin
    update public.billing_plans set monthly_price = 1;
    get diagnostics n = row_count;
    if n > 0 then raise exception 'FAIL [AUTH] user changed plan price'; end if;
  exception when insufficient_privilege then null; end;
end $$;
reset role;

select 'BILLING_PLANS_OK' as result;
rollback;
