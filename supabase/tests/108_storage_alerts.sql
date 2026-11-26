-- 108_storage_alerts.sql — 회사 저장 공간 80%·100% 알림(9-24, migration 175)
-- 80% 아래 = 알림 없음 / 80% → 관리자에게만 한 번 / 같은 날 다시 확인해도 안 옴 / 100% → 한 번(80% 다시 안 옴) /
-- 80% 아래로 내려가면 기록 지움 → 다시 넘으면 또 옴 / 다른 회사엔 안 감 / 직접 호출·표 읽기 막힘
begin;
create function public._t_as108(p_uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
end;
$$;
insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at) values
  ('a1080000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'boss108@test.local', now()),
  ('a1080000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'emp108@test.local', now()),
  ('a1080000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bboss108@test.local', now());
insert into public.companies (id, name, invite_code, business_number) values
  ('c1080000-0000-0000-0000-00000000000a', '용량A', 'STAAAAAA', '1000001081'),
  ('c1080000-0000-0000-0000-00000000000b', '용량B', 'STBBBBBB', '1000001082');
insert into public.members (id, auth_user_id, company_id, name, phone, role, status, privacy_agreed_at, approved_at) values
  ('a1081000-0000-0000-0000-000000000001', 'a1080000-0000-0000-0000-000000000001', 'c1080000-0000-0000-0000-00000000000a', 'A대표', '01010801001', 'super_admin', 'approved', now(), now()),
  ('a1081000-0000-0000-0000-000000000002', 'a1080000-0000-0000-0000-000000000002', 'c1080000-0000-0000-0000-00000000000a', 'A직원', '01010801002', 'employee', 'approved', now(), now()),
  ('a1081000-0000-0000-0000-000000000003', 'a1080000-0000-0000-0000-000000000003', 'c1080000-0000-0000-0000-00000000000b', 'B대표', '01010801003', 'super_admin', 'approved', now(), now());
insert into public.company_features (company_id, feature, enabled) values
  ('c1080000-0000-0000-0000-00000000000a', 'messenger', true), ('c1080000-0000-0000-0000-00000000000b', 'messenger', true)
on conflict (company_id, feature) do update set enabled = true;

create function public._t_notices108(p_company uuid) returns integer language sql security definer set search_path = '' as $$
  select count(*)::int from public.chat_messages where company_id = p_company and kind = 'notice' and body like '%저장 공간%'
$$;
-- 회사 A 영수증 저장소에 가짜 파일 하나(크기만): 한도의 p%
create function public._t_fill108(p_pct numeric) returns void language plpgsql security definer set search_path = '' as $$
declare v_size jsonb := jsonb_build_object('size', floor(private.storage_total_limit('c1080000-0000-0000-0000-00000000000a') * p_pct / 100)::bigint);
begin
  update storage.objects set metadata = v_size where bucket_id = 'receipts' and name = 'c1080000-0000-0000-0000-00000000000a/t108/fake.jpg';
  if not found then
    insert into storage.objects (bucket_id, name, metadata) values ('receipts', 'c1080000-0000-0000-0000-00000000000a/t108/fake.jpg', v_size);
  end if;
end;
$$;

do $$
declare v integer;
begin
  -- ① 비어 있음 → 없음
  v := private.storage_alert_check('c1080000-0000-0000-0000-00000000000a');
  if v is not null or public._t_notices108('c1080000-0000-0000-0000-00000000000a') <> 0 then raise exception 'FAIL ① empty'; end if;
  -- ② 85% → 80% 알림, 관리자 1명에게만(직원 X)
  perform public._t_fill108(85);
  v := private.storage_alert_check('c1080000-0000-0000-0000-00000000000a');
  if v is distinct from 80 then raise exception 'FAIL ② level %', v; end if;
  if public._t_notices108('c1080000-0000-0000-0000-00000000000a') <> 1 then raise exception 'FAIL ② count'; end if;
  if not exists (select 1 from public.chat_messages m join public.chat_rooms r on r.id = m.room_id
                 where m.company_id = 'c1080000-0000-0000-0000-00000000000a' and m.body like '회사 저장 공간의 85%%를 썼어요%' and m.link like '%/admin/billing') then
    raise exception 'FAIL ② body';
  end if;
  -- ③ 다시 확인 → 안 옴
  v := private.storage_alert_check('c1080000-0000-0000-0000-00000000000a');
  if v is not null or public._t_notices108('c1080000-0000-0000-0000-00000000000a') <> 1 then raise exception 'FAIL ③ repeat'; end if;
  -- ④ 100% → 꽉 참 한 번
  perform public._t_fill108(100);
  v := private.storage_alert_check('c1080000-0000-0000-0000-00000000000a');
  if v is distinct from 100 or public._t_notices108('c1080000-0000-0000-0000-00000000000a') <> 2 then raise exception 'FAIL ④ full'; end if;
  if not exists (select 1 from public.chat_messages where company_id = 'c1080000-0000-0000-0000-00000000000a' and body like '회사 저장 공간이 꽉 찼어요%') then raise exception 'FAIL ④ body'; end if;
  v := private.storage_alert_check('c1080000-0000-0000-0000-00000000000a');
  if v is not null or public._t_notices108('c1080000-0000-0000-0000-00000000000a') <> 2 then raise exception 'FAIL ④ repeat'; end if;
  -- ⑤ 90%로 내려옴 → 80%는 이미 알렸으니 없음, 다시 100% → 또 옴
  perform public._t_fill108(90);
  v := private.storage_alert_check('c1080000-0000-0000-0000-00000000000a');
  if v is not null then raise exception 'FAIL ⑤ 90 %', v; end if;
  perform public._t_fill108(100);
  v := private.storage_alert_check('c1080000-0000-0000-0000-00000000000a');
  if v is distinct from 100 or public._t_notices108('c1080000-0000-0000-0000-00000000000a') <> 3 then raise exception 'FAIL ⑤ refull'; end if;
  -- ⑥ 50%로 정리 → 기록 지움 → 85% 다시 넘으면 80% 또 옴
  perform public._t_fill108(50);
  v := private.storage_alert_check('c1080000-0000-0000-0000-00000000000a');
  if exists (select 1 from public.storage_alert_logs where company_id = 'c1080000-0000-0000-0000-00000000000a') then raise exception 'FAIL ⑥ logs'; end if;
  perform public._t_fill108(85);
  v := private.storage_alert_check('c1080000-0000-0000-0000-00000000000a');
  if v is distinct from 80 or public._t_notices108('c1080000-0000-0000-0000-00000000000a') <> 4 then raise exception 'FAIL ⑥ again'; end if;
  -- ⑦ 다른 회사엔 안 감
  if public._t_notices108('c1080000-0000-0000-0000-00000000000b') <> 0 then raise exception 'FAIL ⑦ other company'; end if;
  -- ⑧ 직원 [알림]방엔 없음
  if exists (select 1 from public.chat_messages m join public.chat_rooms r on r.id = m.room_id
             where m.company_id = 'c1080000-0000-0000-0000-00000000000a' and m.body like '%저장 공간%' and r.notice_member_id = 'a1081000-0000-0000-0000-000000000002') then
    raise exception 'FAIL ⑧ employee got it';
  end if;
end $$;

-- ⑨ 일반 사용자는 직접 호출·표 읽기 못 함
set local role authenticated;
select public._t_as108('a1080000-0000-0000-0000-000000000001');
do $$
begin
  begin
    perform public.storage_alert_check_all();
    raise exception 'FAIL ⑨ check_all allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.storage_alert_logs limit 1;
    raise exception 'FAIL ⑨ logs readable';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

select 'storage alerts ok' as result;
rollback;
