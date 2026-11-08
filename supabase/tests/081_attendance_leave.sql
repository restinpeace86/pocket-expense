-- =============================================================================
-- 081_attendance_leave.sql — 근태 ⑥ 직원별 연차 (D-240, migration 128)
-- 입사일: 본인은 한 번만(가입 대기 중에도) / 관리자 수정은 사유 필수 + 이력 + 직원 알림
-- 연차 설정: 시간 단위는 시간차 켰을 때만 / 연차 확정: 법 기준보다 적으면 사유 필수(막지 않음) · 이력 / 회사 격리
-- =============================================================================
begin;

create function public._t_raises81(p_sql text, p_code text, p_label text)
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
grant execute on function public._t_raises81(text, text, text) to authenticated;
create function public._t_as81(p_uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
end;
$$;

insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at) values
  ('a8200000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'boss81@test.local', now()),
  ('a8200000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'emp81@test.local', now()),
  ('a8200000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pend81@test.local', now()),
  ('a8200000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bboss81@test.local', now());
insert into public.companies (id, name, invite_code, business_number) values
  ('c8200000-0000-0000-0000-00000000000a', '연차A', 'LVAAAAAA', '1000000811'),
  ('c8200000-0000-0000-0000-00000000000b', '연차B', 'LVBBBBBB', '1000000812');
insert into public.members (id, auth_user_id, company_id, name, phone, role, status, privacy_agreed_at, approved_at) values
  ('a8210000-0000-0000-0000-000000000001', 'a8200000-0000-0000-0000-000000000001', 'c8200000-0000-0000-0000-00000000000a', 'A대표', '01098101001', 'super_admin', 'approved', now(), now()),
  ('a8210000-0000-0000-0000-000000000002', 'a8200000-0000-0000-0000-000000000002', 'c8200000-0000-0000-0000-00000000000a', 'A직원', '01098101002', 'employee', 'approved', now(), now()),
  ('a8210000-0000-0000-0000-000000000004', 'a8200000-0000-0000-0000-000000000004', 'c8200000-0000-0000-0000-00000000000b', 'B대표', '01098101004', 'super_admin', 'approved', now(), now());
insert into public.members (id, auth_user_id, company_id, name, phone, role, status, privacy_agreed_at) values
  ('a8210000-0000-0000-0000-000000000003', 'a8200000-0000-0000-0000-000000000003', 'c8200000-0000-0000-0000-00000000000a', 'A대기', '01098101003', 'employee', 'pending', now());
insert into public.company_features (company_id, feature, enabled) values ('c8200000-0000-0000-0000-00000000000a', 'messenger', true)
  on conflict (company_id, feature) do update set enabled = true;

-- ① 본인 입사일: 가입 대기 중에도 한 번 / 미래 불가 / 두 번째는 막힘
select public._t_as81('a8200000-0000-0000-0000-000000000003');
set local role authenticated;
do $$
begin
  perform public._t_raises81($q$select public.set_my_hire_date(current_date + 30)$q$, 'INVALID_HIRE_DATE', 'future');
  perform public.set_my_hire_date('2026-03-02');
  perform public._t_raises81($q$select public.set_my_hire_date('2026-03-03')$q$, 'ALREADY_SET', 'twice');
end;
$$;
reset role;
select public._t_as81('a8200000-0000-0000-0000-000000000002');
set local role authenticated;
do $$
begin
  if public.my_hire_date() is not null then raise exception 'FAIL [empty]'; end if;
  perform public.set_my_hire_date('2024-11-18');
  if public.my_hire_date() <> '2024-11-18' then raise exception 'FAIL [my hire]'; end if;
  -- 직원은 관리자 함수 못 씀
  perform public._t_raises81($q$select public.attendance_member_hire_date_set('a8210000-0000-0000-0000-000000000002', '2024-11-01', '사유')$q$, 'NOT_ALLOWED', 'emp edit');
  perform public._t_raises81($q$select public.attendance_leave_admin(2026)$q$, 'NOT_ALLOWED', 'emp view');
end;
$$;
reset role;

-- ② 관리자 입사일 수정: 사유 필수 → 바뀜 + 이력(이전→이후·사유) + 직원 알림
select public._t_as81('a8200000-0000-0000-0000-000000000001');
set local role authenticated;
do $$
begin
  perform public._t_raises81($q$select public.attendance_member_hire_date_set('a8210000-0000-0000-0000-000000000002', '2024-11-04', ' ')$q$, 'REASON_REQUIRED', 'reason');
  perform public._t_raises81($q$select public.attendance_member_hire_date_set('a8210000-0000-0000-0000-000000000002', '2024-11-18', '같음')$q$, 'NO_CHANGE', 'same');
  perform public.attendance_member_hire_date_set('a8210000-0000-0000-0000-000000000002', '2024-11-04', '근로계약서 확인');
end;
$$;
reset role;
do $$
declare h public.attendance_history;
begin
  if (select hire_date from public.members where id = 'a8210000-0000-0000-0000-000000000002') <> '2024-11-04' then raise exception 'FAIL [hire set]'; end if;
  select * into h from public.attendance_history where company_id = 'c8200000-0000-0000-0000-00000000000a' and action = 'hire_date' and member_name = 'A대표';
  if h.changes -> 0 ->> 'from' <> '2024-11-18' or h.changes -> 0 ->> 'to' <> '2024-11-04' or h.changes -> 0 ->> 'reason' <> '근로계약서 확인' then raise exception 'FAIL [hire history %]', h.changes; end if;
  if (select count(*) from public.chat_messages m join public.chat_rooms r on r.id = m.room_id
      where r.notice_member_id = 'a8210000-0000-0000-0000-000000000002' and m.body like '입사일이 바뀌었어요%이전: 2024-11-18%이후: 2024-11-04%사유: 근로계약서 확인%') <> 1 then
    raise exception 'FAIL [hire notice]';
  end if;
  if (select count(*) from public.attendance_history where action = 'hire_date' and company_id = 'c8200000-0000-0000-0000-00000000000a') <> 3 then raise exception 'FAIL [hire history count]'; end if;
end;
$$;

-- ③ 연차 설정 · 확정
select public._t_as81('a8200000-0000-0000-0000-000000000001');
set local role authenticated;
do $$
declare v jsonb;
begin
  perform public._t_raises81($q$select public.attendance_leave_settings_save(false, 'hour')$q$, 'HOUR_NEEDS_HOURLY', 'hour needs hourly');
  perform public._t_raises81($q$select public.attendance_leave_settings_save(true, 'floor')$q$, 'INVALID', 'no floor');
  perform public.attendance_leave_settings_save(true, 'hour');
  v := public.attendance_leave_admin(2026);
  if v -> 'settings' ->> 'rounding' <> 'hour' or not (v -> 'settings' ->> 'hourly_leave')::boolean then raise exception 'FAIL [settings %]', v -> 'settings'; end if;
  if jsonb_array_length(v -> 'members') <> 2 then raise exception 'FAIL [approved only %]', v -> 'members'; end if;
  -- 법 기준보다 적게: 사유 없으면 막힘, 사유 있으면 됨
  perform public._t_raises81($q$select public.attendance_leave_confirm('[{"member_id":"a8210000-0000-0000-0000-000000000002","period_start":"2026-01-01","period_end":"2026-12-31","recommended":15,"granted":13}]')$q$, 'REASON_REQUIRED', 'below law');
  perform public.attendance_leave_confirm('[{"member_id":"a8210000-0000-0000-0000-000000000002","period_start":"2026-01-01","period_end":"2026-12-31","recommended":15,"granted":13,"reason":"출근율 80% 미만"}]');
  -- 다시 확정(많게) + 대표(추천 없음) 함께
  perform public.attendance_leave_confirm('[{"member_id":"a8210000-0000-0000-0000-000000000002","period_start":"2026-01-01","period_end":"2026-12-31","recommended":15,"granted":16},{"member_id":"a8210000-0000-0000-0000-000000000001","period_start":"2026-01-01","period_end":"2026-12-31","recommended":null,"granted":15}]');
  perform public._t_raises81($q$select public.attendance_leave_confirm('[{"member_id":"a8210000-0000-0000-0000-000000000003","period_start":"2026-01-01","period_end":"2026-12-31","granted":15}]')$q$, 'NOT_FOUND', 'pending member');
  perform public._t_raises81($q$select public.attendance_leave_confirm('[{"member_id":"a8210000-0000-0000-0000-000000000002","period_start":"2026-01-01","period_end":"2026-12-31","granted":99}]')$q$, 'INVALID_DAYS', 'too many');
  v := public.attendance_leave_admin(2026);
  if jsonb_array_length(v -> 'grants') <> 2 then raise exception 'FAIL [grants %]', v -> 'grants'; end if;
  if (select granted_days from public.attendance_leave_grants where member_id = 'a8210000-0000-0000-0000-000000000002') <> 16 then raise exception 'FAIL [regrant]'; end if;
  if jsonb_array_length(public.attendance_leave_admin(2025) -> 'grants') <> 0 then raise exception 'FAIL [year filter]'; end if;
end;
$$;
reset role;
do $$
begin
  if (select count(*) from public.attendance_history where company_id = 'c8200000-0000-0000-0000-00000000000a' and action = 'leave_grant') <> 3 then raise exception 'FAIL [grant history]'; end if;
  if (select changes -> 0 ->> 'reason' from public.attendance_history where action = 'leave_grant' and changes -> 0 ->> 'to' = '13일' and company_id = 'c8200000-0000-0000-0000-00000000000a') <> '출근율 80% 미만' then raise exception 'FAIL [grant reason kept]'; end if;
  if (select count(*) from public.attendance_history where action = 'settings' and company_id = 'c8200000-0000-0000-0000-00000000000a') <> 1 then raise exception 'FAIL [settings history]'; end if;
end;
$$;

-- ④ 직원: 자기 확정만 보임 / 다른 회사: 안 보이고 못 고침
select public._t_as81('a8200000-0000-0000-0000-000000000002');
set local role authenticated;
do $$
begin
  if (select count(*) from public.attendance_leave_grants) <> 1 then raise exception 'FAIL [own grant only]'; end if;
end;
$$;
reset role;
select public._t_as81('a8200000-0000-0000-0000-000000000004');
set local role authenticated;
do $$
begin
  if (select count(*) from public.attendance_leave_grants) <> 0 then raise exception 'FAIL [cross read]'; end if;
  perform public._t_raises81($q$select public.attendance_member_hire_date_set('a8210000-0000-0000-0000-000000000002', '2024-01-01', '남의 회사')$q$, 'NOT_FOUND', 'cross hire');
  perform public._t_raises81($q$select public.attendance_leave_confirm('[{"member_id":"a8210000-0000-0000-0000-000000000002","period_start":"2026-01-01","period_end":"2026-12-31","granted":20}]')$q$, 'NOT_FOUND', 'cross grant');
  if jsonb_array_length(public.attendance_leave_admin(2026) -> 'members') <> 1 then raise exception 'FAIL [cross members]'; end if;
end;
$$;
reset role;

select 'ok' as attendance_leave_081;
rollback;
