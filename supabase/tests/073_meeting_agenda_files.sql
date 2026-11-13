-- =============================================================================
-- 073_meeting_agenda_files.sql — 회의 안건·자료 + 10분 전 알림 카드 (D-217, migration 116)
-- 안건 저장·JSON / 자료: 만든 사람만 올리기·지우기, 확장자·경로·10개·저장 한도 / 저장 공간에 합산 /
-- 같은 회사만 파일 보기(다른 회사 불가) / 회의 지우면 자료 줄도 지워지고 새벽 정리 대상 / 10분 전 글에 안건·자료 수
-- =============================================================================
begin;

create function public._t_raises73(p_sql text, p_code text, p_label text)
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
grant execute on function public._t_raises73(text, text, text) to authenticated;
create function public._t_as73(p_uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
end;
$$;

insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at) values
  ('a7300000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'boss73@test.local', now()),
  ('a7300000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'emp73@test.local', now()),
  ('a7300000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bboss73@test.local', now());
insert into public.companies (id, name, invite_code, business_number) values
  ('c7300000-0000-0000-0000-00000000000a', '안건A', 'AGDAAAAA', '1000000731'),
  ('c7300000-0000-0000-0000-00000000000b', '안건B', 'AGDBBBBB', '1000000732');
insert into public.members (id, auth_user_id, company_id, name, phone, role, status, privacy_agreed_at) values
  ('a7310000-0000-0000-0000-000000000001', 'a7300000-0000-0000-0000-000000000001', 'c7300000-0000-0000-0000-00000000000a', 'A대표', '01097301001', 'super_admin', 'approved', now()),
  ('a7310000-0000-0000-0000-000000000002', 'a7300000-0000-0000-0000-000000000002', 'c7300000-0000-0000-0000-00000000000a', 'A직원', '01097301002', 'employee', 'approved', now()),
  ('a7310000-0000-0000-0000-000000000003', 'a7300000-0000-0000-0000-000000000003', 'c7300000-0000-0000-0000-00000000000b', 'B대표', '01097301003', 'super_admin', 'approved', now());
insert into public.company_features (company_id, feature, enabled) values
  ('c7300000-0000-0000-0000-00000000000a', 'calendar', true), ('c7300000-0000-0000-0000-00000000000a', 'messenger', true),
  ('c7300000-0000-0000-0000-00000000000b', 'calendar', true), ('c7300000-0000-0000-0000-00000000000b', 'messenger', true)
on conflict (company_id, feature) do update set enabled = true;

-- ① 대표: 안건 있는 회의(지금부터 10분 뒤 시작, 직원 참석)
select public._t_as73('a7300000-0000-0000-0000-000000000001');
set local role authenticated;
do $$
declare
  -- 4~14분 뒤의 10분 칸(예약 작업이 잡는 창: 1~15분 뒤)
  s timestamptz := date_bin('10 minutes', now() + interval '14 minutes', timestamptz '2000-01-01');
  v uuid;
begin
  v := public.calendar_save_event(null, jsonb_build_object('title', '분기 점검', 'kind', 'meeting', 'starts_at', s, 'ends_at', s + interval '1 hour',
    'agenda', E'1. 3분기 실적\n2. 4분기 계획', 'attendee_ids', jsonb_build_array('a7310000-0000-0000-0000-000000000002')));
  perform set_config('t.ev', v::text, true);
  if public.calendar_event(v) ->> 'agenda' <> E'1. 3분기 실적\n2. 4분기 계획' then raise exception 'FAIL [agenda saved]'; end if;
  perform public._t_raises73(format($q$select public.calendar_save_event(%L, jsonb_build_object('title','x','kind','meeting','starts_at',%L,'ends_at',%L,'agenda',repeat('가',2001)))$q$, v, s, s + interval '1 hour'), 'AGENDA_TOO_LONG', 'agenda too long');
end;
$$;
reset role;

-- 올린 파일(보관함 줄은 시험용으로 직접): 정상 PDF 1MB, 확장자 안 되는 것, 다른 경로
insert into storage.objects (bucket_id, name, owner_id, metadata) values
  ('meeting-files', 'c7300000-0000-0000-0000-00000000000a/' || current_setting('t.ev') || '/a.pdf', 'a7300000-0000-0000-0000-000000000001', '{"size": 1048576}'),
  ('meeting-files', 'c7300000-0000-0000-0000-00000000000a/' || current_setting('t.ev') || '/b.exe', 'a7300000-0000-0000-0000-000000000001', '{"size": 100}'),
  ('meeting-files', 'c7300000-0000-0000-0000-00000000000a/' || current_setting('t.ev') || '/big.pdf', 'a7300000-0000-0000-0000-000000000001', '{"size": 3145728}');

select public._t_as73('a7300000-0000-0000-0000-000000000001');
set local role authenticated;
do $$
declare
  ev text := current_setting('t.ev');
  base text := 'c7300000-0000-0000-0000-00000000000a/' || current_setting('t.ev') || '/';
  used0 bigint := (public.chat_storage_status() ->> 'used')::bigint;
  f jsonb;
begin
  f := public.calendar_event_file_add(ev::uuid, base || 'a.pdf', '안건 자료.pdf', 'application/pdf');
  if (f ->> 'size')::bigint <> 1048576 then raise exception 'FAIL [file size from storage] %', f; end if;
  perform set_config('t.file', f ->> 'id', true);
  if jsonb_array_length(public.calendar_event(ev::uuid) -> 'files') <> 1 then raise exception 'FAIL [files in json]'; end if;
  -- 저장 공간에 합산
  if (public.chat_storage_status() ->> 'used')::bigint <> used0 + 1048576 then raise exception 'FAIL [storage used includes meeting files]'; end if;
  perform public._t_raises73(format($q$select public.calendar_event_file_add(%L, %L, 'b.exe', null)$q$, ev, base || 'b.exe'), 'FILE_TYPE', 'file type');
  perform public._t_raises73(format($q$select public.calendar_event_file_add(%L, 'c7300000-0000-0000-0000-00000000000a/x/a.pdf', 'a.pdf', null)$q$, ev), 'INVALID_ATTACHMENT', 'wrong path');
  perform public._t_raises73(format($q$select public.calendar_event_file_add(%L, %L, 'none.pdf', null)$q$, ev, base || 'none.pdf'), 'INVALID_ATTACHMENT', 'not uploaded');
end;
$$;
reset role;

-- 저장 한도: 1MB로 줄이면(시험 안에서만) 3MB 파일은 STORAGE_FULL
update public.billing_plans set chat_storage_mb = 2, storage_mb = 2 where code = 'starter'; -- 158: 공용 한도
select public._t_as73('a7300000-0000-0000-0000-000000000001');
set local role authenticated;
do $$
begin
  perform public._t_raises73(format($q$select public.calendar_event_file_add(%L, %L, 'big.pdf', null)$q$, current_setting('t.ev'), 'c7300000-0000-0000-0000-00000000000a/' || current_setting('t.ev') || '/big.pdf'), 'STORAGE_FULL', 'storage full');
end;
$$;
reset role;
update public.billing_plans set chat_storage_mb = 1024, storage_mb = 10240 where code = 'starter';

-- ② 직원(참석자): 파일 보기 O, 올리기·지우기 X
select public._t_as73('a7300000-0000-0000-0000-000000000002');
set local role authenticated;
do $$
begin
  if (select count(*) from storage.objects where bucket_id = 'meeting-files' and name like '%/a.pdf') <> 1 then raise exception 'FAIL [same company sees file]'; end if;
  if (select count(*) from storage.objects where bucket_id = 'meeting-files' and name like '%/b.exe') <> 0 then raise exception 'FAIL [unregistered file hidden]'; end if;
  perform public._t_raises73(format($q$select public.calendar_event_file_add(%L, %L, 'a.pdf', null)$q$, current_setting('t.ev'), 'c7300000-0000-0000-0000-00000000000a/' || current_setting('t.ev') || '/a.pdf'), 'NOT_OWNER', 'attendee add');
  perform public._t_raises73(format($q$select public.calendar_event_file_delete(%L)$q$, current_setting('t.file')), 'NOT_FOUND', 'attendee delete');
  perform public._t_raises73($q$select * from public.calendar_event_files$q$, '42501', 'no direct table read');
end;
$$;
reset role;

-- ③ 다른 회사: 파일 못 봄
select public._t_as73('a7300000-0000-0000-0000-000000000003');
set local role authenticated;
do $$
begin
  if (select count(*) from storage.objects where bucket_id = 'meeting-files') <> 0 then raise exception 'FAIL [other company sees file]'; end if;
  perform public._t_raises73(format($q$select public.calendar_event_file_delete(%L)$q$, current_setting('t.file')), 'NOT_FOUND', 'other company delete');
end;
$$;
reset role;

-- ④ 10분 전 알림: 안건 첫 줄·자료 수
select private.calendar_reminder_tick();
do $$
declare
  b text := (select m.body from public.chat_messages m join public.chat_rooms r on r.id = m.room_id
             where r.kind = 'notice' and r.notice_member_id = 'a7310000-0000-0000-0000-000000000002' order by m.created_at desc limit 1);
begin
  if b is null or b not like '%분기 점검%' or b not like '%안건: 1. 3분기 실적%' or b not like '%자료: 1개%' or b like '%4분기%' then raise exception 'FAIL [notice card body] %', b; end if;
end;
$$;

-- ⑤ 만든 사람이 자료 지우기 → 경로 / 회의 지우기 → 남은 자료 줄도 지워지고 새벽 정리 대상
select public._t_as73('a7300000-0000-0000-0000-000000000001');
set local role authenticated;
do $$
begin
  if public.calendar_event_file_delete(current_setting('t.file')::uuid) not like '%/a.pdf' then raise exception 'FAIL [delete returns path]'; end if;
  perform public.calendar_event_file_add(current_setting('t.ev')::uuid, 'c7300000-0000-0000-0000-00000000000a/' || current_setting('t.ev') || '/a.pdf', 'a.pdf', null);
  perform public.calendar_delete_event(current_setting('t.ev')::uuid);
end;
$$;
reset role;
do $$
begin
  if exists (select 1 from public.calendar_event_files where event_id = current_setting('t.ev')::uuid) then raise exception 'FAIL [cascade on cancel]'; end if;
  update storage.objects set created_at = now() - interval '2 days' where bucket_id = 'meeting-files' and name like 'c7300000-0000-0000-0000-00000000000a/%';
  if (select count(*) from public.meeting_files_orphans(100) x where x like 'c7300000-0000-0000-0000-00000000000a/%') <> 3 then raise exception 'FAIL [orphans listed]'; end if;
end;
$$;

select 'ok' as meeting_agenda_files_073;
rollback;
