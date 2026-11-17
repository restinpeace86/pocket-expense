-- 099_approval_documents.sql — [결재 문서](9-33e2, migration 163)
-- 쓰기·저장·필수 칸·올리기(결재라인 복사)·회수(첫 결재 전까지)·검토 → 관리자 최종·반려 → 다시 올리기·대표 본인 승인
-- 볼 수 있는 사람(쓴 사람·검토자·관리자는 올린 뒤부터)·다른 회사·다른 직원 막힘·직접 쓰기 막힘·첨부 경로 확인
begin;
create function public._t_raises99(p_sql text, p_code text, p_label text)
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
grant execute on function public._t_raises99(text, text, text) to authenticated;
create function public._t_as99(p_uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
end;
$$;
create function public._t_ok99(p_cond boolean, p_label text) returns void language plpgsql as $$
begin
  if not coalesce(p_cond, false) then raise exception 'FAIL [%]', p_label; end if;
end;
$$;
grant execute on function public._t_ok99(boolean, text) to authenticated;

insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at) values
  ('a9900000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'boss99@test.local', now()),
  ('a9900000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'adm99@test.local', now()),
  ('a9900000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'lead99@test.local', now()),
  ('a9900000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'emp99@test.local', now()),
  ('a9900000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'emp99b@test.local', now()),
  ('a9900000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bboss99@test.local', now());
insert into public.companies (id, name, invite_code, business_number) values
  ('c9900000-0000-0000-0000-00000000000a', '결재A', 'ADAAAAAA', '1000000991'),
  ('c9900000-0000-0000-0000-00000000000b', '결재B', 'ADBBBBBB', '1000000992');
insert into public.members (id, auth_user_id, company_id, name, phone, role, status, privacy_agreed_at, approved_at) values
  ('a9910000-0000-0000-0000-000000000001', 'a9900000-0000-0000-0000-000000000001', 'c9900000-0000-0000-0000-00000000000a', 'A대표', '01099901001', 'super_admin', 'approved', now(), now()),
  ('a9910000-0000-0000-0000-000000000002', 'a9900000-0000-0000-0000-000000000002', 'c9900000-0000-0000-0000-00000000000a', 'A관리', '01099901002', 'admin', 'approved', now(), now()),
  ('a9910000-0000-0000-0000-000000000003', 'a9900000-0000-0000-0000-000000000003', 'c9900000-0000-0000-0000-00000000000a', 'A팀장', '01099901003', 'employee', 'approved', now(), now()),
  ('a9910000-0000-0000-0000-000000000004', 'a9900000-0000-0000-0000-000000000004', 'c9900000-0000-0000-0000-00000000000a', 'A직원', '01099901004', 'employee', 'approved', now(), now()),
  ('a9910000-0000-0000-0000-000000000005', 'a9900000-0000-0000-0000-000000000005', 'c9900000-0000-0000-0000-00000000000a', 'A직원2', '01099901005', 'employee', 'approved', now(), now()),
  ('a9910000-0000-0000-0000-000000000006', 'a9900000-0000-0000-0000-000000000006', 'c9900000-0000-0000-0000-00000000000b', 'B대표', '01099901006', 'super_admin', 'approved', now(), now());
-- 회사 기본 결재라인: A팀장 검토 1단계
delete from public.approval_lines where company_id = 'c9900000-0000-0000-0000-00000000000a';
insert into public.approval_lines (id, company_id, name) values ('99a00000-0000-0000-0000-000000000001', 'c9900000-0000-0000-0000-00000000000a', '기본');
insert into public.approval_line_steps (approval_line_id, company_id, step_order, approver_member_id) values
  ('99a00000-0000-0000-0000-000000000001', 'c9900000-0000-0000-0000-00000000000a', 1, 'a9910000-0000-0000-0000-000000000003');
-- 등록된 결재 문서 양식(품의서): 제목(필수) f1 · 금액 f2
insert into public.company_forms (id, company_id, group_id, version, kind, doc_type, name, status, sheets, fields, source_path, mime) values
  ('f9900000-0000-0000-0000-000000000001', 'c9900000-0000-0000-0000-00000000000a', 'f9900000-0000-0000-0000-000000000001', 1, 'general', 'pumui', '품의서', 'active',
   '{"v":1,"sheets":[{"name":"1쪽","cols":[50,50],"heights":[1,1],"cells":[[{"t":"건명"},{"t":""}],[{"t":"금액"},{"t":""}]],"merges":[]}]}',
   '[{"key":"f1","label":"건명","s":0,"r":0,"c":1,"b":{"k":"input","type":"text","required":true,"std":"title"}},{"key":"f2","label":"금액","s":0,"r":1,"c":1,"b":{"k":"input","type":"money","required":false,"std":"amount"}}]',
   'c99a/f1.png', 'image/png');

-- ① 직원: 새로 쓰기 → 작성 중, 저장, 필수 칸 비면 못 올림, 직접 쓰기 막힘
select public._t_as99('a9900000-0000-0000-0000-000000000004');
set local role authenticated;
do $$
declare v uuid;
begin
  v := public.approval_doc_create('f9900000-0000-0000-0000-000000000001');
  perform set_config('t.d1', v::text, true);
  perform public._t_ok99((select status = 'draft' and doc_type = 'pumui' and title = '품의서' from public.approval_documents where id = v), 'create draft');
  perform public.approval_doc_save(v, 'A사 영상', '{"f2":"2200000"}'::jsonb);
  perform public._t_raises99(format('select public.approval_doc_submit(%L)', v), 'REQUIRED_MISSING', 'required');
  perform public.approval_doc_save(v, 'A사 영상', '{"f1":"A사 홍보 영상","f2":"2200000"}'::jsonb);
  perform public._t_raises99(format($q$insert into public.approval_documents (company_id, member_id, member_name, form_id, doc_type, title) values ('c9900000-0000-0000-0000-00000000000a', 'a9910000-0000-0000-0000-000000000004', 'x', 'f9900000-0000-0000-0000-000000000001', 'other', 'x')$q$), '42501', 'direct insert');
  perform public._t_raises99(format('select public.approval_doc_save(%L, %L, %L::jsonb)', v, '', '{}'), 'INVALID_TITLE', 'empty title');
end;
$$;
reset role;

-- ② 관리자는 작성 중 문서를 못 봄
select public._t_as99('a9900000-0000-0000-0000-000000000002');
set local role authenticated;
select public._t_ok99((select count(*) = 0 from public.approval_documents where id = current_setting('t.d1')::uuid), 'admin cannot see draft');
reset role;

-- ③ 올리기 → 팀장 검토 대기 + 관리자 최종 대기, 팀장에게 [알림]
select public._t_as99('a9900000-0000-0000-0000-000000000004');
set local role authenticated;
select public._t_ok99(public.approval_doc_submit(current_setting('t.d1')::uuid) = 'submitted', 'submit');
reset role;
do $$
begin
  perform public._t_ok99((select string_agg(step_kind || ':' || status, ',' order by step_order) from public.approval_document_steps where document_id = current_setting('t.d1')::uuid) = 'review:pending,final:waiting', 'steps r1');
  perform public._t_ok99((select approver_member_id from public.approval_document_steps where document_id = current_setting('t.d1')::uuid and step_order = 1) = 'a9910000-0000-0000-0000-000000000003', 'reviewer = lead');
end;
$$;

-- ④ 보는 사람: 쓴 사람·검토자·관리자 O / 다른 직원·다른 회사 X (문서·단계 모두)
do $$
declare u text; n int;
begin
  foreach u in array array['a9900000-0000-0000-0000-000000000004', 'a9900000-0000-0000-0000-000000000003', 'a9900000-0000-0000-0000-000000000002'] loop
    perform public._t_as99(u);
    set local role authenticated;
    select count(*) into n from public.approval_documents where id = current_setting('t.d1')::uuid;
    reset role;
    perform public._t_ok99(n = 1, 'visible ' || u);
  end loop;
  foreach u in array array['a9900000-0000-0000-0000-000000000005', 'a9900000-0000-0000-0000-000000000006'] loop
    perform public._t_as99(u);
    set local role authenticated;
    select count(*) into n from public.approval_documents where id = current_setting('t.d1')::uuid;
    select n + count(*) into n from public.approval_document_steps where document_id = current_setting('t.d1')::uuid;
    reset role;
    perform public._t_ok99(n = 0, 'hidden ' || u);
  end loop;
end;
$$;

-- ⑤ 다른 직원·다른 회사·관리자(검토 차례)·쓴 사람은 처리 못 함
do $$
begin
  perform public._t_as99('a9900000-0000-0000-0000-000000000005');
  set local role authenticated;
  perform public._t_raises99(format('select public.approval_doc_approve(%L)', current_setting('t.d1')), '42501', 'other emp approve');
  perform public._t_raises99(format('select public.approval_doc_recall(%L)', current_setting('t.d1')), '42501', 'other emp recall');
  reset role;
  perform public._t_as99('a9900000-0000-0000-0000-000000000006');
  set local role authenticated;
  perform public._t_raises99(format('select public.approval_doc_approve(%L)', current_setting('t.d1')), '42501', 'other company approve');
  perform public._t_raises99(format('select public.approval_doc_save(%L, %L, %L::jsonb)', current_setting('t.d1'), 'x', '{}'), '42501', 'other company save');
  perform public._t_raises99($q$select public.approval_doc_create('f9900000-0000-0000-0000-000000000001')$q$, 'FORM_NOT_FOUND', 'other company form');
  reset role;
  perform public._t_as99('a9900000-0000-0000-0000-000000000002');
  set local role authenticated;
  perform public._t_raises99(format('select public.approval_doc_approve(%L)', current_setting('t.d1')), '42501', 'admin before review');
  reset role;
  perform public._t_as99('a9900000-0000-0000-0000-000000000004');
  set local role authenticated;
  perform public._t_raises99(format('select public.approval_doc_save(%L, %L, %L::jsonb)', current_setting('t.d1'), 'x', '{}'), 'INVALID_STATUS', 'save after submit');
  reset role;
end;
$$;

-- ⑥ 회수(첫 결재 전) → 작성 중, 단계 취소, 관리자 못 봄 → 다시 올리면 2회차
select public._t_as99('a9900000-0000-0000-0000-000000000004');
set local role authenticated;
select public.approval_doc_recall(current_setting('t.d1')::uuid);
select public._t_ok99((select status = 'draft' and current_round = 1 from public.approval_documents where id = current_setting('t.d1')::uuid), 'recalled');
reset role;
select public._t_ok99((select count(*) = 2 from public.approval_document_steps where document_id = current_setting('t.d1')::uuid and status = 'canceled'), 'recall cancels steps');
select public._t_as99('a9900000-0000-0000-0000-000000000004');
set local role authenticated;
select public._t_ok99(public.approval_doc_submit(current_setting('t.d1')::uuid) = 'submitted', 'resubmit r2');
select public._t_ok99((select current_round = 2 from public.approval_documents where id = current_setting('t.d1')::uuid), 'round 2');
reset role;

-- ⑦ 팀장 검토 → 관리자 차례, 이제 회수 안 됨, 쓴 사람(직원)은 최종 못 함, 관리자 최종 승인 → 두 번째 처리 막힘
select public._t_as99('a9900000-0000-0000-0000-000000000003');
set local role authenticated;
select public._t_ok99(public.approval_doc_approve(current_setting('t.d1')::uuid, '확인') = 'submitted', 'lead approve');
reset role;
do $$
begin
  perform public._t_as99('a9900000-0000-0000-0000-000000000004');
  set local role authenticated;
  perform public._t_raises99(format('select public.approval_doc_recall(%L)', current_setting('t.d1')), 'ALREADY_PROCESSED', 'recall after review');
  perform public._t_raises99(format('select public.approval_doc_approve(%L)', current_setting('t.d1')), '42501', 'writer final');
  reset role;
end;
$$;
select public._t_as99('a9900000-0000-0000-0000-000000000002');
set local role authenticated;
select public._t_ok99(public.approval_doc_approve(current_setting('t.d1')::uuid) = 'approved', 'admin final');
select public._t_raises99(format('select public.approval_doc_approve(%L)', current_setting('t.d1')), 'ALREADY_PROCESSED', 'double approve');
reset role;
select public._t_ok99((select string_agg(status::text || ':' || coalesce(acted_by_name, '-'), ',' order by step_order) from public.approval_document_steps where document_id = current_setting('t.d1')::uuid and round = 2) = 'approved:A팀장,approved:A관리', 'r2 signers');

-- ⑧ 반려(사유 필수) → 고쳐서 다시 올리기
select public._t_as99('a9900000-0000-0000-0000-000000000004');
set local role authenticated;
do $$
declare v uuid;
begin
  v := public.approval_doc_create('f9900000-0000-0000-0000-000000000001');
  perform set_config('t.d2', v::text, true);
  perform public.approval_doc_save(v, '세미나실', '{"f1":"세미나실 대관"}'::jsonb);
  perform public.approval_doc_submit(v);
end;
$$;
reset role;
select public._t_as99('a9900000-0000-0000-0000-000000000003');
set local role authenticated;
select public._t_raises99(format('select public.approval_doc_reject(%L, %L)', current_setting('t.d2'), ' '), 'REASON_REQUIRED', 'reject reason');
select public._t_ok99(public.approval_doc_reject(current_setting('t.d2')::uuid, '견적 2곳 비교해 주세요') = 'rejected', 'reject');
reset role;
select public._t_as99('a9900000-0000-0000-0000-000000000004');
set local role authenticated;
select public._t_ok99((select status = 'rejected' and rejection_reason = '견적 2곳 비교해 주세요' from public.approval_documents where id = current_setting('t.d2')::uuid), 'rejected reason');
select public.approval_doc_save(current_setting('t.d2')::uuid, '세미나실', '{"f1":"세미나실 대관(견적 2곳)"}'::jsonb);
select public._t_ok99(public.approval_doc_submit(current_setting('t.d2')::uuid) = 'submitted', 'resubmit after reject');
select public._t_raises99(format('select public.approval_doc_delete(%L)', current_setting('t.d2')), 'INVALID_STATUS', 'delete submitted');
reset role;

-- ⑨ 대표 본인 문서: 바로 본인 승인
select public._t_as99('a9900000-0000-0000-0000-000000000001');
set local role authenticated;
do $$
declare v uuid;
begin
  v := public.approval_doc_create('f9900000-0000-0000-0000-000000000001');
  perform public.approval_doc_save(v, '대표 품의', '{"f1":"대표 품의"}'::jsonb);
  perform public._t_ok99(public.approval_doc_submit(v) = 'approved', 'boss self');
  perform public._t_ok99((select self_approved from public.approval_documents where id = v), 'self_approved');
end;
$$;
reset role;

-- ⑩ 첨부: 저장소에 없거나 남의 폴더면 막힘 · 작성 중 지우기
select public._t_as99('a9900000-0000-0000-0000-000000000004');
set local role authenticated;
do $$
declare v uuid;
begin
  v := public.approval_doc_create('f9900000-0000-0000-0000-000000000001');
  perform public._t_raises99(format('select public.approval_doc_file_add(%L, %L, %L, %L, 10)', v, 'c9900000-0000-0000-0000-00000000000a/a9910000-0000-0000-0000-000000000004/' || v || '/x.png', 'x.png', 'image/png'), 'INVALID_FILE', 'file not in storage');
  perform public._t_raises99(format('select public.approval_doc_file_add(%L, %L, %L, %L, 10)', v, 'c9900000-0000-0000-0000-00000000000b/x/y.png', 'y.png', 'image/png'), 'INVALID_FILE', 'file other folder');
  perform public._t_ok99(array_length(public.approval_doc_delete(v), 1) is null, 'delete draft');
  perform public._t_ok99((select count(*) = 0 from public.approval_documents where id = v), 'deleted');
end;
$$;
reset role;

select 'ok' as approval_documents_099;
rollback;
