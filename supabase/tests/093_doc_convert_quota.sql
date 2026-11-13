-- 093_doc_convert_quota.sql — 서류 변환 플랜별 월 무료 횟수(9-21, migration 154)
-- 플랜 값(20·100·1,000+무제한) / 지금 적용 = 프로(100) / 한도 안은 크레딧 안 빠짐 / 실패하면 횟수 돌려줌 / 지워도 횟수 그대로 /
-- 한도 넘으면 크레딧, 크레딧도 없으면 CONVERT_LIMIT / 관리자만 횟수 보기 / 다른 회사 횟수와 섞이지 않음
begin;
create function public._t_raises93(p_sql text, p_code text, p_label text)
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
grant execute on function public._t_raises93(text, text, text) to authenticated;
create function public._t_as93(p_uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
end;
$$;

insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at) values
  ('a9300000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'boss93@test.local', now()),
  ('a9300000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'emp93@test.local', now()),
  ('a9300000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bboss93@test.local', now());
insert into public.companies (id, name, invite_code, business_number) values
  ('c9300000-0000-0000-0000-00000000000a', '횟수A', 'DQAAAAAA', '1000000931'),
  ('c9300000-0000-0000-0000-00000000000b', '횟수B', 'DQBBBBBB', '1000000932');
update public.companies set receipt_credits_granted = 2, receipt_credits_used = 0 where id in ('c9300000-0000-0000-0000-00000000000a', 'c9300000-0000-0000-0000-00000000000b');
insert into public.members (id, auth_user_id, company_id, name, phone, role, status, privacy_agreed_at, approved_at) values
  ('a9310000-0000-0000-0000-000000000001', 'a9300000-0000-0000-0000-000000000001', 'c9300000-0000-0000-0000-00000000000a', 'A대표', '01099301001', 'super_admin', 'approved', now(), now()),
  ('a9310000-0000-0000-0000-000000000002', 'a9300000-0000-0000-0000-000000000002', 'c9300000-0000-0000-0000-00000000000a', 'A직원', '01099301002', 'employee', 'approved', now(), now()),
  ('a9310000-0000-0000-0000-000000000003', 'a9300000-0000-0000-0000-000000000003', 'c9300000-0000-0000-0000-00000000000b', 'B대표', '01099301003', 'super_admin', 'approved', now(), now());

-- ① 플랜 값
do $$
begin
  if (select monthly_doc_converts from public.billing_plans where code = 'starter') <> 20 then raise exception 'FAIL [starter 20]'; end if;
  if (select monthly_doc_converts from public.billing_plans where code = 'standard') <> 100 then raise exception 'FAIL [pro 100]'; end if;
  if (select monthly_doc_converts from public.billing_plans where code = 'pro') <> 1000 or not (select doc_converts_unlimited from public.billing_plans where code = 'pro') then raise exception 'FAIL [business unlimited]'; end if;
  if (private.effective_plan('c9300000-0000-0000-0000-00000000000a')).code <> 'standard' then raise exception 'FAIL [effective = pro]'; end if;
end;
$$;

-- ② 무료: 크레딧 안 빠짐·free 표시·횟수 1, 실패하면 횟수 0, 지워도 횟수 그대로
do $$
declare v jsonb; m text := to_char(now() at time zone 'Asia/Seoul', 'YYYY-MM');
begin
  v := public.doc_convert_begin('d9300000-0000-0000-0000-000000000001', 'a9310000-0000-0000-0000-000000000002', '서류.png', 'image/png',
    'c9300000-0000-0000-0000-00000000000a/a9310000-0000-0000-0000-000000000002/q1.png', 3, null);
  if not (v ->> 'free')::boolean then raise exception 'FAIL [free]'; end if;
  if (select receipt_credits_used from public.companies where id = 'c9300000-0000-0000-0000-00000000000a') <> 0 then raise exception 'FAIL [no credit]'; end if;
  if (select used from public.doc_convert_counts where company_id = 'c9300000-0000-0000-0000-00000000000a' and month = m) <> 1 then raise exception 'FAIL [count 1]'; end if;
  perform public.doc_convert_fail('d9300000-0000-0000-0000-000000000001');
  if (select used from public.doc_convert_counts where company_id = 'c9300000-0000-0000-0000-00000000000a' and month = m) <> 0 then raise exception 'FAIL [fail back 0]'; end if;
  perform public.doc_convert_begin('d9300000-0000-0000-0000-000000000002', 'a9310000-0000-0000-0000-000000000002', '서류2.png', 'image/png',
    'c9300000-0000-0000-0000-00000000000a/a9310000-0000-0000-0000-000000000002/q2.png', 1, null);
  perform public.doc_convert_ready('d9300000-0000-0000-0000-000000000002', '{"sheets":[{"rows":[]}]}'::jsonb);
  delete from public.doc_conversions where id = 'd9300000-0000-0000-0000-000000000002';
  if (select used from public.doc_convert_counts where company_id = 'c9300000-0000-0000-0000-00000000000a' and month = m) <> 1 then raise exception 'FAIL [delete keeps count]'; end if;
  if exists (select 1 from public.doc_convert_counts where company_id = 'c9300000-0000-0000-0000-00000000000b') then raise exception 'FAIL [B untouched]'; end if;
end;
$$;

-- ③ 한도(100) 다 씀 → 크레딧 2쪽 → 크레딧 0 → CONVERT_LIMIT
update public.doc_convert_counts set used = 100 where company_id = 'c9300000-0000-0000-0000-00000000000a';
do $$
declare v jsonb;
begin
  v := public.doc_convert_begin('d9300000-0000-0000-0000-000000000003', 'a9310000-0000-0000-0000-000000000002', '서류3.png', 'image/png',
    'c9300000-0000-0000-0000-00000000000a/a9310000-0000-0000-0000-000000000002/q3.png', 2, null);
  if (v ->> 'free')::boolean then raise exception 'FAIL [over -> credits]'; end if;
  if (select receipt_credits_used from public.companies where id = 'c9300000-0000-0000-0000-00000000000a') <> 2 then raise exception 'FAIL [charged 2]'; end if;
  perform public._t_raises93($q$select public.doc_convert_begin(gen_random_uuid(), 'a9310000-0000-0000-0000-000000000002', 'x', 'image/png', 'c9300000-0000-0000-0000-00000000000a/a9310000-0000-0000-0000-000000000002/q4.png', 1, null)$q$, 'CONVERT_LIMIT', 'limit');
end;
$$;

-- ④ 횟수 보기: 관리자만(자기 회사), 직원 막힘
select public._t_as93('a9300000-0000-0000-0000-000000000001');
set local role authenticated;
do $$
declare v jsonb;
begin
  v := public.doc_convert_quota();
  if (v ->> 'used')::int <> 100 or (v ->> 'limit')::int <> 100 or (v ->> 'unlimited')::boolean then raise exception 'FAIL [quota A %]', v; end if;
  perform public._t_raises93('select count(*) from public.doc_convert_counts', '42501', 'table hidden');
end;
$$;
reset role;
select public._t_as93('a9300000-0000-0000-0000-000000000003');
set local role authenticated;
do $$
begin
  if (public.doc_convert_quota() ->> 'used')::int <> 0 then raise exception 'FAIL [quota B isolated]'; end if;
end;
$$;
reset role;
select public._t_as93('a9300000-0000-0000-0000-000000000002');
set local role authenticated;
do $$
begin
  perform public._t_raises93('select public.doc_convert_quota()', 'NOT_ALLOWED', 'employee quota');
end;
$$;
reset role;

select 'ok' as doc_convert_quota_093;
rollback;
