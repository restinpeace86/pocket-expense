-- =============================================================================
-- 087_chat_threads.sql — 서브 대화 (D-246, migration 137)
-- 만들기(제목·원글 종류·같은 원글이면 기존 것)·참여자 / 서브 대화 글은 메인 목록·안 읽은 수·방 마지막 글에서 빠짐 /
-- 종결(만든 사람·관리자만)·종결 뒤 보내기 막힘·다시 열기 / 푸시 받는 사람 = 참여자 / 내 서브 대화·새 글 / 회사 격리·나중에 들어온 사람
-- =============================================================================
begin;

create function public._t_raises87(p_sql text, p_code text, p_label text)
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
grant execute on function public._t_raises87(text, text, text) to authenticated;
create function public._t_as87(p_uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
end;
$$;

insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at) values
  ('a8800000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'boss87@test.local', now()),
  ('a8800000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'kim87@test.local', now()),
  ('a8800000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'park87@test.local', now()),
  ('a8800000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'late87@test.local', now()),
  ('a8800000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bboss87@test.local', now());
insert into public.companies (id, name, invite_code, business_number) values
  ('c8800000-0000-0000-0000-00000000000a', '스레드A', 'TAAAAAAA', '1000000871'),
  ('c8800000-0000-0000-0000-00000000000b', '스레드B', 'TBBBBBBB', '1000000872');
insert into public.members (id, auth_user_id, company_id, name, phone, role, status, privacy_agreed_at, approved_at) values
  ('a8810000-0000-0000-0000-000000000001', 'a8800000-0000-0000-0000-000000000001', 'c8800000-0000-0000-0000-00000000000a', 'A대표', '01098701001', 'super_admin', 'approved', now(), now()),
  ('a8810000-0000-0000-0000-000000000002', 'a8800000-0000-0000-0000-000000000002', 'c8800000-0000-0000-0000-00000000000a', '김대리', '01098701002', 'employee', 'approved', now(), now()),
  ('a8810000-0000-0000-0000-000000000003', 'a8800000-0000-0000-0000-000000000003', 'c8800000-0000-0000-0000-00000000000a', '박팀장', '01098701003', 'employee', 'approved', now(), now()),
  ('a8810000-0000-0000-0000-000000000004', 'a8800000-0000-0000-0000-000000000004', 'c8800000-0000-0000-0000-00000000000a', '늦게온', '01098701004', 'employee', 'approved', now(), now()),
  ('a8810000-0000-0000-0000-000000000005', 'a8800000-0000-0000-0000-000000000005', 'c8800000-0000-0000-0000-00000000000b', 'B대표', '01098701005', 'super_admin', 'approved', now(), now());
insert into public.company_features (company_id, feature, enabled) values
  ('c8800000-0000-0000-0000-00000000000a', 'messenger', true), ('c8800000-0000-0000-0000-00000000000b', 'messenger', true)
on conflict (company_id, feature) do update set enabled = true;
insert into public.chat_rooms (id, company_id, kind, title, created_by_member_id) values
  ('c8820000-0000-0000-0000-000000000001', 'c8800000-0000-0000-0000-00000000000a', 'group', '영업팀', 'a8810000-0000-0000-0000-000000000001');
insert into public.chat_members (room_id, company_id, member_id, joined_at, last_read_at) values
  ('c8820000-0000-0000-0000-000000000001', 'c8800000-0000-0000-0000-00000000000a', 'a8810000-0000-0000-0000-000000000001', now() - interval '1 day', now() - interval '1 day'),
  ('c8820000-0000-0000-0000-000000000001', 'c8800000-0000-0000-0000-00000000000a', 'a8810000-0000-0000-0000-000000000002', now() - interval '1 day', now() - interval '1 day'),
  ('c8820000-0000-0000-0000-000000000001', 'c8800000-0000-0000-0000-00000000000a', 'a8810000-0000-0000-0000-000000000003', now() - interval '1 day', now() - interval '1 day');
insert into public.chat_messages (id, room_id, company_id, sender_member_id, kind, body, created_at) values
  ('c8830000-0000-0000-0000-000000000001', 'c8820000-0000-0000-0000-000000000001', 'c8800000-0000-0000-0000-00000000000a', 'a8810000-0000-0000-0000-000000000002', 'text', '견적 단가가 달라요', now() - interval '2 hours'),
  ('c8830000-0000-0000-0000-000000000002', 'c8820000-0000-0000-0000-000000000001', 'c8800000-0000-0000-0000-00000000000a', null, 'system', '박팀장님이 들어왔어요', now() - interval '3 hours');

-- ① 박팀장(직원)이 김대리 글로 서브 대화 만들기
select public._t_as87('a8800000-0000-0000-0000-000000000003');
set local role authenticated;
select public._t_raises87($q$select public.chat_thread_open('c8830000-0000-0000-0000-000000000001', '   ')$q$, 'INVALID_THREAD_TITLE', '빈 제목');
select public._t_raises87($q$select public.chat_thread_open('c8830000-0000-0000-0000-000000000002', '안내 줄')$q$, 'THREAD_NOT_ALLOWED', '안내 줄로는 못 만듦');
create temp table t87 (id uuid) on commit drop;
grant all on t87 to authenticated;
do $$
declare j jsonb;
begin
  j := public.chat_thread_open('c8830000-0000-0000-0000-000000000001', '  예시상사 견적 단가 확인 ');
  if j ->> 'title' <> '예시상사 견적 단가 확인' or j ->> 'status' <> 'open' then raise exception 'FAIL [open] %', j; end if;
  if (j ->> 'people_count')::int <> 2 then raise exception 'FAIL [participants creator+root] %', j ->> 'people_count'; end if;
  insert into t87 values ((j ->> 'id')::uuid);
  -- 같은 원글이면 기존 것(제목 무시)
  if (public.chat_thread_open('c8830000-0000-0000-0000-000000000001', '다른 제목') ->> 'id')::uuid <> (select id from t87) then raise exception 'FAIL [same root]'; end if;
  -- 메인 목록의 원글에 카드
  if (select (x -> 'thread' ->> 'title') from jsonb_array_elements(public.chat_messages_page('c8820000-0000-0000-0000-000000000001')) x where x ->> 'id' = 'c8830000-0000-0000-0000-000000000001') <> '예시상사 견적 단가 확인' then
    raise exception 'FAIL [card on root]';
  end if;
end $$;

-- ② 서브 대화에 글 → 메인 목록·안 읽은 수·방 마지막 글에는 없음
do $$
declare th uuid := (select id from t87);
begin
  perform public.chat_send('c8820000-0000-0000-0000-000000000001', 'c8830000-0000-0000-0000-000000000011', 'text', '지난달 1,200원이에요', null, th);
  if exists (select 1 from jsonb_array_elements(public.chat_messages_page('c8820000-0000-0000-0000-000000000001')) x where x ->> 'id' = 'c8830000-0000-0000-0000-000000000011') then raise exception 'FAIL [thread msg in main]'; end if;
  if jsonb_array_length(public.chat_thread_messages(th)) <> 1 then raise exception 'FAIL [thread messages]'; end if;
  if (select (x -> 'last' ->> 'id') from jsonb_array_elements(public.chat_room_list()) x) = 'c8830000-0000-0000-0000-000000000011' then raise exception 'FAIL [room last]'; end if;
  -- 원글로 다시 서브 대화 못 만듦(서브 대화 글로도 못 만듦)
  perform public._t_raises87($q$select public.chat_thread_open('c8830000-0000-0000-0000-000000000011', '서브의 서브')$q$, 'THREAD_NOT_ALLOWED', '서브 대화 글로는 못 만듦');
end $$;
reset role;
-- 대표(참여자 아님) 기준: 메인 안 읽은 수 1(김대리 원글)만, 서브 대화 글은 안 셈
select public._t_as87('a8800000-0000-0000-0000-000000000001');
set local role authenticated;
do $$
begin
  if public.chat_unread_total() <> 1 then raise exception 'FAIL [unread total] %', public.chat_unread_total(); end if;
  if (select (x ->> 'unread')::int from jsonb_array_elements(public.chat_room_list()) x) <> 1 then raise exception 'FAIL [room unread]'; end if;
  -- 대표는 참여자가 아니라 새 글 0, 내 서브 대화에 없음
  if ((select x -> 'thread' ->> 'new' from jsonb_array_elements(public.chat_messages_page('c8820000-0000-0000-0000-000000000001')) x where x ->> 'id' = 'c8830000-0000-0000-0000-000000000001'))::int <> 0 then raise exception 'FAIL [boss new]'; end if;
  if jsonb_array_length(public.chat_my_threads()) <> 0 then raise exception 'FAIL [boss my threads]'; end if;
  if jsonb_array_length(public.chat_thread_list('c8820000-0000-0000-0000-000000000001')) <> 1 then raise exception 'FAIL [list]'; end if;
end $$;
reset role;

-- ③ 김대리(원글 쓴 사람 = 참여자): 새 글 1, 내 서브 대화 1, 읽으면 0
select public._t_as87('a8800000-0000-0000-0000-000000000002');
set local role authenticated;
do $$
declare th uuid := (select id from t87);
begin
  if public.chat_my_threads_new() <> 1 then raise exception 'FAIL [kim new] %', public.chat_my_threads_new(); end if;
  if jsonb_array_length(public.chat_my_threads()) <> 1 or (public.chat_my_threads() -> 0 ->> 'room_title') <> '영업팀' then raise exception 'FAIL [kim my threads]'; end if;
  perform public.chat_thread_mark_read(th);
  if public.chat_my_threads_new() <> 0 then raise exception 'FAIL [kim read]'; end if;
  -- 김대리 글 → 푸시 받는 사람 = 박팀장(참여자)만, 대표 아님
  perform public.chat_send('c8820000-0000-0000-0000-000000000001', 'c8830000-0000-0000-0000-000000000012', 'text', '10월 단가로 요청할게요', null, th);
  if (public.chat_claim_push('c8830000-0000-0000-0000-000000000012') -> 'recipients') <> '["a8810000-0000-0000-0000-000000000003"]'::jsonb then raise exception 'FAIL [push recipients]'; end if;
  -- 김대리는 만든 사람이 아니라 종결 못 함
  perform public._t_raises87(format('select public.chat_thread_close(%L, %L)', th, '요약'), 'NOT_ALLOWED', '직원(만든 사람 아님) 종결');
end $$;
reset role;

-- ④ 만든 사람(박팀장) 종결 → 보내기 막힘 → 관리자가 다시 열기 → 보내기 됨
select public._t_as87('a8800000-0000-0000-0000-000000000003');
set local role authenticated;
do $$
declare th uuid := (select id from t87); j jsonb;
begin
  j := public.chat_thread_close(th, '  10월 단가 적용 요청  ');
  if j ->> 'status' <> 'closed' or j ->> 'summary' <> '10월 단가 적용 요청' or j ->> 'closed_by_name' <> '박팀장' then raise exception 'FAIL [close] %', j; end if;
  perform public._t_raises87(format($q$select public.chat_send('c8820000-0000-0000-0000-000000000001', gen_random_uuid(), 'text', '닫힌 뒤', null, %L)$q$, th), 'THREAD_CLOSED', '종결 뒤 보내기');
end $$;
reset role;
select public._t_as87('a8800000-0000-0000-0000-000000000001');
set local role authenticated;
do $$
declare th uuid := (select id from t87); j jsonb;
begin
  if (public.chat_thread_detail(th) ->> 'can_manage')::boolean is not true then raise exception 'FAIL [admin can manage]'; end if;
  j := public.chat_thread_reopen(th);
  if j ->> 'status' <> 'open' or j ->> 'summary' <> '10월 단가 적용 요청' then raise exception 'FAIL [reopen keeps summary] %', j; end if;
  perform public.chat_send('c8820000-0000-0000-0000-000000000001', 'c8830000-0000-0000-0000-000000000013', 'text', '다시 열고 한 줄', null, th);
  if (public.chat_thread_detail(th) ->> 'message_count')::int <> 3 then raise exception 'FAIL [count]'; end if;
  -- 대표가 글을 써서 참여자가 됨 → 내 서브 대화 1
  if jsonb_array_length(public.chat_my_threads()) <> 1 then raise exception 'FAIL [boss joined]'; end if;
end $$;
reset role;

-- ⑤ 나중에 들어온 사람: 들어오기 전에 만들어진 서브 대화는 못 봄
insert into public.chat_members (room_id, company_id, member_id, joined_at, last_read_at) values
  ('c8820000-0000-0000-0000-000000000001', 'c8800000-0000-0000-0000-00000000000a', 'a8810000-0000-0000-0000-000000000004', now() + interval '1 minute', now() + interval '1 minute');
select public._t_as87('a8800000-0000-0000-0000-000000000004');
set local role authenticated;
do $$
declare th uuid := (select id from t87);
begin
  if jsonb_array_length(public.chat_thread_list('c8820000-0000-0000-0000-000000000001')) <> 0 then raise exception 'FAIL [late list]'; end if;
  perform public._t_raises87(format('select public.chat_thread_messages(%L)', th), 'NOT_FOUND', '나중에 온 사람 서브 대화 글');
end $$;
reset role;

-- ⑥ 다른 회사는 못 봄 / 표 직접 읽기 막힘
select public._t_as87('a8800000-0000-0000-0000-000000000005');
set local role authenticated;
do $$
declare th uuid := (select id from t87);
begin
  perform public._t_raises87(format('select public.chat_thread_detail(%L)', th), 'NOT_FOUND', '다른 회사 상세');
  perform public._t_raises87(format($q$select public.chat_send('c8820000-0000-0000-0000-000000000001', gen_random_uuid(), 'text', '침입', null, %L)$q$, th), 'NOT_FOUND', '다른 회사 보내기');
  perform public._t_raises87('select count(*) from public.chat_threads', '42501', '표 직접 읽기');
end $$;
reset role;

select 'chat threads ok';
rollback;
