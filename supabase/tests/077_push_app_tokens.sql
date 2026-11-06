-- =============================================================================
-- 077_push_app_tokens.sql — 설치 앱 FCM 토큰 (D-228, migration 123)
-- 본인 것만 보기·등록·삭제 / 다른 회사·다른 사람 것 못 봄·못 넣음 / 고칠 수 없음 / 내려받기 저장소는 공개
-- =============================================================================
begin;

create function public._t_raises77(p_sql text, p_code text, p_label text)
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
grant execute on function public._t_raises77(text, text, text) to authenticated;
create function public._t_as77(p_uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
end;
$$;

insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at) values
  ('a7700000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'emp77a@test.local', now()),
  ('a7700000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'emp77b@test.local', now()),
  ('a7700000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'emp77c@test.local', now());
insert into public.companies (id, name, invite_code, business_number) values
  ('c7700000-0000-0000-0000-00000000000a', '앱A', 'APPAAAAA', '1000000771'),
  ('c7700000-0000-0000-0000-00000000000b', '앱B', 'APPBBBBB', '1000000772');
insert into public.members (id, auth_user_id, company_id, name, phone, role, status, privacy_agreed_at) values
  ('a7710000-0000-0000-0000-000000000001', 'a7700000-0000-0000-0000-000000000001', 'c7700000-0000-0000-0000-00000000000a', 'A직원', '01097701001', 'employee', 'approved', now()),
  ('a7710000-0000-0000-0000-000000000002', 'a7700000-0000-0000-0000-000000000002', 'c7700000-0000-0000-0000-00000000000a', 'A동료', '01097701002', 'employee', 'approved', now()),
  ('a7710000-0000-0000-0000-000000000003', 'a7700000-0000-0000-0000-000000000003', 'c7700000-0000-0000-0000-00000000000b', 'B직원', '01097701003', 'employee', 'approved', now());
insert into public.push_app_tokens (id, company_id, member_id, token) values
  ('e7700000-0000-0000-0000-000000000002', 'c7700000-0000-0000-0000-00000000000a', 'a7710000-0000-0000-0000-000000000002', 'fcm-token-77-coworker-000000'),
  ('e7700000-0000-0000-0000-000000000003', 'c7700000-0000-0000-0000-00000000000b', 'a7710000-0000-0000-0000-000000000003', 'fcm-token-77-other-company-0');

select public._t_as77('a7700000-0000-0000-0000-000000000001');
set local role authenticated;
do $$
declare
  n integer;
begin
  -- 본인 것 등록
  insert into public.push_app_tokens (company_id, member_id, token) values ('c7700000-0000-0000-0000-00000000000a', 'a7710000-0000-0000-0000-000000000001', 'fcm-token-77-mine-00000000000');
  -- 같은 회사 동료·다른 회사 이름으로는 못 넣음
  perform public._t_raises77($q$insert into public.push_app_tokens (company_id, member_id, token) values ('c7700000-0000-0000-0000-00000000000a', 'a7710000-0000-0000-0000-000000000002', 'fcm-token-77-fake-coworker-0')$q$, '42501', 'insert as coworker');
  perform public._t_raises77($q$insert into public.push_app_tokens (company_id, member_id, token) values ('c7700000-0000-0000-0000-00000000000b', 'a7710000-0000-0000-0000-000000000003', 'fcm-token-77-fake-othercomp')$q$, '42501', 'insert other company');
  -- 보이는 건 본인 것 하나
  select count(*) into n from public.push_app_tokens;
  if n <> 1 then raise exception 'FAIL [see only own] %', n; end if;
  -- 남의 것 못 지움
  delete from public.push_app_tokens where token in ('fcm-token-77-coworker-000000', 'fcm-token-77-other-company-0');
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL [delete others] %', n; end if;
  -- 고치기 권한 없음
  perform public._t_raises77($q$update public.push_app_tokens set token = 'fcm-token-77-changed-000000' where token = 'fcm-token-77-mine-00000000000'$q$, '42501', 'update');
  -- 본인 것 지움
  delete from public.push_app_tokens where token = 'fcm-token-77-mine-00000000000';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL [delete own] %', n; end if;
end;
$$;
reset role;

do $$
begin
  if (select count(*) from public.push_app_tokens where id in ('e7700000-0000-0000-0000-000000000002', 'e7700000-0000-0000-0000-000000000003')) <> 2 then raise exception 'FAIL [others untouched]'; end if;
  if not (select public from storage.buckets where id = 'app-downloads') then raise exception 'FAIL [downloads bucket public]'; end if;
end;
$$;

select 'ok' as push_app_tokens_077;
rollback;
