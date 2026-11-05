-- =============================================================================
-- 070_chat_theme_retention.sql — 채팅 색감(계정별, D-211) + 사진·파일 보관 기간(회사별 30·60·90일, D-212) (migration 113)
-- 색감: 본인만·정해진 값만 / 보관 기간: 관리자만·자기 회사만·30·60·90만 / 새벽 정리가 회사 기간을 따름 / 표 직접 쓰기 불가
-- =============================================================================
begin;

create function public._t_raises70(p_sql text, p_code text, p_label text)
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
grant execute on function public._t_raises70(text, text, text) to authenticated;
create function public._t_as70(p_uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
end;
$$;

insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at) values
  ('a7000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'boss70@test.local', now()),
  ('a7000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'emp70@test.local', now()),
  ('a7000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bboss70@test.local', now());
insert into public.companies (id, name, invite_code, business_number) values
  ('c7000000-0000-0000-0000-00000000000a', '보관A', 'KPXAAAAA', '1000000701'),
  ('c7000000-0000-0000-0000-00000000000b', '보관B', 'KPXBBBBB', '1000000702');
insert into public.members (id, auth_user_id, company_id, name, phone, role, status, privacy_agreed_at) values
  ('a7010000-0000-0000-0000-000000000001', 'a7000000-0000-0000-0000-000000000001', 'c7000000-0000-0000-0000-00000000000a', 'A대표', '01097001001', 'super_admin', 'approved', now()),
  ('a7010000-0000-0000-0000-000000000002', 'a7000000-0000-0000-0000-000000000002', 'c7000000-0000-0000-0000-00000000000a', 'A직원', '01097001002', 'employee', 'approved', now()),
  ('a7010000-0000-0000-0000-000000000003', 'a7000000-0000-0000-0000-000000000003', 'c7000000-0000-0000-0000-00000000000b', 'B대표', '01097001003', 'super_admin', 'approved', now());
insert into public.company_features (company_id, feature, enabled) values
  ('c7000000-0000-0000-0000-00000000000a', 'messenger', true),
  ('c7000000-0000-0000-0000-00000000000b', 'messenger', true)
on conflict (company_id, feature) do update set enabled = true;

-- 첨부 메시지: A회사 40일 전·70일 전, B회사 40일 전 (각 1MB)
insert into public.chat_rooms (id, company_id, kind, title) values
  ('d7000000-0000-0000-0000-00000000000a', 'c7000000-0000-0000-0000-00000000000a', 'group', 'A방'),
  ('d7000000-0000-0000-0000-00000000000b', 'c7000000-0000-0000-0000-00000000000b', 'group', 'B방');
insert into public.chat_members (room_id, company_id, member_id) values
  ('d7000000-0000-0000-0000-00000000000a', 'c7000000-0000-0000-0000-00000000000a', 'a7010000-0000-0000-0000-000000000001'),
  ('d7000000-0000-0000-0000-00000000000a', 'c7000000-0000-0000-0000-00000000000a', 'a7010000-0000-0000-0000-000000000002'),
  ('d7000000-0000-0000-0000-00000000000b', 'c7000000-0000-0000-0000-00000000000b', 'a7010000-0000-0000-0000-000000000003');
insert into public.chat_messages (id, room_id, company_id, sender_member_id, kind, attachment_path, attachment_name, attachment_size, attachment_mime, created_at) values
  ('e7000000-0000-0000-0000-000000000001', 'd7000000-0000-0000-0000-00000000000a', 'c7000000-0000-0000-0000-00000000000a', 'a7010000-0000-0000-0000-000000000001', 'file', 'c7000000-0000-0000-0000-00000000000a/d7000000-0000-0000-0000-00000000000a/1.pdf', '1.pdf', 1048576, 'application/pdf', now() - interval '40 days'),
  ('e7000000-0000-0000-0000-000000000002', 'd7000000-0000-0000-0000-00000000000a', 'c7000000-0000-0000-0000-00000000000a', 'a7010000-0000-0000-0000-000000000001', 'file', 'c7000000-0000-0000-0000-00000000000a/d7000000-0000-0000-0000-00000000000a/2.pdf', '2.pdf', 1048576, 'application/pdf', now() - interval '70 days'),
  ('e7000000-0000-0000-0000-000000000003', 'd7000000-0000-0000-0000-00000000000b', 'c7000000-0000-0000-0000-00000000000b', 'a7010000-0000-0000-0000-000000000003', 'file', 'c7000000-0000-0000-0000-00000000000b/d7000000-0000-0000-0000-00000000000b/3.pdf', '3.pdf', 1048576, 'application/pdf', now() - interval '40 days');

-- ① 채팅 색감: 본인 행만, 정해진 값만, my_membership에 실림
select public._t_as70('a7000000-0000-0000-0000-000000000002');
set local role authenticated;
do $$
declare
  n integer;
begin
  update public.members set chat_theme = 'line' where auth_user_id = 'a7000000-0000-0000-0000-000000000002';
  if public.my_membership() ->> 'chat_theme' <> 'line' then raise exception 'FAIL [chat theme saved]'; end if;
  perform public._t_raises70($q$update public.members set chat_theme = 'yellow' where auth_user_id = 'a7000000-0000-0000-0000-000000000002'$q$, '23514', 'invalid theme');
  update public.members set chat_theme = 'cool' where id = 'a7010000-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL [other member theme]'; end if;
  -- ② 직원은 보관 기간을 못 바꾸고 관리자 화면 정보도 못 봄, 표 직접 쓰기 불가
  perform public._t_raises70($q$select public.chat_set_attachment_days(30)$q$, '42501', 'employee set');
  perform public._t_raises70($q$select public.chat_retention_status()$q$, '42501', 'employee status');
  perform public._t_raises70($q$insert into public.company_chat_settings (company_id, attachment_days) values ('c7000000-0000-0000-0000-00000000000a', 30)$q$, '42501', 'direct write');
  if (public.chat_storage_status() ->> 'days')::integer <> 90 then raise exception 'FAIL [default 90]'; end if;
end;
$$;
reset role;

-- ③ 관리자: 30·60·90만 / 줄이면 비워지는 양 / 기간 바꾸면 직원에게도 보임
select public._t_as70('a7000000-0000-0000-0000-000000000001');
set local role authenticated;
do $$
declare
  s jsonb;
begin
  perform public._t_raises70($q$select public.chat_set_attachment_days(45)$q$, 'INVALID_DAYS', 'invalid days');
  s := public.chat_retention_status();
  if (s ->> 'used')::bigint <> 2097152 or (s ->> 'older_than_30')::bigint <> 2097152 or (s ->> 'older_than_60')::bigint <> 1048576 or (s ->> 'days')::integer <> 90 then
    raise exception 'FAIL [retention status] %', s;
  end if;
  if public.chat_set_attachment_days(60) <> 60 then raise exception 'FAIL [set 60]'; end if;
  if (public.chat_retention_status() ->> 'days')::integer <> 60 then raise exception 'FAIL [read 60]'; end if;
end;
$$;
reset role;
select public._t_as70('a7000000-0000-0000-0000-000000000002');
set local role authenticated;
do $$
begin
  if (public.chat_storage_status() ->> 'days')::integer <> 60 then raise exception 'FAIL [employee sees 60]'; end if;
end;
$$;
reset role;

-- ④ 새벽 정리: A회사(60일) = 70일 전 파일만, B회사(기본 90일) = 없음
do $$
declare
  v_ids uuid[];
begin
  select array_agg(message_id) into v_ids from public.chat_files_due(1000) where message_id::text like 'e7000000%';
  if v_ids is distinct from array['e7000000-0000-0000-0000-000000000002']::uuid[] then raise exception 'FAIL [due 60] %', v_ids; end if;
end;
$$;
-- A회사를 30일로 → 40일 전 파일도, B회사는 여전히 없음 / 다른 회사 관리자는 A 설정을 못 바꿈
select public._t_as70('a7000000-0000-0000-0000-000000000001');
set local role authenticated;
select public.chat_set_attachment_days(30);
reset role;
select public._t_as70('a7000000-0000-0000-0000-000000000003');
set local role authenticated;
select public.chat_set_attachment_days(90);
reset role;
do $$
declare
  v_ids uuid[];
begin
  select array_agg(message_id order by message_id) into v_ids from public.chat_files_due(1000) where message_id::text like 'e7000000%';
  if v_ids is distinct from array['e7000000-0000-0000-0000-000000000001', 'e7000000-0000-0000-0000-000000000002']::uuid[] then raise exception 'FAIL [due 30] %', v_ids; end if;
  if (select attachment_days from public.company_chat_settings where company_id = 'c7000000-0000-0000-0000-00000000000a') <> 30 then raise exception 'FAIL [A kept 30]'; end if;
end;
$$;

-- ⑤ 메신저가 꺼진 회사도 바꿀 수 있음(D-218: 보관 기간은 회의 자료에도 적용)
update public.company_features set enabled = false where company_id = 'c7000000-0000-0000-0000-00000000000b' and feature = 'messenger';
select public._t_as70('a7000000-0000-0000-0000-000000000003');
set local role authenticated;
do $$
begin
  if public.chat_set_attachment_days(30) <> 30 then raise exception 'FAIL [messenger off can set]'; end if;
end;
$$;
reset role;

select 'ok' as chat_theme_retention_070;
rollback;
