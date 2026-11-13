-- 094_vault_trash.sql — 파일 보관함 휴지통(9-22, migration 155)
-- 플랜 일수 / 지우기 = 휴지통(목록에서 빠짐·용량은 그대로·파일 못 엶) / 휴지통 보기·복구·영구 삭제 권한(보관한 사람, 회사 공유는 관리자) /
-- 다른 직원·다른 회사 막힘 / 휴지통에 있으면 다시 보관 대신 IN_TRASH / 비우기 / 기간 지난 것만 밤 작업 목록 / 서버 전용 함수 막힘
begin;
create function public._t_raises94(p_sql text, p_code text, p_label text)
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
grant execute on function public._t_raises94(text, text, text) to authenticated;
create function public._t_as94(p_uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
end;
$$;

insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at) values
  ('a9400000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'boss94@test.local', now()),
  ('a9400000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'emp94@test.local', now()),
  ('a9400000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'emp294@test.local', now()),
  ('a9400000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bboss94@test.local', now());
insert into public.companies (id, name, invite_code, business_number) values
  ('c9400000-0000-0000-0000-00000000000a', '휴지A', 'TRAAAAAA', '1000000941'),
  ('c9400000-0000-0000-0000-00000000000b', '휴지B', 'TRBBBBBB', '1000000942');
insert into public.members (id, auth_user_id, company_id, name, phone, role, status, privacy_agreed_at, approved_at) values
  ('a9410000-0000-0000-0000-000000000001', 'a9400000-0000-0000-0000-000000000001', 'c9400000-0000-0000-0000-00000000000a', 'A대표', '01099401001', 'super_admin', 'approved', now(), now()),
  ('a9410000-0000-0000-0000-000000000002', 'a9400000-0000-0000-0000-000000000002', 'c9400000-0000-0000-0000-00000000000a', 'A직원', '01099401002', 'employee', 'approved', now(), now()),
  ('a9410000-0000-0000-0000-000000000003', 'a9400000-0000-0000-0000-000000000003', 'c9400000-0000-0000-0000-00000000000a', 'A직원2', '01099401003', 'employee', 'approved', now(), now()),
  ('a9410000-0000-0000-0000-000000000004', 'a9400000-0000-0000-0000-000000000004', 'c9400000-0000-0000-0000-00000000000b', 'B대표', '01099401004', 'super_admin', 'approved', now(), now());
insert into public.company_features (company_id, feature, enabled) values ('c9400000-0000-0000-0000-00000000000a', 'messenger', true)
on conflict (company_id, feature) do update set enabled = true;
insert into public.chat_rooms (id, company_id, kind, title, created_by_member_id) values
  ('c9420000-0000-0000-0000-000000000001', 'c9400000-0000-0000-0000-00000000000a', 'group', '총무', 'a9410000-0000-0000-0000-000000000001');
insert into public.chat_members (room_id, company_id, member_id) values
  ('c9420000-0000-0000-0000-000000000001', 'c9400000-0000-0000-0000-00000000000a', 'a9410000-0000-0000-0000-000000000001'),
  ('c9420000-0000-0000-0000-000000000001', 'c9400000-0000-0000-0000-00000000000a', 'a9410000-0000-0000-0000-000000000002');
insert into public.chat_messages (id, room_id, company_id, sender_member_id, kind, attachment_path, attachment_name, attachment_size, attachment_mime) values
  ('c9430000-0000-0000-0000-000000000001', 'c9420000-0000-0000-0000-000000000001', 'c9400000-0000-0000-0000-00000000000a', 'a9410000-0000-0000-0000-000000000001', 'file', 'c9400000-0000-0000-0000-00000000000a/c9420000-0000-0000-0000-000000000001/m1.pdf', '계약서.pdf', 1000, 'application/pdf');
-- 보관 파일: 직원 나만 보기(p1), 직원 회사 공유(s1), 직원 회사 공유(s2)
insert into public.vault_files (id, company_id, owner_member_id, scope, name, kind, mime, size, path, source_room_id, source_message_id) values
  ('f9400000-0000-0000-0000-000000000001', 'c9400000-0000-0000-0000-00000000000a', 'a9410000-0000-0000-0000-000000000002', 'private', '나만.pdf', 'file', 'application/pdf', 1000, 'c9400000-0000-0000-0000-00000000000a/p1.pdf', 'c9420000-0000-0000-0000-000000000001', 'c9430000-0000-0000-0000-000000000001'),
  ('f9400000-0000-0000-0000-000000000002', 'c9400000-0000-0000-0000-00000000000a', 'a9410000-0000-0000-0000-000000000002', 'company', '공유1.pdf', 'file', 'application/pdf', 2000, 'c9400000-0000-0000-0000-00000000000a/s1.pdf', null, null),
  ('f9400000-0000-0000-0000-000000000003', 'c9400000-0000-0000-0000-00000000000a', 'a9410000-0000-0000-0000-000000000002', 'company', '공유2.pdf', 'file', 'application/pdf', 3000, 'c9400000-0000-0000-0000-00000000000a/s2.pdf', null, null);

-- ① 플랜 일수, 지금 적용 = 프로 90일
do $$
begin
  if (select trash_days from public.billing_plans where code = 'starter') <> 30 or (select trash_days from public.billing_plans where code = 'standard') <> 90 or (select trash_days from public.billing_plans where code = 'pro') <> 365 then raise exception 'FAIL [plan days]'; end if;
  if private.vault_trash_days('c9400000-0000-0000-0000-00000000000a') <> 90 then raise exception 'FAIL [effective 90]'; end if;
end;
$$;

-- ② 직원: 나만 보기 지움 → 휴지통(목록 빠짐, 휴지통엔 보임, 용량 그대로, 파일 못 엶) → 다시 보관 = IN_TRASH → 복구
select public._t_as94('a9400000-0000-0000-0000-000000000002');
set local role authenticated;
do $$
declare d jsonb; s jsonb;
begin
  d := public.vault_delete('f9400000-0000-0000-0000-000000000001');
  if not (d ->> 'trashed')::boolean or (d ->> 'days')::int <> 90 then raise exception 'FAIL [trash %]', d; end if;
  if (select count(*) from public.vault_files where deleted_at is null) <> 2 then raise exception 'FAIL [list excludes trash]'; end if;
  if (select count(*) from public.vault_files where deleted_at is not null) <> 1 then raise exception 'FAIL [own trash visible]'; end if;
  s := public.vault_status();
  if (s ->> 'used')::bigint <> 6000 or (s ->> 'trash_count')::int <> 1 or (s ->> 'trash_bytes')::bigint <> 1000 or (s ->> 'mine_private')::int <> 0 then raise exception 'FAIL [status %]', s; end if;
  if private.vault_can_read('c9400000-0000-0000-0000-00000000000a/p1.pdf') then raise exception 'FAIL [trash not readable]'; end if;
  perform public._t_raises94($q$select public.vault_delete('f9400000-0000-0000-0000-000000000001')$q$, 'NOT_FOUND', 'delete twice');
  perform public._t_raises94($q$select public.vault_set_scope('f9400000-0000-0000-0000-000000000001', 'company')$q$, 'NOT_FOUND', 'scope in trash');
end;
$$;
reset role;
select public._t_as94('a9400000-0000-0000-0000-000000000001');
set local role authenticated;
do $$
begin
  -- 대표가 같은 메시지를 보관하려 하면(대표 것은 없음) 통과, 직원은 IN_TRASH
  perform public.vault_keep_check('c9430000-0000-0000-0000-000000000001');
  -- 관리자도 남의 나만 보기 휴지통은 못 봄·못 복구
  if exists (select 1 from public.vault_files where id = 'f9400000-0000-0000-0000-000000000001') then raise exception 'FAIL [admin sees private trash]'; end if;
  perform public._t_raises94($q$select public.vault_restore('f9400000-0000-0000-0000-000000000001')$q$, 'NOT_ALLOWED', 'admin restore private');
end;
$$;
reset role;
select public._t_as94('a9400000-0000-0000-0000-000000000002');
set local role authenticated;
do $$
begin
  perform public._t_raises94($q$select public.vault_keep_check('c9430000-0000-0000-0000-000000000001')$q$, 'IN_TRASH', 'keep in trash');
  perform public.vault_restore('f9400000-0000-0000-0000-000000000001');
  if (select count(*) from public.vault_files where deleted_at is null) <> 3 then raise exception 'FAIL [restored]'; end if;
  perform public._t_raises94($q$select public.vault_keep_check('c9430000-0000-0000-0000-000000000001')$q$, 'ALREADY_KEPT', 'keep again after restore');
end;
$$;
reset role;

-- ③ 관리자: 직원의 회사 공유 지움 → 휴지통에서 보임 → 다른 직원2는 못 봄·못 복구 → 다른 회사 못 봄
select public._t_as94('a9400000-0000-0000-0000-000000000001');
set local role authenticated;
do $$
begin
  perform public.vault_delete('f9400000-0000-0000-0000-000000000002');
  perform public.vault_delete('f9400000-0000-0000-0000-000000000003');
  if (select count(*) from public.vault_files where deleted_at is not null) <> 2 then raise exception 'FAIL [admin trash 2]'; end if;
end;
$$;
reset role;
select public._t_as94('a9400000-0000-0000-0000-000000000003');
set local role authenticated;
do $$
begin
  if exists (select 1 from public.vault_files where deleted_at is not null) then raise exception 'FAIL [emp2 sees trash]'; end if;
  perform public._t_raises94($q$select public.vault_restore('f9400000-0000-0000-0000-000000000002')$q$, 'NOT_ALLOWED', 'emp2 restore');
  perform public._t_raises94($q$select public.vault_purge('f9400000-0000-0000-0000-000000000002')$q$, 'NOT_ALLOWED', 'emp2 purge');
  if jsonb_array_length(public.vault_empty_trash()) <> 0 then raise exception 'FAIL [emp2 empty nothing]'; end if;
end;
$$;
reset role;
select public._t_as94('a9400000-0000-0000-0000-000000000004');
set local role authenticated;
do $$
begin
  if exists (select 1 from public.vault_files) then raise exception 'FAIL [cross company]'; end if;
  perform public._t_raises94($q$select public.vault_restore('f9400000-0000-0000-0000-000000000002')$q$, 'NOT_FOUND', 'cross restore');
end;
$$;
reset role;

-- ④ 영구 삭제(관리자 1개) → 밤 작업: 90일 안은 안 나오고, 지난 것만
select public._t_as94('a9400000-0000-0000-0000-000000000001');
set local role authenticated;
do $$
declare d jsonb;
begin
  d := public.vault_purge('f9400000-0000-0000-0000-000000000002');
  if d ->> 'path' <> 'c9400000-0000-0000-0000-00000000000a/s1.pdf' then raise exception 'FAIL [purge path %]', d; end if;
  perform public._t_raises94('select public.vault_trash_due()', '42501', 'due blocked');
end;
$$;
reset role;
do $$
begin
  if jsonb_array_length(public.vault_trash_due()) <> 0 then raise exception 'FAIL [not due yet]'; end if;
  update public.vault_files set deleted_at = now() - interval '91 days' where id = 'f9400000-0000-0000-0000-000000000003';
  if (public.vault_trash_due() -> 0 ->> 'path') <> 'c9400000-0000-0000-0000-00000000000a/s2.pdf' or jsonb_array_length(public.vault_trash_due()) <> 1 then raise exception 'FAIL [due %]', public.vault_trash_due(); end if;
end;
$$;

-- ⑤ 비우기(관리자): 남은 회사 공유 휴지통 → 경로, 남은 휴지통 0
select public._t_as94('a9400000-0000-0000-0000-000000000001');
set local role authenticated;
do $$
declare d jsonb;
begin
  d := public.vault_empty_trash();
  if jsonb_array_length(d) <> 1 or (d -> 0 ->> 'path') <> 'c9400000-0000-0000-0000-00000000000a/s2.pdf' then raise exception 'FAIL [empty %]', d; end if;
  if (public.vault_status() ->> 'trash_count')::int <> 0 then raise exception 'FAIL [trash 0]'; end if;
end;
$$;
reset role;

select 'ok' as vault_trash_094;
rollback;
