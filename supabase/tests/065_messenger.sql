-- =============================================================================
-- 065_messenger.sql — 사내 메신저 (D-203, migration 106)
-- 스위치 꺼짐 = 아무것도 못 함 / 같은 회사 승인 멤버끼리만 / 참여자만 읽기 / 표에 직접 쓰기 불가 /
-- 1:1 방 하나 / 다시 보내도 한 번 / 남의 방 첨부 경로 불가 / 내 메시지만 삭제 / 읽음·안 읽은 수 /
-- 그룹 초대·나가기 / 소명서 방은 볼 수 있는 사람만 / 웹푸시 한 번만 / 실시간 주제는 내 것만
-- (D-204) 저장 한도 STORAGE_FULL / 미리보기 경로도 그 방만 / 90일 지난 첨부 정리 = 서버 전용 / 지운 뒤 expired
-- =============================================================================
begin;

create function public._t_raises65(p_sql text, p_code text, p_label text)
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
grant execute on function public._t_raises65(text, text, text) to authenticated;
create function public._t_as65(p_uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
end;
$$;

insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at) values
  ('a6500000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'boss65@test.local', now()),
  ('a6500000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'emp65a@test.local', now()),
  ('a6500000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'emp65b@test.local', now()),
  ('a6500000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bboss65@test.local', now());
insert into public.companies (id, name, invite_code, business_number) values
  ('c6500000-0000-0000-0000-00000000000a', '채팅A', 'CHATAAAA', '1000000651'),
  ('c6500000-0000-0000-0000-00000000000b', '채팅B', 'CHATBBBB', '1000000652');
insert into public.members (id, auth_user_id, company_id, name, phone, role, status, privacy_agreed_at) values
  ('a6510000-0000-0000-0000-000000000001', 'a6500000-0000-0000-0000-000000000001', 'c6500000-0000-0000-0000-00000000000a', 'A대표', '01096501001', 'super_admin', 'approved', now()),
  ('a6510000-0000-0000-0000-000000000002', 'a6500000-0000-0000-0000-000000000002', 'c6500000-0000-0000-0000-00000000000a', 'A직원', '01096501002', 'employee', 'approved', now()),
  ('a6510000-0000-0000-0000-000000000003', 'a6500000-0000-0000-0000-000000000003', 'c6500000-0000-0000-0000-00000000000a', 'A사원', '01096501003', 'employee', 'approved', now()),
  ('a6510000-0000-0000-0000-000000000004', 'a6500000-0000-0000-0000-000000000004', 'c6500000-0000-0000-0000-00000000000b', 'B대표', '01096501004', 'super_admin', 'approved', now());
insert into public.expense_claims (id, company_id, member_id, title) values
  ('e6500000-0000-0000-0000-000000000001', 'c6500000-0000-0000-0000-00000000000a', 'a6510000-0000-0000-0000-000000000002', '10월 출장비');

-- ① 스위치 꺼짐(D-206부터 메신저는 기본 켜짐 → 운영자가 false 줄을 넣은 회사): 아무것도 못 하고, 배지는 null
insert into public.company_features (company_id, feature, enabled) values ('c6500000-0000-0000-0000-00000000000a', 'messenger', false), ('c6500000-0000-0000-0000-00000000000b', 'messenger', false);
select public._t_as65('a6500000-0000-0000-0000-000000000001');
set local role authenticated;
do $$
begin
  perform public._t_raises65($q$select public.chat_open_direct('a6510000-0000-0000-0000-000000000002')$q$, 'FEATURE_DISABLED', 'off open');
  perform public._t_raises65($q$select public.chat_room_list()$q$, 'FEATURE_DISABLED', 'off list');
  if public.chat_unread_total() is not null then raise exception 'FAIL [off badge null]'; end if;
  if public.my_feature_enabled('messenger') then raise exception 'FAIL [off my_feature]'; end if;
end;
$$;
reset role;

update public.company_features set enabled = true where company_id = 'c6500000-0000-0000-0000-00000000000a' and feature = 'messenger';

-- ② 1:1 방 하나 + 다른 회사 멤버 불가 + 보내기·다시 보내기 + 첨부 경로
select public._t_as65('a6500000-0000-0000-0000-000000000001');
set local role authenticated;
do $$
declare
  v_room uuid;
  v_again uuid;
begin
  if not public.my_feature_enabled('messenger') then raise exception 'FAIL [on my_feature]'; end if;
  if public.chat_unread_total() <> 0 then raise exception 'FAIL [on badge 0]'; end if;
  v_room := public.chat_open_direct('a6510000-0000-0000-0000-000000000002');
  v_again := public.chat_open_direct('a6510000-0000-0000-0000-000000000002');
  if v_room <> v_again then raise exception 'FAIL [direct one room]'; end if;
  perform set_config('t.room', v_room::text, true);
  perform public._t_raises65($q$select public.chat_open_direct('a6510000-0000-0000-0000-000000000004')$q$, 'INVALID_MEMBER', 'other company member');
  perform public._t_raises65($q$select public.chat_open_direct('a6510000-0000-0000-0000-000000000001')$q$, 'INVALID_MEMBER', 'self direct');
  perform public.chat_send(v_room, 'f6500000-0000-0000-0000-000000000001', 'text', '안녕하세요');
  perform public.chat_send(v_room, 'f6500000-0000-0000-0000-000000000001', 'text', '안녕하세요'); -- 다시 보내도 한 번
  if (select count(*) from public.chat_messages where room_id = v_room) <> 1 then raise exception 'FAIL [idempotent send]'; end if;
  perform public._t_raises65(format($q$select public.chat_send(%L, gen_random_uuid(), 'text', '   ')$q$, v_room), 'EMPTY_MESSAGE', 'empty');
  perform public._t_raises65(format($q$select public.chat_send(%L, gen_random_uuid(), 'image', null, '{"path":"c6500000-0000-0000-0000-00000000000a/00000000-0000-0000-0000-000000000000/x.jpg"}')$q$, v_room), 'INVALID_ATTACHMENT', 'other room path');
  perform public.chat_send(v_room, 'f6500000-0000-0000-0000-000000000002', 'image', null,
    jsonb_build_object('path', 'c6500000-0000-0000-0000-00000000000a/' || v_room || '/p.jpg', 'name', 'p.jpg', 'size', 1000, 'mime', 'image/jpeg', 'width', 10, 'height', 20));
  -- 표에 직접 쓰기 불가
  perform public._t_raises65(format($q$insert into public.chat_messages (room_id, company_id, kind, body) values (%L, 'c6500000-0000-0000-0000-00000000000a', 'text', 'x')$q$, v_room), '42501', 'direct insert');
  perform public._t_raises65($q$insert into public.company_features (company_id, feature, enabled) values ('c6500000-0000-0000-0000-00000000000b', 'messenger', true)$q$, '42501', 'switch by user');
end;
$$;
reset role;

-- ③ 받는 사람: 안 읽은 2 → 읽으면 0. 실시간 주제는 내 것만 보임
select public._t_as65('a6500000-0000-0000-0000-000000000002');
set local role authenticated;
do $$
declare
  v_room uuid := current_setting('t.room')::uuid;
  v_list jsonb := public.chat_room_list();
begin
  if jsonb_array_length(v_list) <> 1 or (v_list -> 0 ->> 'unread')::int <> 2 then raise exception 'FAIL [unread 2] %', v_list; end if;
  if public.chat_unread_total() <> 2 then raise exception 'FAIL [badge 2]'; end if;
  if jsonb_array_length(public.chat_messages_page(v_room)) <> 2 then raise exception 'FAIL [page 2]'; end if;
  perform public.chat_mark_read(v_room);
  if public.chat_unread_total() <> 0 then raise exception 'FAIL [read → 0]'; end if;
  -- 남의 메시지 삭제 불가
  perform public._t_raises65($q$select public.chat_delete_message('f6500000-0000-0000-0000-000000000001')$q$, 'NOT_FOUND', 'delete others');
  perform set_config('realtime.topic', 'chat:a6510000-0000-0000-0000-000000000002', true);
  if (select count(*) from realtime.messages where topic = 'chat:a6510000-0000-0000-0000-000000000002') < 1 then raise exception 'FAIL [my topic visible]'; end if;
  perform set_config('realtime.topic', 'chat:a6510000-0000-0000-0000-000000000001', true);
  if (select count(*) from realtime.messages where topic = 'chat:a6510000-0000-0000-0000-000000000001') <> 0 then raise exception 'FAIL [others topic hidden]'; end if;
end;
$$;
reset role;

-- ④ 참여하지 않은 같은 회사 직원·다른 회사: 못 읽음
select public._t_as65('a6500000-0000-0000-0000-000000000003');
set local role authenticated;
do $$
declare
  v_room uuid := current_setting('t.room')::uuid;
begin
  if (select count(*) from public.chat_messages) <> 0 or (select count(*) from public.chat_rooms) <> 0 then raise exception 'FAIL [non member select]'; end if;
  perform public._t_raises65(format($q$select public.chat_messages_page(%L)$q$, v_room), 'NOT_FOUND', 'non member page');
  perform public._t_raises65(format($q$select public.chat_send(%L, gen_random_uuid(), 'text', 'x')$q$, v_room), 'NOT_FOUND', 'non member send');
  perform public._t_raises65($q$select public.chat_open_claim('e6500000-0000-0000-0000-000000000001')$q$, 'NOT_FOUND', 'claim not visible');
end;
$$;
reset role;
update public.company_features set enabled = true where company_id = 'c6500000-0000-0000-0000-00000000000b' and feature = 'messenger';
select public._t_as65('a6500000-0000-0000-0000-000000000004');
set local role authenticated;
do $$
declare
  v_room uuid := current_setting('t.room')::uuid;
begin
  if (select count(*) from public.chat_messages) <> 0 then raise exception 'FAIL [other company select]'; end if;
  perform public._t_raises65(format($q$select public.chat_send(%L, gen_random_uuid(), 'text', 'x')$q$, v_room), 'NOT_FOUND', 'other company send');
  perform public._t_raises65(format($q$select public.chat_invite(%L, array['a6510000-0000-0000-0000-000000000004'::uuid])$q$, v_room), 'NOT_FOUND', 'other company invite');
end;
$$;
reset role;

-- ⑤ 삭제·그룹(다른 회사 멤버는 빠짐)·나가기·소명서 방·웹푸시 한 번
select public._t_as65('a6500000-0000-0000-0000-000000000001');
set local role authenticated;
do $$
declare
  v_room uuid := current_setting('t.room')::uuid;
  v_group uuid;
  v_claim uuid;
  v_push jsonb;
  v_page jsonb;
begin
  if public.chat_delete_message('f6500000-0000-0000-0000-000000000002') not like 'c6500000-0000-0000-0000-00000000000a/%' then raise exception 'FAIL [delete returns path]'; end if;
  v_page := public.chat_messages_page(v_room);
  if not (v_page -> 0 ->> 'deleted')::boolean or v_page -> 0 ->> 'attachment_path' is not null then raise exception 'FAIL [deleted hidden] %', v_page -> 0; end if;
  perform public._t_raises65(format($q$select public.chat_leave(%L)$q$, v_room), 'DIRECT_ROOM', 'leave direct');

  v_group := public.chat_create_group(array['a6510000-0000-0000-0000-000000000002', 'a6510000-0000-0000-0000-000000000003', 'a6510000-0000-0000-0000-000000000004']::uuid[], '영업팀');
  if jsonb_array_length(public.chat_room_detail(v_group) -> 'members') <> 3 then raise exception 'FAIL [group excludes other company]'; end if;
  if (select count(*) from public.chat_messages where room_id = v_group and kind = 'system') <> 1 then raise exception 'FAIL [invite system msg]'; end if;
  perform set_config('t.group', v_group::text, true);

  v_push := public.chat_claim_push('f6500000-0000-0000-0000-000000000001');
  if v_push is null or jsonb_array_length(v_push -> 'recipients') <> 1 or v_push -> 'recipients' ->> 0 <> 'a6510000-0000-0000-0000-000000000002' then raise exception 'FAIL [push recipients] %', v_push; end if;
  if public.chat_claim_push('f6500000-0000-0000-0000-000000000001') is not null then raise exception 'FAIL [push once]'; end if;

  v_claim := public.chat_open_claim('e6500000-0000-0000-0000-000000000001');
  if public.chat_open_claim('e6500000-0000-0000-0000-000000000001') <> v_claim then raise exception 'FAIL [claim one room]'; end if;
  if jsonb_array_length(public.chat_room_detail(v_claim) -> 'members') <> 2 or public.chat_room_detail(v_claim) -> 'claim' ->> 'title' <> '10월 출장비' then raise exception 'FAIL [claim room members]'; end if;
end;
$$;
reset role;

select public._t_as65('a6500000-0000-0000-0000-000000000003');
set local role authenticated;
do $$
declare
  v_group uuid := current_setting('t.group')::uuid;
begin
  if jsonb_array_length(public.chat_messages_page(v_group)) < 1 then raise exception 'FAIL [group member reads]'; end if;
  perform public.chat_leave(v_group);
  perform public._t_raises65(format($q$select public.chat_messages_page(%L)$q$, v_group), 'NOT_FOUND', 'left member');
end;
$$;
reset role;

-- ⑤-2 작성자 본인이 소명서 대화를 열어도 됨(107) — 같은 방, 참여자 2명 그대로
select public._t_as65('a6500000-0000-0000-0000-000000000002');
set local role authenticated;
do $$
declare
  v_room uuid := public.chat_open_claim('e6500000-0000-0000-0000-000000000001');
begin
  if jsonb_array_length(public.chat_room_detail(v_room) -> 'members') <> 2 then raise exception 'FAIL [owner opens claim room]'; end if;
end;
$$;
reset role;

-- ⑤-3 첨부 저장 한도·미리보기·보관 기간(D-204, migration 108)
select public._t_as65('a6500000-0000-0000-0000-000000000001');
set local role authenticated;
do $$
declare
  v_room uuid := current_setting('t.room')::uuid;
  v_st jsonb := public.chat_storage_status();
  v_msg jsonb;
begin
  if (v_st ->> 'limit')::bigint <> 1073741824 or (v_st ->> 'days')::int <> 90 then raise exception 'FAIL [storage status] %', v_st; end if;
  perform public._t_raises65(format($q$select public.chat_send(%L, gen_random_uuid(), 'image', null, jsonb_build_object('path', 'c6500000-0000-0000-0000-00000000000a/%s/y.jpg', 'thumb_path', 'c6500000-0000-0000-0000-00000000000a/00000000-0000-0000-0000-000000000000/y_t.webp'))$q$, v_room, v_room), 'INVALID_ATTACHMENT', 'thumb other room');
  perform public._t_raises65(format($q$select public.chat_send(%L, gen_random_uuid(), 'file', null, jsonb_build_object('path', 'c6500000-0000-0000-0000-00000000000a/%s/big.zip', 'size', 1073741825))$q$, v_room, v_room), 'STORAGE_FULL', 'storage full');
  v_msg := public.chat_send(v_room, 'f6500000-0000-0000-0000-0000000000a1', 'image', null,
    jsonb_build_object('path', 'c6500000-0000-0000-0000-00000000000a/' || v_room || '/a1.jpg', 'thumb_path', 'c6500000-0000-0000-0000-00000000000a/' || v_room || '/a1_t.webp', 'size', 250000, 'thumb_size', 30000, 'width', 1280, 'height', 960));
  if v_msg ->> 'attachment_thumb_path' is null or (v_msg ->> 'expired')::boolean then raise exception 'FAIL [thumb saved] %', v_msg; end if;
  if (public.chat_storage_status() ->> 'used')::bigint < 280000 then raise exception 'FAIL [used counts thumb]'; end if;
  perform public._t_raises65($q$select * from public.chat_files_due(10)$q$, '42501', 'user cannot list purge');
  perform public._t_raises65($q$select public.chat_files_mark_purged(array['f6500000-0000-0000-0000-0000000000a1'::uuid])$q$, '42501', 'user cannot purge');
end;
$$;
reset role;
-- 91일 지난 것으로 → 새벽 정리 대상 → 지운 뒤 "보관 기간이 지난 사진", 사용량에서 빠짐
update public.chat_messages set created_at = now() - interval '91 days' where id = 'f6500000-0000-0000-0000-0000000000a1';
do $$
begin
  if not exists (select 1 from public.chat_files_due(1000) d where d.message_id = 'f6500000-0000-0000-0000-0000000000a1' and array_length(d.paths, 1) = 2) then raise exception 'FAIL [due 90 days]'; end if;
  if public.chat_files_mark_purged(array['f6500000-0000-0000-0000-0000000000a1'::uuid]) <> 1 then raise exception 'FAIL [mark purged]'; end if;
  if exists (select 1 from public.chat_files_due(1000) d where d.message_id = 'f6500000-0000-0000-0000-0000000000a1') then raise exception 'FAIL [purged not due again]'; end if;
end;
$$;
select public._t_as65('a6500000-0000-0000-0000-000000000002');
set local role authenticated;
do $$
declare
  v_m jsonb;
begin
  select x into v_m from jsonb_array_elements(public.chat_messages_page(current_setting('t.room')::uuid, null, null, 200)) x where x ->> 'id' = 'f6500000-0000-0000-0000-0000000000a1';
  if v_m is null or not (v_m ->> 'expired')::boolean or v_m ->> 'attachment_path' is not null or v_m ->> 'attachment_thumb_path' is not null then raise exception 'FAIL [expired json] %', v_m; end if;
  if (public.chat_storage_status() ->> 'used')::bigint >= 250000 + 30000 + (select coalesce(sum(attachment_size), 0) from public.chat_messages where id <> 'f6500000-0000-0000-0000-0000000000a1' and attachment_path is not null and deleted_at is null) + 1 then raise exception 'FAIL [purged not counted]'; end if;
end;
$$;
reset role;

-- ⑥ 스위치를 끄면 표 읽기도 막힘
update public.company_features set enabled = false where company_id = 'c6500000-0000-0000-0000-00000000000a';
select public._t_as65('a6500000-0000-0000-0000-000000000001');
set local role authenticated;
do $$
begin
  if (select count(*) from public.chat_messages) <> 0 then raise exception 'FAIL [off hides rows]'; end if;
  if public.chat_unread_total() is not null then raise exception 'FAIL [off badge]'; end if;
end;
$$;
reset role;

select 'messenger ok';
rollback;
