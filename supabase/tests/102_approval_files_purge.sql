-- 102_approval_files_purge.sql — 결재 문서 첨부 일괄 정리(D-291, migration 166)
-- 관리자만 · 승인된 문서만 · 기간(3·6·12개월·전부) · 저장소에서 없어진 것만 기록 지움 · 다른 회사 첨부 손대지 않음
begin;
create function public._t_raises102(p_sql text, p_code text, p_label text)
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
grant execute on function public._t_raises102(text, text, text) to authenticated;
create function public._t_as102(p_uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
end;
$$;
create function public._t_ok102(p_cond boolean, p_label text) returns void language plpgsql as $$
begin
  if not coalesce(p_cond, false) then raise exception 'FAIL [%]', p_label; end if;
end;
$$;
grant execute on function public._t_ok102(boolean, text) to authenticated;

insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at) values
  ('a1020000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'adm102@test.local', now()),
  ('a1020000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'emp102@test.local', now()),
  ('a1020000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'badm102@test.local', now());
insert into public.companies (id, name, invite_code, business_number) values
  ('c1020000-0000-0000-0000-00000000000a', '정리A', 'PGAAAAAA', '1000001021'),
  ('c1020000-0000-0000-0000-00000000000b', '정리B', 'PGBBBBBB', '1000001022');
insert into public.members (id, auth_user_id, company_id, name, phone, role, status, privacy_agreed_at, approved_at) values
  ('a1021000-0000-0000-0000-000000000001', 'a1020000-0000-0000-0000-000000000001', 'c1020000-0000-0000-0000-00000000000a', 'A관리', '01010201001', 'super_admin', 'approved', now(), now()),
  ('a1021000-0000-0000-0000-000000000002', 'a1020000-0000-0000-0000-000000000002', 'c1020000-0000-0000-0000-00000000000a', 'A직원', '01010201002', 'employee', 'approved', now(), now()),
  ('a1021000-0000-0000-0000-000000000003', 'a1020000-0000-0000-0000-000000000003', 'c1020000-0000-0000-0000-00000000000b', 'B관리', '01010201003', 'super_admin', 'approved', now(), now());
insert into public.company_forms (id, company_id, group_id, version, kind, doc_type, name, status, sheets, fields, source_path, mime) values
  ('f1020000-0000-0000-0000-00000000000a', 'c1020000-0000-0000-0000-00000000000a', 'f1020000-0000-0000-0000-00000000000a', 1, 'general', 'pumui', '품의서', 'active', '{"v":1,"sheets":[]}', '[]', 'c102a/f.png', 'image/png'),
  ('f1020000-0000-0000-0000-00000000000b', 'c1020000-0000-0000-0000-00000000000b', 'f1020000-0000-0000-0000-00000000000b', 1, 'general', 'pumui', '품의서', 'active', '{"v":1,"sheets":[]}', '[]', 'c102b/f.png', 'image/png');
-- A 문서: d1 승인 8개월 전 · d2 승인 2개월 전 · d3 반려 1년 전 · d4 결재 중
-- B 문서: e1 승인 2년 전
insert into public.approval_documents (id, company_id, member_id, member_name, form_id, doc_type, title, status, current_round, submitted_at, decided_at, updated_at) values
  ('d1020000-0000-0000-0000-000000000001', 'c1020000-0000-0000-0000-00000000000a', 'a1021000-0000-0000-0000-000000000002', 'A직원', 'f1020000-0000-0000-0000-00000000000a', 'pumui', '옛 승인', 'approved', 1, now() - interval '8 months', now() - interval '8 months', now() - interval '8 months'),
  ('d1020000-0000-0000-0000-000000000002', 'c1020000-0000-0000-0000-00000000000a', 'a1021000-0000-0000-0000-000000000002', 'A직원', 'f1020000-0000-0000-0000-00000000000a', 'pumui', '최근 승인', 'approved', 1, now() - interval '2 months', now() - interval '2 months', now() - interval '2 months'),
  ('d1020000-0000-0000-0000-000000000003', 'c1020000-0000-0000-0000-00000000000a', 'a1021000-0000-0000-0000-000000000002', 'A직원', 'f1020000-0000-0000-0000-00000000000a', 'pumui', '반려', 'rejected', 1, now() - interval '1 year', now() - interval '1 year', now() - interval '1 year'),
  ('d1020000-0000-0000-0000-000000000004', 'c1020000-0000-0000-0000-00000000000a', 'a1021000-0000-0000-0000-000000000002', 'A직원', 'f1020000-0000-0000-0000-00000000000a', 'pumui', '결재 중', 'submitted', 1, now() - interval '1 year', null, now() - interval '1 year'),
  ('e1020000-0000-0000-0000-000000000001', 'c1020000-0000-0000-0000-00000000000b', 'a1021000-0000-0000-0000-000000000003', 'B관리', 'f1020000-0000-0000-0000-00000000000b', 'pumui', 'B 승인', 'approved', 1, now() - interval '2 years', now() - interval '2 years', now() - interval '2 years');
insert into public.approval_document_files (company_id, member_id, document_id, path, name, mime, size) values
  ('c1020000-0000-0000-0000-00000000000a', 'a1021000-0000-0000-0000-000000000002', 'd1020000-0000-0000-0000-000000000001', 'c1020000-0000-0000-0000-00000000000a/a1021000-0000-0000-0000-000000000002/d1020000-0000-0000-0000-000000000001/a.jpg', 'a.jpg', 'image/jpeg', 1000),
  ('c1020000-0000-0000-0000-00000000000a', 'a1021000-0000-0000-0000-000000000002', 'd1020000-0000-0000-0000-000000000001', 'c1020000-0000-0000-0000-00000000000a/a1021000-0000-0000-0000-000000000002/d1020000-0000-0000-0000-000000000001/b.pdf', 'b.pdf', 'application/pdf', 2000),
  ('c1020000-0000-0000-0000-00000000000a', 'a1021000-0000-0000-0000-000000000002', 'd1020000-0000-0000-0000-000000000002', 'c1020000-0000-0000-0000-00000000000a/a1021000-0000-0000-0000-000000000002/d1020000-0000-0000-0000-000000000002/c.jpg', 'c.jpg', 'image/jpeg', 300),
  ('c1020000-0000-0000-0000-00000000000a', 'a1021000-0000-0000-0000-000000000002', 'd1020000-0000-0000-0000-000000000003', 'c1020000-0000-0000-0000-00000000000a/a1021000-0000-0000-0000-000000000002/d1020000-0000-0000-0000-000000000003/r.jpg', 'r.jpg', 'image/jpeg', 50),
  ('c1020000-0000-0000-0000-00000000000a', 'a1021000-0000-0000-0000-000000000002', 'd1020000-0000-0000-0000-000000000004', 'c1020000-0000-0000-0000-00000000000a/a1021000-0000-0000-0000-000000000002/d1020000-0000-0000-0000-000000000004/s.jpg', 's.jpg', 'image/jpeg', 50),
  ('c1020000-0000-0000-0000-00000000000b', 'a1021000-0000-0000-0000-000000000003', 'e1020000-0000-0000-0000-000000000001', 'c1020000-0000-0000-0000-00000000000b/a1021000-0000-0000-0000-000000000003/e1020000-0000-0000-0000-000000000001/x.jpg', 'x.jpg', 'image/jpeg', 70);
-- 저장소에 아직 남아 있는 것: d1의 b.pdf(지우기 실패 흉내) — 이건 기록을 지우면 안 됨
insert into storage.objects (bucket_id, name, metadata) values
  ('approval-files', 'c1020000-0000-0000-0000-00000000000a/a1021000-0000-0000-0000-000000000002/d1020000-0000-0000-0000-000000000001/b.pdf', '{"size":2000}');

-- ① 직원은 못 씀
select public._t_as102('a1020000-0000-0000-0000-000000000002');
set local role authenticated;
select public._t_raises102('select public.approval_doc_purge_status()', '42501', 'employee status');
select public._t_raises102('select public.approval_doc_purge_list(0)', '42501', 'employee list');
select public._t_raises102($q$select public.approval_doc_purge_done(array['x'])$q$, '42501', 'employee done');
reset role;

-- ② A 관리자: 기간별 개수 · 승인된 것만 · B 것 안 보임 · 잘못된 기간 막힘
select public._t_as102('a1020000-0000-0000-0000-000000000001');
set local role authenticated;
do $$
declare s jsonb := public.approval_doc_purge_status(); l text[];
begin
  perform public._t_ok102((s->'3'->>'docs')::int = 1 and (s->'3'->>'files')::int = 2 and (s->'3'->>'bytes')::bigint = 3000, 'status 3m = d1 only');
  perform public._t_ok102((s->'6'->>'files')::int = 2, 'status 6m');
  perform public._t_ok102((s->'12'->>'files')::int = 0, 'status 12m empty');
  perform public._t_ok102((s->'0'->>'docs')::int = 2 and (s->'0'->>'files')::int = 3 and (s->'0'->>'bytes')::bigint = 3300, 'status all = approved only');
  perform public._t_raises102('select public.approval_doc_purge_list(5)', 'INVALID_MONTHS', 'bad months');
  l := public.approval_doc_purge_list(3);
  perform public._t_ok102(cardinality(l) = 2 and l[1] like 'c1020000-0000-0000-0000-00000000000a/%' and l[2] like 'c1020000-0000-0000-0000-00000000000a/%', 'list 3m');
  -- 다른 회사·반려·결재 중 경로를 넘겨도 지우지 않음, 저장소에 남은 b.pdf도 그대로
  perform public._t_ok102(public.approval_doc_purge_done(l || array[
    'c1020000-0000-0000-0000-00000000000b/a1021000-0000-0000-0000-000000000003/e1020000-0000-0000-0000-000000000001/x.jpg',
    'c1020000-0000-0000-0000-00000000000a/a1021000-0000-0000-0000-000000000002/d1020000-0000-0000-0000-000000000003/r.jpg',
    'c1020000-0000-0000-0000-00000000000a/a1021000-0000-0000-0000-000000000002/d1020000-0000-0000-0000-000000000004/s.jpg']) = 1, 'done = only removed object');
  perform public._t_ok102((select count(*) from public.approval_document_files where document_id = 'd1020000-0000-0000-0000-000000000001') = 1, 'b.pdf record kept');
  perform public._t_ok102((select count(*) from public.approval_document_files where document_id in ('d1020000-0000-0000-0000-000000000003', 'd1020000-0000-0000-0000-000000000004')) = 2, 'rejected/submitted kept');
  perform public._t_ok102((select files_purged = 1 and files_purged_at is not null and updated_at < now() - interval '7 months' from public.approval_documents where id = 'd1020000-0000-0000-0000-000000000001'), 'doc marked, updated_at same');
  perform public._t_ok102((select files_purged = 0 from public.approval_documents where id = 'd1020000-0000-0000-0000-000000000002'), 'recent untouched');
  perform public._t_raises102('select public.approval_doc_purge_done(array(select g::text from generate_series(1, 501) g))', 'TOO_MANY', 'too many');
end;
$$;
reset role;
do $$ begin
  perform public._t_ok102((select count(*) from public.approval_document_files where company_id = 'c1020000-0000-0000-0000-00000000000b') = 1, 'B file kept');
end $$;

-- ③ 일반 관리자(admin)도 쓸 수 있음 · 직접 고치기 막힘
update public.members set role = 'admin' where id = 'a1021000-0000-0000-0000-000000000001';
select public._t_as102('a1020000-0000-0000-0000-000000000001');
set local role authenticated;
select public._t_ok102((public.approval_doc_purge_status()->'0'->>'files')::int = 2, 'admin role ok');
select public._t_raises102($q$update public.approval_documents set files_purged = 9$q$, '42501', 'direct update blocked');
reset role;

select 'ok' as approval_files_purge_102;
rollback;
