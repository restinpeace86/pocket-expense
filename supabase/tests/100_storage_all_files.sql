-- 100_storage_all_files.sql — 회사 저장 공간 = 모든 파일 합계, 꽉 차면 모든 올리기 막힘(D-286, migration 164)
begin;
create function public._t_ok100(p_cond boolean, p_label text) returns void language plpgsql as $$
begin
  if not coalesce(p_cond, false) then raise exception 'FAIL [%]', p_label; end if;
end;
$$;
grant execute on function public._t_ok100(boolean, text) to authenticated;
create function public._t_as100(p_uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
end;
$$;

insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at) values
  ('a1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'boss100@test.local', now()),
  ('a1000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'emp100@test.local', now()),
  ('a1000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bemp100@test.local', now());
insert into public.companies (id, name, invite_code, business_number) values
  ('c1000000-0000-0000-0000-00000000000a', '공간A', 'SPAAAAAA', '1000001001'),
  ('c1000000-0000-0000-0000-00000000000b', '공간B', 'SPBBBBBB', '1000001002');
insert into public.members (id, auth_user_id, company_id, name, phone, role, status, privacy_agreed_at, approved_at) values
  ('a1010000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-00000000000a', 'A대표', '01010001001', 'super_admin', 'approved', now(), now()),
  ('a1010000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-00000000000a', 'A직원', '01010001002', 'employee', 'approved', now(), now()),
  ('a1010000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-00000000000b', 'B직원', '01010001003', 'employee', 'approved', now(), now());
insert into public.company_forms (id, company_id, group_id, version, kind, doc_type, name, status, sheets, fields, source_path, mime) values
  ('f1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-00000000000a', 'f1000000-0000-0000-0000-000000000001', 1, 'general', 'other', '문서', 'active',
   '{"v":1,"sheets":[{"name":"1쪽","cols":[100],"heights":[1],"cells":[[{"t":""}]],"merges":[]}]}', '[]', 'c100a/f.png', 'image/png'),
  ('f1000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-00000000000b', 'f1000000-0000-0000-0000-000000000002', 1, 'general', 'other', '문서', 'active',
   '{"v":1,"sheets":[{"name":"1쪽","cols":[100],"heights":[1],"cells":[[{"t":""}]],"merges":[]}]}', '[]', 'c100b/f.png', 'image/png');
insert into public.approval_documents (id, company_id, member_id, member_name, form_id, doc_type, title) values
  ('d1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-00000000000a', 'a1010000-0000-0000-0000-000000000002', 'A직원', 'f1000000-0000-0000-0000-000000000001', 'other', 'x'),
  ('d1000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-00000000000b', 'a1010000-0000-0000-0000-000000000003', 'B직원', 'f1000000-0000-0000-0000-000000000002', 'other', 'x');

-- ① 영수증 1MB·휴가 증빙 2MB → 합계에 들어감, 아직 여유
insert into storage.objects (bucket_id, name, metadata) values
  ('receipts', 'c1000000-0000-0000-0000-00000000000a/r1.jpg', '{"size":1048576}'),
  ('leave-proofs', 'c1000000-0000-0000-0000-00000000000a/x/y/p.pdf', '{"size":2097152}'),
  ('receipts', 'c1000000-0000-0000-0000-00000000000b/r1.jpg', '{"size":5}');
select public._t_ok100(private.docs_storage_used('c1000000-0000-0000-0000-00000000000a') = 3145728, 'docs used A');
select public._t_ok100(private.storage_total_used('c1000000-0000-0000-0000-00000000000a') = 3145728, 'total used A');
select public._t_ok100(private.chat_storage_limit('c1000000-0000-0000-0000-00000000000a') = private.storage_total_limit('c1000000-0000-0000-0000-00000000000a') - 3145728, 'chat limit shrinks');
select public._t_ok100(not private.storage_full_folder('c1000000-0000-0000-0000-00000000000a'), 'not full yet');
select public._t_ok100(not private.storage_full_folder('help'), 'non-uuid folder');

-- 여유 있을 때: 결재 문서 첨부 올리기 됨
select public._t_as100('a1000000-0000-0000-0000-000000000002');
set local role authenticated;
insert into storage.objects (bucket_id, name, metadata, owner_id) values ('approval-files', 'c1000000-0000-0000-0000-00000000000a/a1010000-0000-0000-0000-000000000002/d1000000-0000-0000-0000-000000000001/ok.jpg', '{"size":10}', 'a1000000-0000-0000-0000-000000000002');
select public._t_ok100(not public.storage_is_full(), 'is_full false');
reset role;

-- ② 영수증 원본이 한도를 넘김 → A만 꽉 참
insert into storage.objects (bucket_id, name, metadata) values
  ('receipt-archive', 'c1000000-0000-0000-0000-00000000000a/big.jpg', jsonb_build_object('size', private.storage_total_limit('c1000000-0000-0000-0000-00000000000a')));
select public._t_ok100(private.storage_full_folder('c1000000-0000-0000-0000-00000000000a'), 'A full');
select public._t_ok100(not private.storage_full_folder('c1000000-0000-0000-0000-00000000000b'), 'B not full');
select public._t_ok100(private.chat_storage_limit('c1000000-0000-0000-0000-00000000000a') = 0 and private.vault_limit('c1000000-0000-0000-0000-00000000000a') = 0, 'chat/vault limit 0');

-- 꽉 찬 A 직원: 올리기 막힘(42501) · 화면 안내 true
select public._t_as100('a1000000-0000-0000-0000-000000000002');
set local role authenticated;
do $$
begin
  begin
    insert into storage.objects (bucket_id, name, metadata, owner_id) values ('approval-files', 'c1000000-0000-0000-0000-00000000000a/a1010000-0000-0000-0000-000000000002/d1000000-0000-0000-0000-000000000001/no.jpg', '{"size":10}', 'a1000000-0000-0000-0000-000000000002');
    raise exception 'FAIL [full upload allowed]';
  exception when insufficient_privilege then null;
  end;
end;
$$;
select public._t_ok100(public.storage_is_full(), 'is_full true');
reset role;

-- B 직원(다른 회사)은 그대로 올림
select public._t_as100('a1000000-0000-0000-0000-000000000003');
set local role authenticated;
insert into storage.objects (bucket_id, name, metadata, owner_id) values ('approval-files', 'c1000000-0000-0000-0000-00000000000b/a1010000-0000-0000-0000-000000000003/d1000000-0000-0000-0000-000000000002/ok.jpg', '{"size":10}', 'a1000000-0000-0000-0000-000000000003');
select public._t_ok100(not public.storage_is_full(), 'B is_full false');
reset role;

-- ③ 요금제 화면: 나눠 보기
select public._t_as100('a1000000-0000-0000-0000-000000000001');
set local role authenticated;
select public._t_ok100((select (s->'docs'->>'approvals')::bigint = 2097152 + 10 and (s->>'total_used')::bigint >= (s->>'total_limit')::bigint from (select public.storage_addon_status() s) x), 'status parts');
reset role;

-- ④ 직원은 서버용 확인 함수를 못 부름
select public._t_as100('a1000000-0000-0000-0000-000000000002');
set local role authenticated;
do $$
begin
  begin
    perform public.storage_is_full_for('c1000000-0000-0000-0000-00000000000a');
    raise exception 'FAIL [storage_is_full_for callable]';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;

select 'ok' as storage_all_files_100;
rollback;
