-- =============================================================================
-- 068_calendar_admin_switch.sql — 관리자가 캘린더 켜기·끄기 (D-208, migration 111)
-- 관리자만 / 자기 회사만 / 끄면 기능 막힘·데이터는 남음 / 메신저 스위치는 못 바꿈
-- =============================================================================
begin;

create function public._t_raises68(p_sql text, p_code text, p_label text)
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
grant execute on function public._t_raises68(text, text, text) to authenticated;
create function public._t_as68(p_uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
end;
$$;

insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at) values
  ('a6800000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'boss68@test.local', now()),
  ('a6800000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'emp68@test.local', now()),
  ('a6800000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bboss68@test.local', now());
insert into public.companies (id, name, invite_code, business_number) values
  ('c6800000-0000-0000-0000-00000000000a', '스위치A', 'SWXAAAAA', '1000000681'),
  ('c6800000-0000-0000-0000-00000000000b', '스위치B', 'SWXBBBBB', '1000000682');
insert into public.members (id, auth_user_id, company_id, name, phone, role, status, privacy_agreed_at) values
  ('a6810000-0000-0000-0000-000000000001', 'a6800000-0000-0000-0000-000000000001', 'c6800000-0000-0000-0000-00000000000a', 'A대표', '01096801001', 'super_admin', 'approved', now()),
  ('a6810000-0000-0000-0000-000000000002', 'a6800000-0000-0000-0000-000000000002', 'c6800000-0000-0000-0000-00000000000a', 'A직원', '01096801002', 'employee', 'approved', now()),
  ('a6810000-0000-0000-0000-000000000003', 'a6800000-0000-0000-0000-000000000003', 'c6800000-0000-0000-0000-00000000000b', 'B대표', '01096801003', 'super_admin', 'approved', now());

-- 두 회사 모두 꺼 둔 상태에서 시작(D-251부터 기본은 켜짐)
insert into public.company_features (company_id, feature, enabled) values
  ('c6800000-0000-0000-0000-00000000000a', 'calendar', false),
  ('c6800000-0000-0000-0000-00000000000b', 'calendar', false);

-- ① 직원은 못 켬
select public._t_as68('a6800000-0000-0000-0000-000000000002');
set local role authenticated;
do $$
begin
  perform public._t_raises68($q$select public.calendar_set_enabled(true)$q$, '42501', 'employee');
  if public.my_feature_enabled('calendar') then raise exception 'FAIL [still off]'; end if;
end;
$$;
reset role;

-- ② 관리자 켜기 → 일정 만들기 → 끄기(막힘) → 다시 켜기(일정 그대로) / 다른 회사는 영향 없음 / 표 직접 쓰기 불가
select public._t_as68('a6800000-0000-0000-0000-000000000001');
set local role authenticated;
do $$
declare
  v_id uuid;
begin
  if public.calendar_set_enabled(true) is not true then raise exception 'FAIL [on]'; end if;
  if not public.my_feature_enabled('calendar') then raise exception 'FAIL [on read]'; end if;
  v_id := public.calendar_save_event(null, '{"title":"회의","kind":"meeting","all_day":true,"start_date":"2030-01-07"}');
  perform set_config('t.ev', v_id::text, true);
  perform public.calendar_set_enabled(false);
  perform public._t_raises68($q$select public.calendar_directory()$q$, 'FEATURE_DISABLED', 'off blocks');
  perform public.calendar_set_enabled(true);
  if public.calendar_event(current_setting('t.ev')::uuid) ->> 'title' <> '회의' then raise exception 'FAIL [data kept]'; end if;
  if not public.my_feature_enabled('messenger') then raise exception 'FAIL [messenger untouched]'; end if;
  perform public._t_raises68($q$insert into public.company_features (company_id, feature, enabled) values ('c6800000-0000-0000-0000-00000000000a', 'messenger', false)$q$, '42501', 'no direct write');
end;
$$;
reset role;
select public._t_as68('a6800000-0000-0000-0000-000000000003');
set local role authenticated;
do $$
begin
  if public.my_feature_enabled('calendar') then raise exception 'FAIL [other company still off]'; end if;
end;
$$;
reset role;

select 'ok' as calendar_switch_068;
rollback;
