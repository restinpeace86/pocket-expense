-- =============================================================================
-- 089_company_forms.sql — 회사 양식 등록 (8-104 B, migration 140)
-- 관리자만(직원 막힘) / 채팅 파일 확인 / 시작: 내 회사 경로만 / 칸 1장(결제 꺼진 동안) → 두 번째 새 양식 SLOTS_FULL /
-- 휴가신청서는 하나(두 번째는 새 버전으로 옮김) / 읽기 3번까지 / 정할 칸이 남으면 등록 막힘 / 직원 입력 칸 수 /
-- 등록 → 버전 / 고치기 → 새 버전(칸 그대로) / 지우기 → 칸이 빔 / 읽기 범위(직원은 등록된 것만) / 회사 격리 / 서버 전용 함수 / 추가 신청·운영자 칸 늘리기
-- =============================================================================
begin;
-- 158(D-271): 결제 연동 전 칸(프로)이 5장이 됐지만, 칸이 다 차는 흐름을 보려고 이 테스트 안에서만 1장
update public.billing_plans set form_slots = 1 where code = 'standard';
create function public._t_raises89(p_sql text, p_code text, p_label text)
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
grant execute on function public._t_raises89(text, text, text) to authenticated;
create function public._t_as89(p_uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
end;
$$;

insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at) values
  ('a8900000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'boss89@test.local', now()),
  ('a8900000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'emp89@test.local', now()),
  ('a8900000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bboss89@test.local', now());
insert into public.companies (id, name, invite_code, business_number) values
  ('c8900000-0000-0000-0000-00000000000a', '양식A', 'FMAAAAAA', '1000000891'),
  ('c8900000-0000-0000-0000-00000000000b', '양식B', 'FMBBBBBB', '1000000892');
insert into public.members (id, auth_user_id, company_id, name, phone, role, status, privacy_agreed_at, approved_at) values
  ('a8910000-0000-0000-0000-000000000001', 'a8900000-0000-0000-0000-000000000001', 'c8900000-0000-0000-0000-00000000000a', 'A대표', '01098901001', 'super_admin', 'approved', now(), now()),
  ('a8910000-0000-0000-0000-000000000002', 'a8900000-0000-0000-0000-000000000002', 'c8900000-0000-0000-0000-00000000000a', 'A직원', '01098901002', 'employee', 'approved', now(), now()),
  ('a8910000-0000-0000-0000-000000000004', 'a8900000-0000-0000-0000-000000000004', 'c8900000-0000-0000-0000-00000000000b', 'B대표', '01098901004', 'super_admin', 'approved', now(), now());
insert into public.company_features (company_id, feature, enabled) values ('c8900000-0000-0000-0000-00000000000a', 'messenger', true)
on conflict (company_id, feature) do update set enabled = true;
insert into public.chat_rooms (id, company_id, kind, title, created_by_member_id) values
  ('c8920000-0000-0000-0000-000000000001', 'c8900000-0000-0000-0000-00000000000a', 'group', '총무', 'a8910000-0000-0000-0000-000000000001');
insert into public.chat_members (room_id, company_id, member_id) values
  ('c8920000-0000-0000-0000-000000000001', 'c8900000-0000-0000-0000-00000000000a', 'a8910000-0000-0000-0000-000000000001'),
  ('c8920000-0000-0000-0000-000000000001', 'c8900000-0000-0000-0000-00000000000a', 'a8910000-0000-0000-0000-000000000002');
insert into public.chat_messages (id, room_id, company_id, sender_member_id, kind, body, attachment_path, attachment_name, attachment_size, attachment_mime) values
  ('c8930000-0000-0000-0000-000000000001', 'c8920000-0000-0000-0000-000000000001', 'c8900000-0000-0000-0000-00000000000a', 'a8910000-0000-0000-0000-000000000002', 'image', null, 'c8900000-0000-0000-0000-00000000000a/c8920000-0000-0000-0000-000000000001/m1.jpg', '휴가신청서.jpg', 300000, 'image/jpeg');

-- 표 한 장(2×2) + 칸 두 개(하나는 정해 주세요)
create function public._t_sheets89() returns jsonb language sql as $$
  select '{"v":1,"sheets":[{"name":"1쪽","cols":[50,50],"heights":[1,1],"cells":[[{"t":"성명"},{"t":""}],[{"t":"대행자"},{"t":""}]],"merges":[]}]}'::jsonb
$$;
grant execute on function public._t_sheets89() to authenticated;

-- ① 직원은 모두 막힘
select public._t_as89('a8900000-0000-0000-0000-000000000002');
set local role authenticated;
select public._t_raises89($q$select public.company_form_slots()$q$, '42501', 'employee slots');
select public._t_raises89($q$select public.company_form_check('c8930000-0000-0000-0000-000000000001')$q$, '42501', 'employee check');
select public._t_raises89($q$select public.company_form_start(gen_random_uuid(), null, 'x', 'image/jpeg', 'x', 'x')$q$, '42501', 'employee start');
select public._t_raises89($q$select public.form_slot_request()$q$, '42501', 'employee request');
select public._t_raises89($q$select public.company_form_due()$q$, '42501', 'due blocked');
select public._t_raises89($q$select public.form_slot_grant('c8900000-0000-0000-0000-00000000000a', 1)$q$, '42501', 'grant blocked');
reset role;

-- ② 관리자: 칸 1장, 채팅 파일 확인, 시작(경로 검사)
select public._t_as89('a8900000-0000-0000-0000-000000000001');
set local role authenticated;
do $$
declare v jsonb;
begin
  v := public.company_form_slots();
  if (v ->> 'limit')::int <> 1 or (v ->> 'used')::int <> 0 or (v ->> 'requested')::boolean then raise exception 'FAIL [slots %]', v; end if;
  v := public.company_form_check('c8930000-0000-0000-0000-000000000001');
  if v ->> 'path' not like '%/m1.jpg' then raise exception 'FAIL [check %]', v; end if;
  perform public._t_raises89($q$select public.company_form_start('f8900000-0000-0000-0000-000000000001', null, '휴가', 'image/jpeg', 'c8900000-0000-0000-0000-00000000000b/f8900000-0000-0000-0000-000000000001.jpg', 'a.jpg')$q$, 'INVALID_FILE', 'other company path');
  v := public.company_form_start('f8900000-0000-0000-0000-000000000001', null, '휴가', 'image/jpeg', 'c8900000-0000-0000-0000-00000000000a/f8900000-0000-0000-0000-000000000001.jpg', 'a.jpg');
  if v ->> 'id' <> 'f8900000-0000-0000-0000-000000000001' then raise exception 'FAIL [start %]', v; end if;
  -- 읽기 전에는 등록 못 함
  perform public._t_raises89($q$select public.company_form_publish('f8900000-0000-0000-0000-000000000001')$q$, 'NOT_READ', 'publish before read');
  v := public.company_form_read_begin('f8900000-0000-0000-0000-000000000001', 'leave');
  if v ->> 'path' not like '%f8900000-0000-0000-0000-000000000001.jpg' then raise exception 'FAIL [read_begin %]', v; end if;
  perform public.company_form_read_done('f8900000-0000-0000-0000-000000000001', '휴가신청서', public._t_sheets89(),
    '[{"key":"f1","label":"성명","s":0,"r":0,"c":1,"b":{"k":"data","src":"member.name"}},{"key":"f2","label":"대행자","s":0,"r":1,"c":1,"b":{"k":"pending"}}]');
  if (select name from public.company_forms where id = 'f8900000-0000-0000-0000-000000000001') <> '휴가신청서' then raise exception 'FAIL [ai name]'; end if;
  -- 정할 칸이 남으면 등록 막힘
  perform public._t_raises89($q$select public.company_form_publish('f8900000-0000-0000-0000-000000000001')$q$, 'FIELDS_PENDING', 'pending');
  -- 직원 입력 6개(휴가 최대 5)
  perform public.company_form_save('f8900000-0000-0000-0000-000000000001', '휴가신청서', public._t_sheets89(),
    (select jsonb_agg(jsonb_build_object('key', 'i' || g, 'label', 'x', 's', 0, 'r', 0, 'c', 0, 'b', jsonb_build_object('k', 'input', 'type', 'text', 'required', false))) from generate_series(1, 6) g));
  perform public._t_raises89($q$select public.company_form_publish('f8900000-0000-0000-0000-000000000001')$q$, 'TOO_MANY_INPUTS', 'inputs');
  perform public._t_raises89($q$select public.company_form_save('f8900000-0000-0000-0000-000000000001', '  ', public._t_sheets89(), '[]')$q$, 'INVALID_NAME', 'empty name');
  perform public.company_form_save('f8900000-0000-0000-0000-000000000001', '우리 휴가신청서', public._t_sheets89(),
    '[{"key":"f1","label":"성명","s":0,"r":0,"c":1,"b":{"k":"data","src":"member.name"}},{"key":"f2","label":"대행자","s":0,"r":1,"c":1,"b":{"k":"input","type":"member","required":true}}]');
  v := public.company_form_publish('f8900000-0000-0000-0000-000000000001');
  if (v ->> 'version')::int <> 1 then raise exception 'FAIL [publish %]', v; end if;
  v := public.company_form_slots();
  if (v ->> 'used')::int <> 1 then raise exception 'FAIL [used %]', v; end if;
end;
$$;
reset role;

-- ③ 칸이 다 참: 일반 결재 문서 새 양식은 SLOTS_FULL, 휴가신청서는 기존 양식의 새 버전으로(무료)
select public._t_as89('a8900000-0000-0000-0000-000000000001');
set local role authenticated;
do $$
declare v jsonb; v_g uuid;
begin
  perform public.company_form_start('f8900000-0000-0000-0000-000000000002', null, '품의서', 'application/pdf', 'c8900000-0000-0000-0000-00000000000a/f8900000-0000-0000-0000-000000000002.pdf', 'b.pdf');
  perform public._t_raises89($q$select public.company_form_read_begin('f8900000-0000-0000-0000-000000000002', 'general')$q$, 'SLOTS_FULL', 'slots full');
  perform public._t_raises89($q$select public.company_form_read_begin('f8900000-0000-0000-0000-000000000002', 'nope')$q$, 'INVALID_KIND', 'kind');
  v := public.company_form_read_begin('f8900000-0000-0000-0000-000000000002', 'leave');
  select group_id into v_g from public.company_forms where id = 'f8900000-0000-0000-0000-000000000002';
  if v_g <> 'f8900000-0000-0000-0000-000000000001' then raise exception 'FAIL [moved to leave group %]', v_g; end if;
  if (select name from public.company_forms where id = 'f8900000-0000-0000-0000-000000000002') <> '우리 휴가신청서' then raise exception 'FAIL [keeps name]'; end if;
  -- 읽기 3번까지
  perform public.company_form_read_done('f8900000-0000-0000-0000-000000000002', 'AI 제목', public._t_sheets89(), '[]');
  if (select name from public.company_forms where id = 'f8900000-0000-0000-0000-000000000002') <> '우리 휴가신청서' then raise exception 'FAIL [new version keeps name]'; end if;
  perform public.company_form_read_begin('f8900000-0000-0000-0000-000000000002', 'leave');
  perform public.company_form_read_done('f8900000-0000-0000-0000-000000000002', 'x', public._t_sheets89(), '[]');
  perform public.company_form_read_begin('f8900000-0000-0000-0000-000000000002', 'leave');
  perform public.company_form_read_done('f8900000-0000-0000-0000-000000000002', 'x', public._t_sheets89(), '[]');
  perform public._t_raises89($q$select public.company_form_read_begin('f8900000-0000-0000-0000-000000000002', 'leave')$q$, 'READS_USED', 'reads used');
  -- 새 버전 등록 → v2, 칸 그대로 1장
  v := public.company_form_publish('f8900000-0000-0000-0000-000000000002');
  if (v ->> 'version')::int <> 2 then raise exception 'FAIL [v2 %]', v; end if;
  if (select status from public.company_forms where id = 'f8900000-0000-0000-0000-000000000001') <> 'old' then raise exception 'FAIL [v1 old]'; end if;
  if (public.company_form_slots() ->> 'used')::int <> 1 then raise exception 'FAIL [still 1]'; end if;
  -- 고치기: 초안 복사(같은 초안 다시), 등록하면 v3
  v_g := public.company_form_edit('f8900000-0000-0000-0000-000000000001');
  if v_g <> public.company_form_edit('f8900000-0000-0000-0000-000000000001') then raise exception 'FAIL [edit reuses draft]'; end if;
  v := public.company_form_publish(v_g);
  if (v ->> 'version')::int <> 3 then raise exception 'FAIL [v3 %]', v; end if;
  -- 추가 신청(두 번 눌러도 하나)
  perform public.form_slot_request();
  perform public.form_slot_request();
  if (select count(*) from public.form_slot_requests where company_id = 'c8900000-0000-0000-0000-00000000000a') <> 1 then raise exception 'FAIL [one request]'; end if;
  if not (public.company_form_slots() ->> 'requested')::boolean then raise exception 'FAIL [requested]'; end if;
end;
$$;
reset role;

-- ④ 직원 읽기: 등록된 것(active·old)만, 초안·신청은 안 보임
select public._t_as89('a8900000-0000-0000-0000-000000000001');
set local role authenticated;
select public.company_form_start('f8900000-0000-0000-0000-000000000003', null, '대기', 'image/png', 'c8900000-0000-0000-0000-00000000000a/f8900000-0000-0000-0000-000000000003.png', 'c.png');
reset role;
select public._t_as89('a8900000-0000-0000-0000-000000000002');
set local role authenticated;
do $$
begin
  if (select count(*) from public.company_forms) <> 3 then raise exception 'FAIL [employee sees % forms]', (select count(*) from public.company_forms); end if;
  if exists (select 1 from public.company_forms where status = 'draft') then raise exception 'FAIL [employee sees draft]'; end if;
  if exists (select 1 from public.form_slot_requests) then raise exception 'FAIL [employee sees request]'; end if;
end;
$$;
reset role;

-- ⑤ 회사 격리: B 대표는 A 양식을 못 보고 못 바꿈
select public._t_as89('a8900000-0000-0000-0000-000000000004');
set local role authenticated;
do $$
begin
  if exists (select 1 from public.company_forms) then raise exception 'FAIL [B sees A forms]'; end if;
  perform public._t_raises89($q$select public.company_form_check('c8930000-0000-0000-0000-000000000001')$q$, 'NOT_FOUND', 'B check');
  perform public._t_raises89($q$select public.company_form_edit('f8900000-0000-0000-0000-000000000001')$q$, 'NOT_FOUND', 'B edit');
  perform public._t_raises89($q$select public.company_form_delete('f8900000-0000-0000-0000-000000000003')$q$, 'NOT_FOUND', 'B delete');
  perform public._t_raises89($q$select public.company_form_publish('f8900000-0000-0000-0000-000000000003')$q$, 'NOT_FOUND', 'B publish');
  perform public._t_raises89($q$select public.company_form_save('f8900000-0000-0000-0000-000000000003', 'x', public._t_sheets89(), '[]')$q$, 'NOT_FOUND', 'B save');
  perform public._t_raises89($q$select public.company_form_read_begin('f8900000-0000-0000-0000-000000000003', 'general')$q$, 'NOT_FOUND', 'B read');
  perform public._t_raises89($q$insert into public.company_forms (id, company_id, group_id, name, source_path, mime) values (gen_random_uuid(), 'c8900000-0000-0000-0000-00000000000b', gen_random_uuid(), 'x', 'x', 'image/png')$q$, '42501', 'direct insert');
  if (public.company_form_slots() ->> 'used')::int <> 0 then raise exception 'FAIL [B used]'; end if;
end;
$$;
reset role;

-- ⑥ 운영자 칸 늘리기 → 신청 처리, 새 양식 가능 / 지우기 → 칸이 빔, 초안 원본 경로
do $$
declare v int;
begin
  v := public.form_slot_grant('c8900000-0000-0000-0000-00000000000a', 1);
  if v <> 1 then raise exception 'FAIL [extra %]', v; end if;
  if exists (select 1 from public.form_slot_requests where company_id = 'c8900000-0000-0000-0000-00000000000a' and status = 'received') then raise exception 'FAIL [request done]'; end if;
end;
$$;
select public._t_as89('a8900000-0000-0000-0000-000000000001');
set local role authenticated;
do $$
declare v jsonb; p text;
begin
  if (public.company_form_slots() ->> 'limit')::int <> 2 then raise exception 'FAIL [limit 2]'; end if;
  v := public.company_form_read_begin('f8900000-0000-0000-0000-000000000003', 'general');
  perform public.company_form_read_done('f8900000-0000-0000-0000-000000000003', '품의서', public._t_sheets89(), '[]');
  perform public.company_form_publish('f8900000-0000-0000-0000-000000000003');
  if (public.company_form_slots() ->> 'used')::int <> 2 then raise exception 'FAIL [used 2]'; end if;
  -- 등록된 양식 지우기: 모든 버전 deleted, 칸 빔
  p := public.company_form_delete('f8900000-0000-0000-0000-000000000003');
  if p is not null then raise exception 'FAIL [active delete returns path]'; end if;
  if (public.company_form_slots() ->> 'used')::int <> 1 then raise exception 'FAIL [freed]'; end if;
  -- 초안 지우기: 원본 경로(다른 버전이 안 쓰면)
  perform public.company_form_start('f8900000-0000-0000-0000-000000000004', null, 'x', 'image/png', 'c8900000-0000-0000-0000-00000000000a/f8900000-0000-0000-0000-000000000004.png', 'd.png');
  p := public.company_form_delete('f8900000-0000-0000-0000-000000000004');
  if p is distinct from 'c8900000-0000-0000-0000-00000000000a/f8900000-0000-0000-0000-000000000004.png' then raise exception 'FAIL [draft path %]', p; end if;
  -- 고치기 초안은 지금 버전과 같은 파일 → 지워도 경로 없음
  p := public.company_form_delete(public.company_form_edit('f8900000-0000-0000-0000-000000000001'));
  if p is not null then raise exception 'FAIL [shared file kept]'; end if;
end;
$$;
reset role;

-- ⑦ 새벽 정리: 30일 지난 초안
select public._t_as89('a8900000-0000-0000-0000-000000000001');
set local role authenticated;
select public.company_form_start('f8900000-0000-0000-0000-000000000005', null, 'x', 'image/png', 'c8900000-0000-0000-0000-00000000000a/f8900000-0000-0000-0000-000000000005.png', 'e.png');
reset role;
update public.company_forms set updated_at = now() - interval '31 days' where id = 'f8900000-0000-0000-0000-000000000005';
do $$
declare v jsonb;
begin
  v := public.company_form_due();
  if not (v ? 'c8900000-0000-0000-0000-00000000000a/f8900000-0000-0000-0000-000000000005.png') then raise exception 'FAIL [due %]', v; end if;
  if exists (select 1 from public.company_forms where id = 'f8900000-0000-0000-0000-000000000005') then raise exception 'FAIL [due deleted]'; end if;
end;
$$;

select 'ok' as company_forms_089;
rollback;
