-- 098_form_doc_types.sql — 결재 문서 종류(9-33d, migration 161)
-- AI 읽기 저장·초안 저장에 종류, 근태 양식엔 종류 없음, 잘못된 종류 막힘, 고치기 초안에 종류 복사, 종류를 근태로 바꾸면 비움, 다른 회사 관리자는 못 바꿈
begin;
create function public._t_raises98(p_sql text, p_code text, p_label text)
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
grant execute on function public._t_raises98(text, text, text) to authenticated;
create function public._t_as98(p_uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
end;
$$;

insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at) values
  ('a9800000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'boss98@test.local', now()),
  ('a9800000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bboss98@test.local', now());
insert into public.companies (id, name, invite_code, business_number) values
  ('c9800000-0000-0000-0000-00000000000a', '종류A', 'DTAAAAAA', '1000000981'),
  ('c9800000-0000-0000-0000-00000000000b', '종류B', 'DTBBBBBB', '1000000982');
insert into public.members (id, auth_user_id, company_id, name, phone, role, status, privacy_agreed_at, approved_at) values
  ('a9810000-0000-0000-0000-000000000001', 'a9800000-0000-0000-0000-000000000001', 'c9800000-0000-0000-0000-00000000000a', 'A대표', '01099801001', 'super_admin', 'approved', now(), now()),
  ('a9810000-0000-0000-0000-000000000002', 'a9800000-0000-0000-0000-000000000002', 'c9800000-0000-0000-0000-00000000000b', 'B대표', '01099801002', 'super_admin', 'approved', now(), now());
-- 초안 둘: 결재 문서 · 휴가(근태)
insert into public.company_forms (id, company_id, group_id, kind, name, status, source_path, mime) values
  ('f9800000-0000-0000-0000-000000000001', 'c9800000-0000-0000-0000-00000000000a', 'f9800000-0000-0000-0000-000000000001', 'general', '품의서', 'draft', 'c98a/f1.png', 'image/png'),
  ('f9800000-0000-0000-0000-000000000002', 'c9800000-0000-0000-0000-00000000000a', 'f9800000-0000-0000-0000-000000000002', 'leave', '휴가', 'draft', 'c98a/f2.png', 'image/png');
select set_config('t.sheets', '{"v":1,"sheets":[{"name":"1쪽","cols":[50,50],"heights":[1],"cells":[[{"t":"금액"},{"t":""}]],"merges":[]}]}', true);
select set_config('t.fields', '[{"key":"f1","label":"금액","s":0,"r":0,"c":1,"b":{"k":"input","type":"money","required":false,"std":"amount"}}]', true);

-- ① AI 읽기 저장: 결재 문서는 종류 저장, 근태 양식은 넘겨도 없음
select public._t_as98('a9800000-0000-0000-0000-000000000001');
set local role authenticated;
do $$
begin
  perform public.company_form_read_done('f9800000-0000-0000-0000-000000000001', '품의서', current_setting('t.sheets')::jsonb, current_setting('t.fields')::jsonb, 'pumui');
  perform public.company_form_read_done('f9800000-0000-0000-0000-000000000002', '휴가', current_setting('t.sheets')::jsonb, '[]'::jsonb, 'pumui');
end;
$$;
reset role;
do $$
begin
  if (select doc_type from public.company_forms where id = 'f9800000-0000-0000-0000-000000000001') <> 'pumui' then raise exception 'FAIL [read_done doc_type]'; end if;
  if (select doc_type from public.company_forms where id = 'f9800000-0000-0000-0000-000000000002') is not null then raise exception 'FAIL [leave has doc_type]'; end if;
end;
$$;

-- ② 초안 저장: 종류 바꾸기 / 안 넘기면 그대로 / 잘못된 종류 막힘
select public._t_as98('a9800000-0000-0000-0000-000000000001');
set local role authenticated;
do $$
begin
  perform public.company_form_save('f9800000-0000-0000-0000-000000000001', '구매요청서', current_setting('t.sheets')::jsonb, current_setting('t.fields')::jsonb, 'purchase');
  if (select doc_type from public.company_forms where id = 'f9800000-0000-0000-0000-000000000001') <> 'purchase' then raise exception 'FAIL [save doc_type]'; end if;
  perform public.company_form_save('f9800000-0000-0000-0000-000000000001', '구매요청서', current_setting('t.sheets')::jsonb, current_setting('t.fields')::jsonb);
  if (select doc_type from public.company_forms where id = 'f9800000-0000-0000-0000-000000000001') <> 'purchase' then raise exception 'FAIL [save keeps doc_type]'; end if;
  perform public._t_raises98($q$select public.company_form_save('f9800000-0000-0000-0000-000000000001', 'x', current_setting('t.sheets')::jsonb, '[]'::jsonb, 'zz')$q$, '23514', 'bad doc_type');
end;
$$;
reset role;

-- ③ 근태 양식에 종류를 직접 넣으면 막힘
do $$
begin
  perform public._t_raises98($q$update public.company_forms set doc_type = 'pumui' where id = 'f9800000-0000-0000-0000-000000000002'$q$, '23514', 'leave doc_type');
end;
$$;

-- ④ 등록 → 고치기: 초안에 종류 복사
select public._t_as98('a9800000-0000-0000-0000-000000000001');
set local role authenticated;
do $$
declare v_draft uuid;
begin
  perform public.company_form_publish('f9800000-0000-0000-0000-000000000001');
  v_draft := public.company_form_edit('f9800000-0000-0000-0000-000000000001');
  if (select doc_type from public.company_forms where id = v_draft) <> 'purchase' then raise exception 'FAIL [edit copies doc_type]'; end if;
  perform set_config('t.draft', v_draft::text, true);
end;
$$;
reset role;

-- ⑤ 읽기 시작에서 종류를 근태로 바꾸면 결재 문서 종류는 비움(새 초안으로)
insert into public.company_forms (id, company_id, group_id, kind, doc_type, name, status, source_path, mime) values
  ('f9800000-0000-0000-0000-000000000003', 'c9800000-0000-0000-0000-00000000000a', 'f9800000-0000-0000-0000-000000000003', 'general', 'trip', '출장', 'draft', 'c98a/f3.png', 'image/png');
select public._t_as98('a9800000-0000-0000-0000-000000000001');
set local role authenticated;
do $$
begin
  perform public.company_form_read_begin('f9800000-0000-0000-0000-000000000003', 'correction');
end;
$$;
reset role;
do $$
begin
  if (select kind || '/' || coalesce(doc_type, '-') from public.company_forms where id = 'f9800000-0000-0000-0000-000000000003') <> 'correction/-' then raise exception 'FAIL [read_begin clears doc_type]'; end if;
end;
$$;

-- ⑥ 다른 회사 관리자는 A회사 초안을 못 바꿈
select public._t_as98('a9800000-0000-0000-0000-000000000002');
set local role authenticated;
do $$
begin
  perform public._t_raises98(format($q$select public.company_form_save(%L, 'x', current_setting('t.sheets')::jsonb, '[]'::jsonb, 'pumui')$q$, current_setting('t.draft')), 'NOT_FOUND', 'other company');
end;
$$;
reset role;

select 'ok' as form_doc_types_098;
rollback;
