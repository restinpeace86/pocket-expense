-- =============================================================================
-- 064_trial_until_first_close.sql — 무료 이용 종료일 = 가입한 달 + 다음 달 세무 마감일 (D-201, migration 104)
-- 25일 이후 가입은 한 달 더. 마감일은 5일(쉬는 날이면 앞 영업일). 새 회사 = 종료일 자동·가입 지급 800장
-- =============================================================================
begin;
do $$
begin
  if private.trial_end_for('2026-10-10') <> '2026-11-05' then raise exception 'FAIL [10/10 → 11/5] %', private.trial_end_for('2026-10-10'); end if;
  if private.trial_end_for('2026-11-03') <> '2026-12-04' then raise exception 'FAIL [11/3 → 12/4 (12/5 토)] %', private.trial_end_for('2026-11-03'); end if;
  if private.trial_end_for('2026-10-24') <> '2026-11-05' then raise exception 'FAIL [10/24 → 11/5]'; end if;
  if private.trial_end_for('2026-10-25') <> '2026-12-04' then raise exception 'FAIL [10/25 → 한 달 더 12/4] %', private.trial_end_for('2026-10-25'); end if;
end;
$$;
insert into public.companies (id, name, invite_code, business_number) values ('c6400000-0000-0000-0000-00000000000a', '체험회사', 'TRYALAAA', '1000000641');
insert into public.credit_ledger (company_id, delta, reason) values ('c6400000-0000-0000-0000-00000000000a', 100, 'free_trial_grant');
do $$
begin
  if (select trial_ends_on from public.companies where id = 'c6400000-0000-0000-0000-00000000000a') <> private.trial_end_for((now() at time zone 'Asia/Seoul')::date) then raise exception 'FAIL [new company trial]'; end if;
  if (select receipt_credits_granted from public.companies where id = 'c6400000-0000-0000-0000-00000000000a') <> 800 then raise exception 'FAIL [default 800]'; end if;
  if (select delta from public.credit_ledger where company_id = 'c6400000-0000-0000-0000-00000000000a' and reason = 'free_trial_grant') <> 800 then raise exception 'FAIL [grant 800]'; end if;
  if (select review_coupon_at from public.companies where id = 'c6400000-0000-0000-0000-00000000000a') is not null then raise exception 'FAIL [no coupon yet]'; end if;
end;
$$;
-- 105: 서비스 키로 직접 넣어도 트리거가 동작(권한 오류 없음)
set local role service_role;
insert into public.companies (id, name, invite_code, business_number) values ('c6400000-0000-0000-0000-00000000000b', '서비스키회사', 'SVCKEYAA', '1000000642');
reset role;
do $$ begin if (select trial_ends_on from public.companies where id = 'c6400000-0000-0000-0000-00000000000b') is null then raise exception 'FAIL [service role insert]'; end if; end; $$;
select 'trial_until_first_close ok';
rollback;
