-- =============================================================================
-- 075_assistant_room.sql — WORKON 도우미 방(D-222, migration 120)
-- 사람마다 하나 / 주인만 글(text) / 답(bot)은 서버만·도우미 방에만 / 사진·파일 불가 / 남이 들어가거나 못 봄 / 다른 회사 불가
-- =============================================================================
begin;

create function public._t_raises75(p_sql text, p_code text, p_label text)
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
grant execute on function public._t_raises75(text, text, text) to authenticated;
create function public._t_as75(p_uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
end;
$$;

insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at) values
  ('a7500000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'emp75a@test.local', now()),
  ('a7500000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'emp75b@test.local', now());
insert into public.companies (id, name, invite_code, business_number) values ('c7500000-0000-0000-0000-00000000000a', '도우미A', 'ASTAAAAA', '1000000751');
insert into public.members (id, auth_user_id, company_id, name, phone, role, status, privacy_agreed_at) values
  ('a7510000-0000-0000-0000-000000000001', 'a7500000-0000-0000-0000-000000000001', 'c7500000-0000-0000-0000-00000000000a', 'A직원', '01097501001', 'employee', 'approved', now()),
  ('a7510000-0000-0000-0000-000000000002', 'a7500000-0000-0000-0000-000000000002', 'c7500000-0000-0000-0000-00000000000a', 'B직원', '01097501002', 'employee', 'approved', now());
insert into public.company_features (company_id, feature, enabled) values ('c7500000-0000-0000-0000-00000000000a', 'messenger', true)
on conflict (company_id, feature) do update set enabled = true;

select public._t_as75('a7500000-0000-0000-0000-000000000001');
set local role authenticated;
do $$
declare
  r1 uuid := public.chat_assistant_room();
begin
  perform set_config('t.room', r1::text, true);
  if public.chat_assistant_room() <> r1 then raise exception 'FAIL [one per person]'; end if;
  -- 주인 글은 됨, 사진·답(bot)은 안 됨
  perform public.chat_send(r1, gen_random_uuid(), 'text', '오늘 일정 알려줘', null);
  perform public._t_raises75(format($q$insert into public.chat_messages (room_id, company_id, sender_member_id, kind, body) values (%L, 'c7500000-0000-0000-0000-00000000000a', null, 'bot', 'x')$q$, r1), '42501', 'member cannot write bot');
end;
$$;
reset role;

-- 서버(소유자 권한)가 bot 답을 넣음 / 다른 방에는 bot 불가 / 도우미 방에 사진 불가 / 남은 못 들어감
do $$
declare
  r1 uuid := current_setting('t.room')::uuid;
  g uuid;
begin
  insert into public.chat_messages (room_id, company_id, sender_member_id, kind, body, link) values (r1, 'c7500000-0000-0000-0000-00000000000a', null, 'bot', '오늘 일정은 없어요.', '/x');
  insert into public.chat_rooms (company_id, kind, title) values ('c7500000-0000-0000-0000-00000000000a', 'group', '그룹') returning id into g;
  perform public._t_raises75(format($q$insert into public.chat_messages (room_id, company_id, sender_member_id, kind, body) values (%L, 'c7500000-0000-0000-0000-00000000000a', null, 'bot', 'x')$q$, g), 'ASSISTANT_ROOM', 'bot outside assistant');
  perform public._t_raises75(format($q$insert into public.chat_messages (room_id, company_id, sender_member_id, kind, attachment_path) values (%L, 'c7500000-0000-0000-0000-00000000000a', 'a7510000-0000-0000-0000-000000000001', 'image', 'p')$q$, r1), 'ASSISTANT_ROOM', 'image in assistant');
  perform public._t_raises75(format($q$insert into public.chat_messages (room_id, company_id, sender_member_id, kind, body) values (%L, 'c7500000-0000-0000-0000-00000000000a', 'a7510000-0000-0000-0000-000000000002', 'text', 'x')$q$, r1), 'ASSISTANT_ROOM', 'other member text');
  perform public._t_raises75(format($q$insert into public.chat_members (room_id, company_id, member_id) values (%L, 'c7500000-0000-0000-0000-00000000000a', 'a7510000-0000-0000-0000-000000000002')$q$, r1), 'ASSISTANT_ROOM', 'other member join');
end;
$$;

-- B직원: A의 도우미 방 글을 못 보고, 자기 방은 따로
select public._t_as75('a7500000-0000-0000-0000-000000000002');
set local role authenticated;
do $$
begin
  if exists (select 1 from public.chat_messages where room_id = current_setting('t.room')::uuid) then raise exception 'FAIL [other sees assistant room]'; end if;
  if public.chat_assistant_room() = current_setting('t.room')::uuid then raise exception 'FAIL [shared room]'; end if;
end;
$$;
reset role;

select 'ok' as assistant_room_075;
rollback;
