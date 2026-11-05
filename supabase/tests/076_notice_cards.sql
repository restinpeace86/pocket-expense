-- =============================================================================
-- 076_notice_cards.sql — 앱 알림을 [알림]방 카드로도 (D-224, migration 122)
-- 서버 전용 / 같은 회사 승인 멤버만 / 메신저 꺼지면 안 넣음 / 다시 푸시되지 않게 pushed_at / 받는 사람만 봄
-- =============================================================================
begin;

create function public._t_raises76(p_sql text, p_code text, p_label text)
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
grant execute on function public._t_raises76(text, text, text) to authenticated;
create function public._t_as76(p_uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
end;
$$;

insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at) values
  ('a7600000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'emp76a@test.local', now()),
  ('a7600000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'emp76b@test.local', now()),
  ('a7600000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'emp76c@test.local', now());
insert into public.companies (id, name, invite_code, business_number) values
  ('c7600000-0000-0000-0000-00000000000a', '카드A', 'NTCAAAAA', '1000000761'),
  ('c7600000-0000-0000-0000-00000000000b', '카드B', 'NTCBBBBB', '1000000762');
insert into public.members (id, auth_user_id, company_id, name, phone, role, status, privacy_agreed_at) values
  ('a7610000-0000-0000-0000-000000000001', 'a7600000-0000-0000-0000-000000000001', 'c7600000-0000-0000-0000-00000000000a', 'A직원', '01097601001', 'employee', 'approved', now()),
  ('a7610000-0000-0000-0000-000000000002', 'a7600000-0000-0000-0000-000000000002', 'c7600000-0000-0000-0000-00000000000a', 'A동료', '01097601002', 'employee', 'approved', now()),
  ('a7610000-0000-0000-0000-000000000003', 'a7600000-0000-0000-0000-000000000003', 'c7600000-0000-0000-0000-00000000000b', 'B직원', '01097601003', 'employee', 'approved', now());
insert into public.company_features (company_id, feature, enabled) values
  ('c7600000-0000-0000-0000-00000000000a', 'messenger', true), ('c7600000-0000-0000-0000-00000000000b', 'messenger', false)
on conflict (company_id, feature) do update set enabled = excluded.enabled;

-- ① 회원은 못 부름
select public._t_as76('a7600000-0000-0000-0000-000000000001');
set local role authenticated;
do $$
begin
  perform public._t_raises76($q$select public.chat_post_notices('c7600000-0000-0000-0000-00000000000a', array['a7610000-0000-0000-0000-000000000001']::uuid[], 'x', null)$q$, '42501', 'member cannot post');
end;
$$;
reset role;

-- ② 서버: A직원에게만(다른 회사 멤버를 섞어도 빠짐) / 메신저 꺼진 회사는 0 / pushed_at 채움
do $$
declare
  n integer;
begin
  n := public.chat_post_notices('c7600000-0000-0000-0000-00000000000a', array['a7610000-0000-0000-0000-000000000001', 'a7610000-0000-0000-0000-000000000003']::uuid[], E'결재가 완료됐어요\n제목: 택시비\n금액: 10,000 원', '/workspace/c7600000-0000-0000-0000-00000000000a/employee');
  if n <> 1 then raise exception 'FAIL [only same company] %', n; end if;
  if public.chat_post_notices('c7600000-0000-0000-0000-00000000000b', array['a7610000-0000-0000-0000-000000000003']::uuid[], 'x', null) <> 0 then raise exception 'FAIL [messenger off]'; end if;
  if exists (select 1 from public.chat_messages where company_id = 'c7600000-0000-0000-0000-00000000000a' and kind = 'notice' and pushed_at is null) then raise exception 'FAIL [pushed_at set]'; end if;
end;
$$;

-- ③ 받는 사람만 봄
select public._t_as76('a7600000-0000-0000-0000-000000000002');
set local role authenticated;
do $$
begin
  if exists (select 1 from public.chat_messages where company_id = 'c7600000-0000-0000-0000-00000000000a' and kind = 'notice') then raise exception 'FAIL [other member sees card]'; end if;
end;
$$;
reset role;
select public._t_as76('a7600000-0000-0000-0000-000000000001');
set local role authenticated;
do $$
begin
  if (select count(*) from public.chat_messages where kind = 'notice' and body like '결재가 완료됐어요%') <> 1 then raise exception 'FAIL [owner sees card]'; end if;
end;
$$;
reset role;

select 'ok' as notice_cards_076;
rollback;
