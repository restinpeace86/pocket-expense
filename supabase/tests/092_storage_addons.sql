-- 092_storage_addons.sql — 저장 공간 추가(8-103, migration 153)
-- 상품은 누구나 읽기 / 관리자만 신청·취소, 처리 전 하나 / 직원·다른 회사 막힘 / 운영자(서버 키)만 켜기·반려 / 함께 쓰는 한도
begin;
create function public._t_raises92(p_sql text, p_code text, p_label text)
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
grant execute on function public._t_raises92(text, text, text) to authenticated, anon;
create function public._t_as92(p_uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
end;
$$;

insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at) values
  ('a9200000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'boss92@test.local', now()),
  ('a9200000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'emp92@test.local', now()),
  ('a9200000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bboss92@test.local', now());
insert into public.companies (id, name, invite_code, business_number) values
  ('c9200000-0000-0000-0000-00000000000a', '공간A', 'SGAAAAAA', '1000000921'),
  ('c9200000-0000-0000-0000-00000000000b', '공간B', 'SGBBBBBB', '1000000922');
insert into public.members (id, auth_user_id, company_id, name, phone, role, status, privacy_agreed_at, approved_at) values
  ('a9210000-0000-0000-0000-000000000001', 'a9200000-0000-0000-0000-000000000001', 'c9200000-0000-0000-0000-00000000000a', 'A대표', '01099201001', 'super_admin', 'approved', now(), now()),
  ('a9210000-0000-0000-0000-000000000002', 'a9200000-0000-0000-0000-000000000002', 'c9200000-0000-0000-0000-00000000000a', 'A직원', '01099201002', 'employee', 'approved', now(), now()),
  ('a9210000-0000-0000-0000-000000000003', 'a9200000-0000-0000-0000-000000000003', 'c9200000-0000-0000-0000-00000000000b', 'B대표', '01099201003', 'super_admin', 'approved', now(), now());

-- ① 상품: 로그인 안 해도 4개(가격 표)
set local role anon;
do $$
begin
  if (select count(*) from public.storage_addons) <> 4 then raise exception 'FAIL [addons public]'; end if;
  if (select monthly_price from public.storage_addons where storage_gb = 10) <> 10000 then raise exception 'FAIL [price 10GB]'; end if;
  perform public._t_raises92('select public.storage_addon_request(10)', '42501', 'anon request');
end;
$$;
reset role;

-- ② 직원은 신청 못 함
select public._t_as92('a9200000-0000-0000-0000-000000000002');
set local role authenticated;
do $$
begin
  perform public._t_raises92('select public.storage_addon_request(10)', 'NOT_ALLOWED', 'employee request');
  perform public._t_raises92('select public.storage_addon_status()', 'NOT_ALLOWED', 'employee status');
end;
$$;
reset role;

-- ③ 관리자: 없는 상품·지금과 같음 막힘 → 10GB 신청 → 두 번째 막힘 → 취소 → 다시 신청
select public._t_as92('a9200000-0000-0000-0000-000000000001');
set local role authenticated;
do $$
declare s jsonb;
begin
  perform public._t_raises92('select public.storage_addon_request(7)', 'NO_SUCH_ADDON', 'no such');
  perform public._t_raises92('select public.storage_addon_request(0)', 'SAME_AS_NOW', 'cancel when none');
  perform public.storage_addon_request(10);
  perform public._t_raises92('select public.storage_addon_request(25)', 'ALREADY_REQUESTED', 'one open');
  s := public.storage_addon_status();
  if (s -> 'pending' ->> 'storage_gb')::int <> 10 or s -> 'pending' ->> 'kind' <> 'add' or (s ->> 'extra_gb')::int <> 0 then raise exception 'FAIL [status pending] %', s; end if;
  perform public.storage_addon_withdraw();
  if public.storage_addon_status() -> 'pending' <> 'null'::jsonb then raise exception 'FAIL [withdraw]'; end if;
  perform set_config('t.req', public.storage_addon_request(10)::text, true);
  -- 관리자는 켜기·반려를 부를 수 없음
  perform public._t_raises92(format('select public.storage_addon_grant(%L)', current_setting('t.req')), '42501', 'admin cannot grant');
end;
$$;
reset role;

-- ④ 다른 회사 관리자: A 신청 안 보임
select public._t_as92('a9200000-0000-0000-0000-000000000003');
set local role authenticated;
do $$
begin
  if (select count(*) from public.storage_requests) <> 0 then raise exception 'FAIL [isolation]'; end if;
  if (public.storage_addon_status() -> 'pending') <> 'null'::jsonb then raise exception 'FAIL [B status]'; end if;
end;
$$;
reset role;

-- ⑤ 운영자(서버 키 = 이 세션): 켜기 → A 추가 공간 10GB, 신청 처리됨
do $$
declare r jsonb;
begin
  r := public.storage_addon_grant(current_setting('t.req')::uuid);
  if (r ->> 'member_id')::uuid <> 'a9210000-0000-0000-0000-000000000001' then raise exception 'FAIL [grant returns member]'; end if;
  if (select extra_storage_gb from public.companies where id = 'c9200000-0000-0000-0000-00000000000a') <> 10 then raise exception 'FAIL [grant extra]'; end if;
  perform public._t_raises92(format('select public.storage_addon_grant(%L)', current_setting('t.req')), 'NOT_PENDING', 'grant twice');
  -- 함께 쓰는 한도: 아무것도 안 썼으면 채팅·보관함 각자 1GB + 10GB
  if private.chat_storage_limit('c9200000-0000-0000-0000-00000000000a') <> 11::bigint * 1024 * 1024 * 1024 then raise exception 'FAIL [chat limit 11GB]'; end if;
  if private.vault_limit('c9200000-0000-0000-0000-00000000000a') <> 11::bigint * 1024 * 1024 * 1024 then raise exception 'FAIL [vault limit 11GB]'; end if;
  -- B는 그대로 1GB
  if private.chat_storage_limit('c9200000-0000-0000-0000-00000000000b') <> 1024::bigint * 1024 * 1024 then raise exception 'FAIL [B limit]'; end if;
end;
$$;
-- 보관함이 기본(1GB)보다 1.2GB 써서 0.2GB 넘김 → 채팅은 추가 공간에서 그만큼 덜 쓸 수 있음
insert into public.vault_files (company_id, owner_member_id, name, kind, size, path)
select 'c9200000-0000-0000-0000-00000000000a', 'a9210000-0000-0000-0000-000000000002', 'f' || g, 'file', 20971520, 'c92a/t/' || g
from generate_series(1, 60) g;
do $$
declare v_over bigint := 60::bigint * 20971520 - 1024::bigint * 1024 * 1024;
begin
  if private.chat_storage_limit('c9200000-0000-0000-0000-00000000000a') <> 11::bigint * 1024 * 1024 * 1024 - v_over then raise exception 'FAIL [shared pool] %', private.chat_storage_limit('c9200000-0000-0000-0000-00000000000a'); end if;
end;
$$;

-- ⑥ 해지 신청 → 반려(사유 필수) → 다시 해지 신청 → 켜기 = 0GB
select public._t_as92('a9200000-0000-0000-0000-000000000001');
set local role authenticated;
do $$
begin
  perform set_config('t.req2', public.storage_addon_request(0)::text, true);
  if (public.storage_addon_status() -> 'pending' ->> 'kind') <> 'cancel' then raise exception 'FAIL [cancel kind]'; end if;
end;
$$;
reset role;
do $$
begin
  perform public._t_raises92(format('select public.storage_addon_reject(%L, %L)', current_setting('t.req2'), ' '), 'REASON_REQUIRED', 'reason');
  perform public.storage_addon_reject(current_setting('t.req2')::uuid, '이번 달까지 쓰고 해지');
  if (select status from public.storage_requests where id = current_setting('t.req2')::uuid) <> 'rejected' then raise exception 'FAIL [reject]'; end if;
  if (select extra_storage_gb from public.companies where id = 'c9200000-0000-0000-0000-00000000000a') <> 10 then raise exception 'FAIL [reject keeps]'; end if;
end;
$$;

-- ⑦ 스타터 대상 문구
do $$
begin
  if (select recommended_size from public.billing_plans where code = 'starter') <> '직원 10명 이하 작은 회사·현장 팀' then raise exception 'FAIL [starter size]'; end if;
end;
$$;

select 'ok' as storage_addons_092;
rollback;
