-- =============================================================================
-- 071_push_vibrate.sql — 기기별 알림 소리·진동(D-214, migration 114)
-- 기본 켜짐 / 본인 구독의 vibrate만 바꿀 수 있음 / 남의 구독·다른 칸은 못 바꿈
-- =============================================================================
begin;

create function public._t_raises71(p_sql text, p_code text, p_label text)
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
grant execute on function public._t_raises71(text, text, text) to authenticated;
create function public._t_as71(p_uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
end;
$$;

insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at) values
  ('a7100000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'emp71a@test.local', now()),
  ('a7100000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'emp71b@test.local', now());
insert into public.companies (id, name, invite_code, business_number) values
  ('c7100000-0000-0000-0000-00000000000a', '진동A', 'KPXVVAAA', '1000000711');
insert into public.members (id, auth_user_id, company_id, name, phone, role, status, privacy_agreed_at) values
  ('a7110000-0000-0000-0000-000000000001', 'a7100000-0000-0000-0000-000000000001', 'c7100000-0000-0000-0000-00000000000a', 'A직원', '01097101001', 'employee', 'approved', now()),
  ('a7110000-0000-0000-0000-000000000002', 'a7100000-0000-0000-0000-000000000002', 'c7100000-0000-0000-0000-00000000000a', 'B직원', '01097101002', 'employee', 'approved', now());
insert into public.push_subscriptions (id, company_id, member_id, endpoint, p256dh, auth) values
  ('e7100000-0000-0000-0000-000000000001', 'c7100000-0000-0000-0000-00000000000a', 'a7110000-0000-0000-0000-000000000001', 'https://push.test/71a', repeat('p', 40), repeat('a', 20)),
  ('e7100000-0000-0000-0000-000000000002', 'c7100000-0000-0000-0000-00000000000a', 'a7110000-0000-0000-0000-000000000002', 'https://push.test/71b', repeat('p', 40), repeat('a', 20));

do $$
begin
  if (select vibrate from public.push_subscriptions where id = 'e7100000-0000-0000-0000-000000000001') is not true then raise exception 'FAIL [default on]'; end if;
end;
$$;

select public._t_as71('a7100000-0000-0000-0000-000000000001');
set local role authenticated;
do $$
declare
  n integer;
begin
  update public.push_subscriptions set vibrate = false where endpoint = 'https://push.test/71a';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL [own vibrate off]'; end if;
  update public.push_subscriptions set vibrate = false where endpoint = 'https://push.test/71b';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL [other member subscription]'; end if;
  perform public._t_raises71($q$update public.push_subscriptions set endpoint = 'https://push.test/x' where endpoint = 'https://push.test/71a'$q$, '42501', 'other column');
end;
$$;
reset role;

do $$
begin
  if (select vibrate from public.push_subscriptions where id = 'e7100000-0000-0000-0000-000000000001') is not false then raise exception 'FAIL [saved off]'; end if;
  if (select vibrate from public.push_subscriptions where id = 'e7100000-0000-0000-0000-000000000002') is not true then raise exception 'FAIL [other untouched]'; end if;
end;
$$;

select 'ok' as push_vibrate_071;
rollback;
