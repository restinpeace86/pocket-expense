-- =============================================================================
-- 085_vault.sql — 채팅 파일 영구 보관 (D-245, migration 134)
-- 보관 확인: 방 참여자·사진/파일·지워지지 않음·중복 없음·한도 / 공개 범위: 나만 보기는 보관한 사람만, 회사 공유는 회사 전체 /
-- 지우기: 보관한 사람, 회사 공유는 관리자도 / 관리자 사람별 사용량(파일 이름 없음) / 한도·70%·90% 안내 /
-- 퇴사자 나만 보기: 퇴사 안내·7일 전 안내·30일 뒤 목록 / 파일 읽기 권한 / 회사 격리 / 서버 전용 함수 막힘
-- =============================================================================
begin;

create function public._t_raises85(p_sql text, p_code text, p_label text)
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
grant execute on function public._t_raises85(text, text, text) to authenticated;
create function public._t_as85(p_uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
end;
$$;

insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at) values
  ('a8600000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'boss85@test.local', now()),
  ('a8600000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'emp85@test.local', now()),
  ('a8600000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'emp285@test.local', now()),
  ('a8600000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bboss85@test.local', now());
insert into public.companies (id, name, invite_code, business_number) values
  ('c8600000-0000-0000-0000-00000000000a', '보관A', 'VAAAAAAA', '1000000851'),
  ('c8600000-0000-0000-0000-00000000000b', '보관B', 'VBBBBBBB', '1000000852');
insert into public.members (id, auth_user_id, company_id, name, phone, role, status, privacy_agreed_at, approved_at) values
  ('a8610000-0000-0000-0000-000000000001', 'a8600000-0000-0000-0000-000000000001', 'c8600000-0000-0000-0000-00000000000a', 'A대표', '01098501001', 'super_admin', 'approved', now(), now()),
  ('a8610000-0000-0000-0000-000000000002', 'a8600000-0000-0000-0000-000000000002', 'c8600000-0000-0000-0000-00000000000a', 'A직원', '01098501002', 'employee', 'approved', now(), now()),
  ('a8610000-0000-0000-0000-000000000003', 'a8600000-0000-0000-0000-000000000003', 'c8600000-0000-0000-0000-00000000000a', 'A직원2', '01098501003', 'employee', 'approved', now(), now()),
  ('a8610000-0000-0000-0000-000000000004', 'a8600000-0000-0000-0000-000000000004', 'c8600000-0000-0000-0000-00000000000b', 'B대표', '01098501004', 'super_admin', 'approved', now(), now());
insert into public.company_features (company_id, feature, enabled) values
  ('c8600000-0000-0000-0000-00000000000a', 'messenger', true), ('c8600000-0000-0000-0000-00000000000b', 'messenger', true)
on conflict (company_id, feature) do update set enabled = true;
-- 방: 대표·직원(직원2는 참여자 아님)
insert into public.chat_rooms (id, company_id, kind, title, created_by_member_id) values
  ('c8620000-0000-0000-0000-000000000001', 'c8600000-0000-0000-0000-00000000000a', 'group', '영업팀', 'a8610000-0000-0000-0000-000000000001');
insert into public.chat_members (room_id, company_id, member_id) values
  ('c8620000-0000-0000-0000-000000000001', 'c8600000-0000-0000-0000-00000000000a', 'a8610000-0000-0000-0000-000000000001'),
  ('c8620000-0000-0000-0000-000000000001', 'c8600000-0000-0000-0000-00000000000a', 'a8610000-0000-0000-0000-000000000002');
insert into public.chat_messages (id, room_id, company_id, sender_member_id, kind, body, attachment_path, attachment_name, attachment_size, attachment_mime, attachment_thumb_path, attachment_thumb_size, deleted_at) values
  ('c8630000-0000-0000-0000-000000000001', 'c8620000-0000-0000-0000-000000000001', 'c8600000-0000-0000-0000-00000000000a', 'a8610000-0000-0000-0000-000000000001', 'file', null, 'c8600000-0000-0000-0000-00000000000a/c8620000-0000-0000-0000-000000000001/m1.pdf', '계약서.pdf', 300000, 'application/pdf', null, null, null),
  ('c8630000-0000-0000-0000-000000000002', 'c8620000-0000-0000-0000-000000000001', 'c8600000-0000-0000-0000-00000000000a', 'a8610000-0000-0000-0000-000000000001', 'image', null, 'c8600000-0000-0000-0000-00000000000a/c8620000-0000-0000-0000-000000000001/m2.jpg', '현장.jpg', 400000, 'image/jpeg', 'c8600000-0000-0000-0000-00000000000a/c8620000-0000-0000-0000-000000000001/m2_thumb.jpg', 40000, null),
  ('c8630000-0000-0000-0000-000000000003', 'c8620000-0000-0000-0000-000000000001', 'c8600000-0000-0000-0000-00000000000a', 'a8610000-0000-0000-0000-000000000001', 'file', null, 'c8600000-0000-0000-0000-00000000000a/c8620000-0000-0000-0000-000000000001/m3.pdf', '지운.pdf', 1000, 'application/pdf', null, null, now()),
  ('c8630000-0000-0000-0000-000000000004', 'c8620000-0000-0000-0000-000000000001', 'c8600000-0000-0000-0000-00000000000a', 'a8610000-0000-0000-0000-000000000001', 'text', '안녕하세요', null, null, null, null, null, null, null);
-- 한도를 1MB로(이 테스트 안에서만)
update public.billing_plans set vault_storage_mb = 1 where code = 'starter';

-- ① 보관 확인
select public._t_as85('a8600000-0000-0000-0000-000000000002');
set local role authenticated;
do $$
declare v jsonb;
begin
  v := public.vault_keep_check('c8630000-0000-0000-0000-000000000001');
  if v ->> 'path' not like '%/m1.pdf' or (v ->> 'size')::integer <> 300000 or v ->> 'member_id' <> 'a8610000-0000-0000-0000-000000000002' then raise exception 'FAIL [check %]', v; end if;
  perform public._t_raises85($q$select public.vault_keep_check('c8630000-0000-0000-0000-000000000003')$q$, 'EXPIRED', 'deleted msg');
  perform public._t_raises85($q$select public.vault_keep_check('c8630000-0000-0000-0000-000000000004')$q$, 'NOT_FILE', 'text msg');
  perform public._t_raises85($q$select public.vault_add('a8610000-0000-0000-0000-000000000002', 'c8630000-0000-0000-0000-000000000001', 'private', 'x', null, 0)$q$, '42501', 'vault_add blocked');
  perform public._t_raises85($q$select public.vault_leaver_files_due()$q$, '42501', 'due blocked');
  perform public._t_raises85($q$select public.storage_total_bytes()$q$, '42501', 'storage total blocked');
  perform public._t_raises85($q$select public.vault_member_usage()$q$, '42501', 'employee usage');
end;
$$;
reset role;
select public._t_as85('a8600000-0000-0000-0000-000000000003');
set local role authenticated;
select public._t_raises85($q$select public.vault_keep_check('c8630000-0000-0000-0000-000000000001')$q$, 'NOT_FOUND', 'not room member');
reset role;
select public._t_as85('a8600000-0000-0000-0000-000000000004');
set local role authenticated;
select public._t_raises85($q$select public.vault_keep_check('c8630000-0000-0000-0000-000000000001')$q$, 'NOT_FOUND', 'other company');
reset role;

-- ② 서버가 복사 뒤 기록(나만 보기) → 다시 보관하면 이미 있음
reset role;
do $$
declare v_id uuid;
begin
  v_id := public.vault_add('a8610000-0000-0000-0000-000000000002', 'c8630000-0000-0000-0000-000000000001', 'private', 'c8600000-0000-0000-0000-00000000000a/v1.pdf', null, 0);
  perform set_config('t.v1', v_id::text, true);
end;
$$;
select public._t_as85('a8600000-0000-0000-0000-000000000002');
set local role authenticated;
do $$
begin
  perform public._t_raises85($q$select public.vault_keep_check('c8630000-0000-0000-0000-000000000001')$q$, 'ALREADY_KEPT', 'twice');
  if (select count(*) from public.vault_files) <> 1 then raise exception 'FAIL [owner sees own private]'; end if;
  if not private.vault_can_read('c8600000-0000-0000-0000-00000000000a/v1.pdf') then raise exception 'FAIL [owner can read file]'; end if;
  if (public.vault_status() ->> 'mine_private')::integer <> 1 or (public.vault_status() ->> 'used')::bigint <> 300000 then raise exception 'FAIL [status %]', public.vault_status(); end if;
end;
$$;
reset role;
-- 대표(관리자)·직원2는 나만 보기 파일이 안 보임, 관리자는 사람별 개수·용량만
select public._t_as85('a8600000-0000-0000-0000-000000000001');
set local role authenticated;
do $$
declare u jsonb;
begin
  if (select count(*) from public.vault_files) <> 0 then raise exception 'FAIL [admin sees private]'; end if;
  if private.vault_can_read('c8600000-0000-0000-0000-00000000000a/v1.pdf') then raise exception 'FAIL [admin reads private file]'; end if;
  u := public.vault_member_usage();
  if jsonb_array_length(u -> 'members') <> 1 or (u -> 'members' -> 0 ->> 'private_count')::integer <> 1 or (u -> 'members' -> 0 ->> 'private_bytes')::bigint <> 300000
     or u::text like '%계약서%' then raise exception 'FAIL [usage %]', u; end if;
  perform public._t_raises85(format($q$select public.vault_delete('%s')$q$, current_setting('t.v1')), 'NOT_ALLOWED', 'admin delete private');
  perform public._t_raises85(format($q$select public.vault_set_scope('%s', 'company')$q$, current_setting('t.v1')), 'NOT_FOUND', 'admin scope');
end;
$$;
reset role;

-- ③ 회사 공유로 바꾸면 회사 전체가 봄(다른 회사는 못 봄) · 직원2는 못 지움 · 관리자는 지움
select public._t_as85('a8600000-0000-0000-0000-000000000002');
set local role authenticated;
select public.vault_set_scope(current_setting('t.v1')::uuid, 'company');
reset role;
select public._t_as85('a8600000-0000-0000-0000-000000000003');
set local role authenticated;
do $$
begin
  if (select count(*) from public.vault_files) <> 1 or not private.vault_can_read('c8600000-0000-0000-0000-00000000000a/v1.pdf') then raise exception 'FAIL [company shared visible]'; end if;
  perform public._t_raises85(format($q$select public.vault_delete('%s')$q$, current_setting('t.v1')), 'NOT_ALLOWED', 'emp2 delete');
end;
$$;
reset role;
select public._t_as85('a8600000-0000-0000-0000-000000000004');
set local role authenticated;
do $$
begin
  if (select count(*) from public.vault_files) <> 0 or private.vault_can_read('c8600000-0000-0000-0000-00000000000a/v1.pdf') then raise exception 'FAIL [cross company]'; end if;
  perform public._t_raises85(format($q$select public.vault_delete('%s')$q$, current_setting('t.v1')), 'NOT_FOUND', 'cross delete');
end;
$$;
reset role;
select public._t_as85('a8600000-0000-0000-0000-000000000001');
set local role authenticated;
do $$
declare d jsonb;
begin
  d := public.vault_delete(current_setting('t.v1')::uuid);
  if d ->> 'path' <> 'c8600000-0000-0000-0000-00000000000a/v1.pdf' or (select count(*) from public.vault_files) <> 0 then raise exception 'FAIL [admin delete shared %]', d; end if;
end;
$$;
reset role;

-- ④ 한도(1MB): 300KB+440KB = 740KB → 70% 안내 1번, 다시 300KB면 넘침(VAULT_FULL)
do $$
declare n integer;
begin
  perform public.vault_add('a8610000-0000-0000-0000-000000000002', 'c8630000-0000-0000-0000-000000000001', 'private', 'c8600000-0000-0000-0000-00000000000a/v2.pdf', null, 0);
  perform public.vault_add('a8610000-0000-0000-0000-000000000002', 'c8630000-0000-0000-0000-000000000002', 'company', 'c8600000-0000-0000-0000-00000000000a/v3.jpg', 'c8600000-0000-0000-0000-00000000000a/v3_thumb.jpg', 40000);
  select count(*) into n from public.chat_messages where company_id = 'c8600000-0000-0000-0000-00000000000a' and kind = 'notice' and body like '파일 보관함이 70%%';
  if n <> 1 then raise exception 'FAIL [70%% notice to 1 admin: %]', n; end if;
  perform public._t_raises85($q$select public.vault_add('a8610000-0000-0000-0000-000000000001', 'c8630000-0000-0000-0000-000000000002', 'private', 'c8600000-0000-0000-0000-00000000000a/v4.jpg', 'c8600000-0000-0000-0000-00000000000a/v4_thumb.jpg', 40000)$q$, 'VAULT_FULL', 'full add');
end;
$$;
select public._t_as85('a8600000-0000-0000-0000-000000000001');
set local role authenticated;
select public._t_raises85($q$select public.vault_keep_check('c8630000-0000-0000-0000-000000000002')$q$, 'VAULT_FULL', 'full check');
reset role;

-- ⑤ 퇴사: 안내 → 7일 전 안내 → 30일 뒤 나만 보기 파일만 목록(회사 공유는 남김)
update public.members set status = 'inactive' where id = 'a8610000-0000-0000-0000-000000000002';
do $$
declare d jsonb;
begin
  if not exists (select 1 from private.vault_leavers where member_id = 'a8610000-0000-0000-0000-000000000002') then raise exception 'FAIL [leaver row]'; end if;
  if (select count(*) from public.chat_messages where company_id = 'c8600000-0000-0000-0000-00000000000a' and kind = 'notice' and body like '퇴사 처리된 A직원%') <> 1 then raise exception 'FAIL [leave notice]'; end if;
  update private.vault_leavers set since = now() - interval '24 days' where member_id = 'a8610000-0000-0000-0000-000000000002';
  d := public.vault_leaver_files_due();
  if jsonb_array_length(d) <> 0 then raise exception 'FAIL [not yet due %]', d; end if;
  if (select count(*) from public.chat_messages where company_id = 'c8600000-0000-0000-0000-00000000000a' and kind = 'notice' and body like '7일 뒤 지워지는%') <> 1 then raise exception 'FAIL [7 day notice]'; end if;
  perform public.vault_leaver_files_due();
  if (select count(*) from public.chat_messages where company_id = 'c8600000-0000-0000-0000-00000000000a' and kind = 'notice' and body like '7일 뒤 지워지는%') <> 1 then raise exception 'FAIL [7 day notice once]'; end if;
  update private.vault_leavers set since = now() - interval '31 days' where member_id = 'a8610000-0000-0000-0000-000000000002';
  d := public.vault_leaver_files_due();
  if jsonb_array_length(d) <> 1 or d -> 0 ->> 'path' <> 'c8600000-0000-0000-0000-00000000000a/v2.pdf' then raise exception 'FAIL [due %]', d; end if;
  if public.vault_files_remove(array[(d -> 0 ->> 'id')::uuid]) <> 1 then raise exception 'FAIL [remove]'; end if;
  if (select count(*) from public.vault_files where company_id = 'c8600000-0000-0000-0000-00000000000a') <> 1 then raise exception 'FAIL [shared kept]'; end if;
end;
$$;
-- 다시 활성화되면 퇴사 기록 지움
update public.members set status = 'approved' where id = 'a8610000-0000-0000-0000-000000000002';
do $$
begin
  if exists (select 1 from private.vault_leavers where member_id = 'a8610000-0000-0000-0000-000000000002') then raise exception 'FAIL [reactivate clears]'; end if;
end;
$$;

select 'ok' as vault_085;
rollback;
