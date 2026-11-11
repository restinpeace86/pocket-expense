-- 091_leave_company_form.sql — 휴가신청서를 회사 양식으로 (8-104 C, migration 147)
-- 양식이 없으면 그대로 / 있으면 쓴 양식 버전 + 직원 입력 칸만 저장 / 필수·선택지·직원 고르기(같은 회사만 → 이름) / 신청 뒤 못 바꿈
begin;
create function public._t_raises91(p_sql text, p_code text, p_label text)
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
grant execute on function public._t_raises91(text, text, text) to authenticated;
create function public._t_as91(p_uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
end;
$$;
create function public._t_d91(n integer) returns text language sql as $$ select ((now() at time zone 'Asia/Seoul')::date + n)::text $$;
grant execute on function public._t_d91(integer) to authenticated;
create function public._t_annual91() returns uuid language sql as $$
  select id from public.attendance_leave_types where company_id = 'c9100000-0000-0000-0000-00000000000a' and builtin_key = 'annual'
$$;
grant execute on function public._t_annual91() to authenticated;
create function public._t_leave91(p_start text, p_custom jsonb) returns uuid language sql as $$
  select (public.attendance_leave_create(jsonb_build_object('type_id', public._t_annual91(), 'start_date', p_start, 'custom', p_custom)) ->> 'id')::uuid
$$;
grant execute on function public._t_leave91(text, jsonb) to authenticated;

insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at) values
  ('a9100000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'boss91@test.local', now()),
  ('a9100000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'emp91@test.local', now()),
  ('a9100000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bboss91@test.local', now());
insert into public.companies (id, name, invite_code, business_number) values
  ('c9100000-0000-0000-0000-00000000000a', '양식휴가A', 'LFAAAAAA', '1000000911'),
  ('c9100000-0000-0000-0000-00000000000b', '양식휴가B', 'LFBBBBBB', '1000000912');
insert into public.members (id, auth_user_id, company_id, name, phone, role, status, privacy_agreed_at, approved_at) values
  ('a9110000-0000-0000-0000-000000000001', 'a9100000-0000-0000-0000-000000000001', 'c9100000-0000-0000-0000-00000000000a', 'A대표', '01099101001', 'super_admin', 'approved', now(), now()),
  ('a9110000-0000-0000-0000-000000000002', 'a9100000-0000-0000-0000-000000000002', 'c9100000-0000-0000-0000-00000000000a', 'A직원', '01099101002', 'employee', 'approved', now(), now()),
  ('a9110000-0000-0000-0000-000000000003', 'a9100000-0000-0000-0000-000000000003', 'c9100000-0000-0000-0000-00000000000b', 'B대표', '01099101003', 'super_admin', 'approved', now(), now());
insert into public.company_features (company_id, feature, enabled) values ('c9100000-0000-0000-0000-00000000000a', 'attendance', true)
  on conflict (company_id, feature) do update set enabled = true;
insert into public.attendance_settings (company_id, work_days) values ('c9100000-0000-0000-0000-00000000000a', '{1,2,3,4,5,6,7}');
delete from public.kr_holidays where day between (now() at time zone 'Asia/Seoul')::date - 40 and (now() at time zone 'Asia/Seoul')::date + 400;
insert into public.attendance_leave_grants (company_id, member_id, period_start, period_end, granted_days) values
  ('c9100000-0000-0000-0000-00000000000a', 'a9110000-0000-0000-0000-000000000002', date_trunc('month', now() at time zone 'Asia/Seoul')::date, date_trunc('month', now() at time zone 'Asia/Seoul')::date + 364, 10);
select private.attendance_leave_types_ensure('c9100000-0000-0000-0000-00000000000a');

-- ① 양식이 없으면 지금처럼(form_id 없음, 추가 항목 무시)
select public._t_as91('a9100000-0000-0000-0000-000000000002');
set local role authenticated;
do $$
begin
  perform set_config('t.l1', public._t_leave91(public._t_d91(1), '{"x":"y"}'::jsonb)::text, true);
end;
$$;
reset role;
do $$
begin
  if (select form_id is not null or custom_payload <> '{}'::jsonb from public.attendance_leaves where id = current_setting('t.l1')::uuid) then raise exception 'FAIL [no form]'; end if;
end;
$$;

-- ② 회사 휴가신청서(active): 직원 입력 4칸(대행자 = 직원 고르기·필수, 연락처 = 글·필수, 구분 = 선택지, 메모 = 긴 글) + 우리 데이터 칸
insert into public.company_forms (id, company_id, group_id, version, kind, name, status, sheets, fields, reads, published_at, source_path, mime)
values ('f9100000-0000-0000-0000-000000000001', 'c9100000-0000-0000-0000-00000000000a', 'f9100000-0000-0000-0000-000000000001', 1, 'leave', '휴가신청서', 'active',
  '{"v":1,"sheets":[{"name":"1쪽","cols":[50,50],"heights":[1,1,1,1,1],"cells":[[{"t":"성명"},{"t":""}],[{"t":"대행자"},{"t":""}],[{"t":"연락처"},{"t":""}],[{"t":"구분"},{"t":""}],[{"t":"메모"},{"t":""}]],"merges":[]}]}'::jsonb,
  '[{"key":"f1","label":"성명","s":0,"r":0,"c":1,"b":{"k":"data","src":"member.name"}},
    {"key":"f2","label":"대행자","s":0,"r":1,"c":1,"b":{"k":"input","type":"member","required":true}},
    {"key":"f3","label":"연락처","s":0,"r":2,"c":1,"b":{"k":"input","type":"text","required":true}},
    {"key":"f4","label":"구분","s":0,"r":3,"c":1,"b":{"k":"input","type":"choice","required":false,"options":["오전","오후"]}},
    {"key":"f5","label":"메모","s":0,"r":4,"c":1,"b":{"k":"input","type":"long","required":false}}]'::jsonb, 1, now(), 'c9100000-0000-0000-0000-00000000000a/f9100000-0000-0000-0000-000000000001.png', 'image/png');
select public._t_as91('a9100000-0000-0000-0000-000000000002');
set local role authenticated;
do $$
begin
  perform public._t_raises91($q$select public._t_leave91(public._t_d91(2), '{"f3":"010"}')$q$, 'CUSTOM_REQUIRED', 'required');
  perform public._t_raises91($q$select public._t_leave91(public._t_d91(2), '{"f2":"a9110000-0000-0000-0000-000000000003","f3":"010"}')$q$, 'CUSTOM_INVALID', 'other company member');
  perform public._t_raises91($q$select public._t_leave91(public._t_d91(2), '{"f2":"a9110000-0000-0000-0000-000000000001","f3":"010","f4":"저녁"}')$q$, 'CUSTOM_INVALID', 'choice');
  perform set_config('t.l2', public._t_leave91(public._t_d91(2), '{"f2":"a9110000-0000-0000-0000-000000000001","f3":" 010-1234-5678 ","f4":"오전","f1":"끼워넣기","zz":"x"}'::jsonb)::text, true);
end;
$$;
reset role;
do $$
declare l public.attendance_leaves;
begin
  select * into l from public.attendance_leaves where id = current_setting('t.l2')::uuid;
  if l.form_id <> 'f9100000-0000-0000-0000-000000000001' then raise exception 'FAIL [form id]'; end if;
  if l.custom_payload <> '{"f2":"A대표","f3":"010-1234-5678","f4":"오전"}'::jsonb then raise exception 'FAIL [payload %]', l.custom_payload; end if;
  if l.remaining_days <> 9 then raise exception 'FAIL [remaining %]', l.remaining_days; end if; -- 10일 중 ①에서 1일 신청(대기) → 신청할 때 9일
end;
$$;

-- ③ 신청 뒤 추가 항목은 못 바꿈, 승인은 됨
do $$
begin
  perform public._t_raises91(format($q$update public.attendance_leaves set custom_payload = '{}' where id = '%s'$q$, current_setting('t.l2')), 'HISTORY_LOCKED', 'locked payload');
end;
$$;
select public._t_as91('a9100000-0000-0000-0000-000000000001');
set local role authenticated;
do $$
begin
  perform public.attendance_leave_decide(current_setting('t.l2')::uuid, true, null);
end;
$$;
reset role;
do $$
begin
  if (select status from public.attendance_leaves where id = current_setting('t.l2')::uuid) <> 'approved' then raise exception 'FAIL [approve]'; end if;
end;
$$;

select 'ok' as leave_company_form_091;
rollback;
