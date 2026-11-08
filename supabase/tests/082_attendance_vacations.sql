-- =============================================================================
-- 082_attendance_vacations.sql — 근태 ⑦ 휴가 신청·취소 (D-241, migration 130)
-- 종류 기본 9가지 / 신청 검사(이번 달·겹침·근무일·시간 단위·연차 기간·모자람: 막기↔당겨쓰기) / 승인자 규칙 /
-- 증빙(필수면 첨부 전 승인 불가·동의 필수·받지 않는 종류) / 취소(대기 바로·승인 뒤 취소 신청) / 기록 잠금 / 캘린더 표시 범위 / 회사 격리
-- 날짜는 오늘 + n일(근무 요일 모두·공휴일 비움)로 잡아 언제 돌려도 같다
-- =============================================================================
begin;

create function public._t_raises82(p_sql text, p_code text, p_label text)
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
grant execute on function public._t_raises82(text, text, text) to authenticated;
create function public._t_as82(p_uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
end;
$$;
create function public._t_d82(n integer) returns text language sql as $$ select ((now() at time zone 'Asia/Seoul')::date + n)::text $$;
grant execute on function public._t_d82(integer) to authenticated;
create function public._t_type82(p_key text) returns uuid language sql as $$
  select id from public.attendance_leave_types where company_id = 'c8300000-0000-0000-0000-00000000000a' and builtin_key = p_key
$$;
grant execute on function public._t_type82(text) to authenticated;

insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at) values
  ('a8300000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'boss82@test.local', now()),
  ('a8300000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'adm82@test.local', now()),
  ('a8300000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'emp82@test.local', now()),
  ('a8300000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'emp82b@test.local', now()),
  ('a8300000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bboss82@test.local', now());
insert into public.companies (id, name, invite_code, business_number) values
  ('c8300000-0000-0000-0000-00000000000a', '휴가A', 'VCAAAAAA', '1000000821'),
  ('c8300000-0000-0000-0000-00000000000b', '휴가B', 'VCBBBBBB', '1000000822');
insert into public.members (id, auth_user_id, company_id, name, phone, role, status, privacy_agreed_at, approved_at) values
  ('a8310000-0000-0000-0000-000000000001', 'a8300000-0000-0000-0000-000000000001', 'c8300000-0000-0000-0000-00000000000a', 'A대표', '01098201001', 'super_admin', 'approved', now(), now()),
  ('a8310000-0000-0000-0000-000000000002', 'a8300000-0000-0000-0000-000000000002', 'c8300000-0000-0000-0000-00000000000a', 'A관리', '01098201002', 'admin', 'approved', now(), now()),
  ('a8310000-0000-0000-0000-000000000003', 'a8300000-0000-0000-0000-000000000003', 'c8300000-0000-0000-0000-00000000000a', 'A직원', '01098201003', 'employee', 'approved', now(), now()),
  ('a8310000-0000-0000-0000-000000000004', 'a8300000-0000-0000-0000-000000000004', 'c8300000-0000-0000-0000-00000000000a', 'A직원2', '01098201004', 'employee', 'approved', now(), now()),
  ('a8310000-0000-0000-0000-000000000005', 'a8300000-0000-0000-0000-000000000005', 'c8300000-0000-0000-0000-00000000000b', 'B대표', '01098201005', 'super_admin', 'approved', now(), now());
insert into public.company_features (company_id, feature, enabled) values
  ('c8300000-0000-0000-0000-00000000000a', 'attendance', true), ('c8300000-0000-0000-0000-00000000000a', 'messenger', true),
  ('c8300000-0000-0000-0000-00000000000b', 'attendance', true)
  on conflict (company_id, feature) do update set enabled = true;
insert into public.attendance_settings (company_id, work_days) values ('c8300000-0000-0000-0000-00000000000a', '{1,2,3,4,5,6,7}'), ('c8300000-0000-0000-0000-00000000000b', '{1,2,3,4,5,6,7}');
delete from public.kr_holidays where day between (now() at time zone 'Asia/Seoul')::date - 40 and (now() at time zone 'Asia/Seoul')::date + 400;
-- 연차 확정: 이번 달 1일부터 1년, 3일(직원) · 15일(관리자·대표)
insert into public.attendance_leave_grants (company_id, member_id, period_start, period_end, granted_days) values
  ('c8300000-0000-0000-0000-00000000000a', 'a8310000-0000-0000-0000-000000000003', date_trunc('month', now() at time zone 'Asia/Seoul')::date, date_trunc('month', now() at time zone 'Asia/Seoul')::date + 364, 3),
  ('c8300000-0000-0000-0000-00000000000a', 'a8310000-0000-0000-0000-000000000002', date_trunc('month', now() at time zone 'Asia/Seoul')::date, date_trunc('month', now() at time zone 'Asia/Seoul')::date + 364, 15),
  ('c8300000-0000-0000-0000-00000000000a', 'a8310000-0000-0000-0000-000000000001', date_trunc('month', now() at time zone 'Asia/Seoul')::date, date_trunc('month', now() at time zone 'Asia/Seoul')::date + 364, 15);

-- ① 종류: 기본 9가지 · 연차는 못 바꿈 · 끄기·이력
select public._t_as82('a8300000-0000-0000-0000-000000000001');
set local role authenticated;
do $$
declare v jsonb;
begin
  v := public.attendance_leave_types_list();
  if jsonb_array_length(v -> 'types') <> 9 then raise exception 'FAIL [9 types %]', jsonb_array_length(v -> 'types'); end if;
  perform public._t_raises82(format($q$select public.attendance_leave_type_save('{"id":"%s","name":"연차","enabled":false}')$q$, public._t_type82('annual')), 'ANNUAL_LOCKED', 'annual locked');
  perform public.attendance_leave_type_save(jsonb_build_object('id', public._t_type82('family_care'), 'name', '가족돌봄휴가', 'paid', 'unpaid', 'enabled', false));
  -- 증빙 고정: 바꾸려 해도 그대로
  perform public.attendance_leave_type_save(jsonb_build_object('id', public._t_type82('sick'), 'name', '병가', 'paid', 'paid', 'proof', 'none'));
  perform public.attendance_leave_type_save('{"name":"포상휴가","paid":"paid","proof":"optional"}');
end;
$$;
reset role;
do $$
begin
  if (select proof from public.attendance_leave_types where id = public._t_type82('sick')) <> 'required' then raise exception 'FAIL [proof locked]'; end if;
  if (select enabled from public.attendance_leave_types where id = public._t_type82('family_care')) then raise exception 'FAIL [off]'; end if;
  if (select count(*) from public.attendance_history where company_id = 'c8300000-0000-0000-0000-00000000000a' and action = 'leave_type') <> 3 then raise exception 'FAIL [type history]'; end if;
end;
$$;

-- ② 직원 신청 검사
select public._t_as82('a8300000-0000-0000-0000-000000000003');
set local role authenticated;
do $$
declare v jsonb;
begin
  perform public._t_raises82(format($q$select public.attendance_leave_create('{"type_id":"%s","start_date":"%s"}')$q$, public._t_type82('family_care'), public._t_d82(3)), 'TYPE_OFF', 'type off');
  perform public._t_raises82(format($q$select public.attendance_leave_create('{"type_id":"%s","start_date":"%s"}')$q$, public._t_type82('annual'), (date_trunc('month', now() at time zone 'Asia/Seoul')::date - 1)), 'OUT_OF_RANGE', 'last month');
  perform public._t_raises82(format($q$select public.attendance_leave_create('{"type_id":"%s","unit":"hour","start_date":"%s","start_time":"14:00","hours":4}')$q$, public._t_type82('annual'), public._t_d82(3)), 'HOURS_OFF', 'hourly off');
  perform public._t_raises82(format($q$select public.attendance_leave_create('{"type_id":"%s","start_date":"%s","end_date":"%s"}')$q$, public._t_type82('annual'), public._t_d82(3), public._t_d82(6)), 'NOT_ENOUGH', 'not enough (4 > 3)');
  v := public.attendance_leave_create(jsonb_build_object('type_id', public._t_type82('annual'), 'start_date', public._t_d82(3), 'end_date', public._t_d82(4)));
  if v ->> 'status' <> 'pending' then raise exception 'FAIL [pending]'; end if;
  perform set_config('t.l1', v ->> 'id', true);
  perform public._t_raises82(format($q$select public.attendance_leave_create('{"type_id":"%s","start_date":"%s"}')$q$, public._t_type82('annual'), public._t_d82(4)), 'OVERLAP', 'overlap');
  perform public._t_raises82(format($q$select public.attendance_leave_create('{"type_id":"%s","start_date":"%s","end_date":"%s"}')$q$, public._t_type82('annual'), public._t_d82(10), public._t_d82(11)), 'NOT_ENOUGH', 'pending counts');
  -- 증빙 필수 종류(병가) · 받지 않는 종류(생리휴가)
  v := public.attendance_leave_create(jsonb_build_object('type_id', public._t_type82('sick'), 'start_date', public._t_d82(8)));
  perform set_config('t.sick', v ->> 'id', true);
  v := public.attendance_leave_create(jsonb_build_object('type_id', public._t_type82('menstrual'), 'start_date', public._t_d82(9)));
  perform set_config('t.mens', v ->> 'id', true);
  if (select deduct_days from public.attendance_leaves where id = current_setting('t.sick')::uuid) <> 0 then raise exception 'FAIL [sick no deduct]'; end if;
end;
$$;
reset role;
do $$
begin
  if (select count(*) from public.chat_messages m join public.chat_rooms r on r.id = m.room_id
      where r.notice_member_id in ('a8310000-0000-0000-0000-000000000001', 'a8310000-0000-0000-0000-000000000002') and m.body like '휴가 신청이 왔어요%A직원%') <> 6 then
    raise exception 'FAIL [notify approvers x3 each]';
  end if;
  perform public._t_raises82(format($q$update public.attendance_leaves set end_date = start_date + 5 where id = '%s'$q$, current_setting('t.l1')), 'HISTORY_LOCKED', 'core locked');
end;
$$;

-- ③ 관리자: 반려는 사유 필수 · 증빙 없으면 승인 불가 · 승인
select public._t_as82('a8300000-0000-0000-0000-000000000002');
set local role authenticated;
do $$
begin
  if public.attendance_pending_count() <> 3 then raise exception 'FAIL [badge %]', public.attendance_pending_count(); end if;
  perform public._t_raises82(format($q$select public.attendance_leave_decide('%s', false, ' ')$q$, current_setting('t.l1')), 'REASON_REQUIRED', 'reject reason');
  perform public._t_raises82(format($q$select public.attendance_leave_decide('%s', true, null)$q$, current_setting('t.sick')), 'PROOF_REQUIRED', 'proof required');
  perform public.attendance_leave_decide(current_setting('t.l1')::uuid, true, null);
  perform public.attendance_leave_decide(current_setting('t.mens')::uuid, true, null);
end;
$$;
reset role;

-- ④ 직원: 증빙 올리기(동의 필수) → 승인 가능 · 받지 않는 종류는 못 올림
insert into storage.objects (bucket_id, name, metadata) values
  ('leave-proofs', 'c8300000-0000-0000-0000-00000000000a/a8310000-0000-0000-0000-000000000003/' || current_setting('t.sick') || '/a.jpg', '{"size": 1000}');
select public._t_as82('a8300000-0000-0000-0000-000000000003');
set local role authenticated;
do $$
declare v_path text := 'c8300000-0000-0000-0000-00000000000a/a8310000-0000-0000-0000-000000000003/' || current_setting('t.sick') || '/a.jpg';
begin
  perform public._t_raises82(format($q$select public.attendance_leave_file_add('%s', '%s', '진단서.jpg', 'image/jpeg', 1000, false)$q$, current_setting('t.sick'), v_path), 'CONSENT_REQUIRED', 'consent');
  perform public._t_raises82(format($q$select public.attendance_leave_file_add('%s', '%s', 'x.jpg', 'image/jpeg', 1000, true)$q$, current_setting('t.mens'), v_path), 'NO_PROOF_TYPE', 'menstrual no proof');
  perform public._t_raises82(format($q$select public.attendance_leave_file_add('%s', '%s', 'x.jpg', 'image/jpeg', 1000, true)$q$, current_setting('t.sick'), 'c8300000-0000-0000-0000-00000000000a/a8310000-0000-0000-0000-000000000003/' || current_setting('t.sick') || '/none.jpg'), 'INVALID_FILE', 'not uploaded');
  perform public.attendance_leave_file_add(current_setting('t.sick')::uuid, v_path, '진단서.jpg', 'image/jpeg', 1000, true);
  if (select delete_after from public.attendance_leave_files where leave_id = current_setting('t.sick')::uuid) <> ((now() at time zone 'Asia/Seoul')::date + 8 + interval '3 years')::date then raise exception 'FAIL [3 years]'; end if;
end;
$$;
reset role;
select public._t_as82('a8300000-0000-0000-0000-000000000002');
set local role authenticated;
select public.attendance_leave_decide(current_setting('t.sick')::uuid, true, null);
reset role;

-- ⑤ 취소: 승인된 연차 → 취소 신청 → 승인하면 돌려받음 · 대기 중은 바로 취소
select public._t_as82('a8300000-0000-0000-0000-000000000003');
set local role authenticated;
do $$
declare v jsonb;
begin
  if (public.my_vacation(extract(year from now() at time zone 'Asia/Seoul')::int) -> 'grants' -> 0 ->> 'used')::numeric <> 2 then raise exception 'FAIL [used 2]'; end if;
  if public.attendance_leave_cancel(current_setting('t.l1')::uuid, '일정 변경') <> 'cancel_pending' then raise exception 'FAIL [cancel pending]'; end if;
  v := public.attendance_leave_create(jsonb_build_object('type_id', public._t_type82('annual'), 'start_date', public._t_d82(20)));
  if public.attendance_leave_cancel((v ->> 'id')::uuid, null) <> 'canceled' then raise exception 'FAIL [cancel now]'; end if;
end;
$$;
reset role;
select public._t_as82('a8300000-0000-0000-0000-000000000002');
set local role authenticated;
select public.attendance_leave_decide(current_setting('t.l1')::uuid, true, null);
reset role;
do $$
begin
  if (select status || '/' || cancel_status from public.attendance_leaves where id = current_setting('t.l1')::uuid) <> 'canceled/approved' then raise exception 'FAIL [cancel approved]'; end if;
  if private.attendance_leave_used('a8310000-0000-0000-0000-000000000003', date_trunc('month', now() at time zone 'Asia/Seoul')::date) <> 0 then raise exception 'FAIL [restored]'; end if;
  perform public._t_raises82(format($q$update public.attendance_leaves set status = 'approved' where id = '%s'$q$, current_setting('t.l1')), 'HISTORY_LOCKED', 'canceled locked');
end;
$$;

-- ⑥ 당겨쓰기 허용 · 시간 단위
select public._t_as82('a8300000-0000-0000-0000-000000000001');
set local role authenticated;
select public.attendance_leave_shortage_save('borrow');
select public.attendance_leave_settings_save(true, 'day');
reset role;
select public._t_as82('a8300000-0000-0000-0000-000000000003');
set local role authenticated;
do $$
declare v jsonb;
begin
  v := public.attendance_leave_create(jsonb_build_object('type_id', public._t_type82('annual'), 'start_date', public._t_d82(30), 'end_date', public._t_d82(33)));
  if v ->> 'status' <> 'pending' then raise exception 'FAIL [borrow]'; end if;
  v := public.attendance_leave_create(jsonb_build_object('type_id', public._t_type82('annual'), 'unit', 'hour', 'start_date', public._t_d82(40), 'start_time', '14:00', 'hours', 4));
  if (select deduct_days from public.attendance_leaves where id = (v ->> 'id')::uuid) <> 0.5 then raise exception 'FAIL [hour deduct]'; end if;
  perform public._t_raises82(format($q$select public.attendance_leave_create('{"type_id":"%s","unit":"hour","start_date":"%s","start_time":"10:00","hours":8}')$q$, public._t_type82('annual'), public._t_d82(41)), 'INVALID_HOURS', 'hours >= day');
end;
$$;
reset role;

-- ⑦ 승인자: 관리자 신청은 대표만 · 대표 본인 신청은 바로 승인
select public._t_as82('a8300000-0000-0000-0000-000000000002');
set local role authenticated;
select set_config('t.adm', public.attendance_leave_create(jsonb_build_object('type_id', public._t_type82('annual'), 'start_date', public._t_d82(12))) ->> 'id', true);
do $$
begin
  perform public._t_raises82(format($q$select public.attendance_leave_decide('%s', true, null)$q$, current_setting('t.adm')), 'NOT_ALLOWED', 'self');
end;
$$;
reset role;
select public._t_as82('a8300000-0000-0000-0000-000000000001');
set local role authenticated;
do $$
declare v jsonb;
begin
  perform public.attendance_leave_decide(current_setting('t.adm')::uuid, true, null);
  v := public.attendance_leave_create(jsonb_build_object('type_id', public._t_type82('annual'), 'start_date', public._t_d82(14)));
  if v ->> 'status' <> 'approved' then raise exception 'FAIL [boss self]'; end if;
  -- 대표라도 증빙 필수면 첨부 전엔 대기
  v := public.attendance_leave_create(jsonb_build_object('type_id', public._t_type82('sick'), 'start_date', public._t_d82(15)));
  if v ->> 'status' <> 'pending' then raise exception 'FAIL [boss proof wait]'; end if;
end;
$$;
reset role;

-- ⑧ 캘린더: 다른 직원에게는 "휴가"만 · 관리자는 종류까지 / 월 근태에 휴가
select public._t_as82('a8300000-0000-0000-0000-000000000004');
set local role authenticated;
do $$
declare v jsonb;
begin
  v := public.calendar_leaves_range((now() at time zone 'Asia/Seoul')::date, (now() at time zone 'Asia/Seoul')::date + 60, null);
  if exists (select 1 from jsonb_array_elements(v) e where e ->> 'label' <> '휴가') then raise exception 'FAIL [others see type %]', v; end if;
  if jsonb_array_length(v) < 3 then raise exception 'FAIL [calendar count %]', jsonb_array_length(v); end if;
  if (select count(*) from public.attendance_leaves) <> 0 then raise exception 'FAIL [other employee reads leaves]'; end if;
end;
$$;
reset role;
select public._t_as82('a8300000-0000-0000-0000-000000000002');
set local role authenticated;
do $$
begin
  if not exists (select 1 from jsonb_array_elements(public.calendar_leaves_range((now() at time zone 'Asia/Seoul')::date, (now() at time zone 'Asia/Seoul')::date + 60, null)) e where e ->> 'label' = '병가') then
    raise exception 'FAIL [admin sees type]';
  end if;
end;
$$;
reset role;

-- ⑨ 다른 회사: 못 보고 못 처리
select public._t_as82('a8300000-0000-0000-0000-000000000005');
set local role authenticated;
do $$
begin
  if (select count(*) from public.attendance_leaves) + (select count(*) from public.attendance_leave_files) + (select count(*) from public.attendance_leave_types where company_id = 'c8300000-0000-0000-0000-00000000000a') <> 0 then
    raise exception 'FAIL [cross read]';
  end if;
  perform public._t_raises82(format($q$select public.attendance_leave_decide('%s', true, null)$q$, current_setting('t.adm')), 'NOT_FOUND', 'cross decide');
  if jsonb_array_length(public.attendance_leaves_admin() -> 'pending') <> 0 then raise exception 'FAIL [cross admin list]'; end if;
end;
$$;
reset role;

select 'ok' as attendance_vacations_082;
rollback;
