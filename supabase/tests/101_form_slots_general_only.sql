-- 101_form_slots_general_only.sql — 회사 양식 칸 = 결재 문서만, 프로 3개(D-289, migration 165)
-- 결재 문서 3개까지 · 4번째 막힘 · 근태 양식은 칸과 상관없이 됨 · 칸 0(스타터)이면 근태 양식도 막힘 · 추가 칸은 더해짐
begin;
create function public._t_raises101(p_sql text, p_code text, p_label text)
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
grant execute on function public._t_raises101(text, text, text) to authenticated;
create function public._t_as101(p_uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
end;
$$;

insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at) values
  ('a1100000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'boss101@test.local', now());
insert into public.companies (id, name, invite_code, business_number) values ('c1100000-0000-0000-0000-00000000000a', '칸A', 'SLAAAAAA', '1000001101');
insert into public.members (id, auth_user_id, company_id, name, phone, role, status, privacy_agreed_at, approved_at) values
  ('a1110000-0000-0000-0000-000000000001', 'a1100000-0000-0000-0000-000000000001', 'c1100000-0000-0000-0000-00000000000a', 'A대표', '01011001001', 'super_admin', 'approved', now(), now());

-- 결재 문서 3개 + 근태 양식(휴가) 1개 등록됨, 초안 3개(결재 문서 1 · 근태 정정 1 · 결재 문서 1)
insert into public.company_forms (id, company_id, group_id, version, kind, doc_type, name, status, sheets, fields, source_path, mime, reads) values
  ('f1100000-0000-0000-0000-000000000001', 'c1100000-0000-0000-0000-00000000000a', 'f1100000-0000-0000-0000-000000000001', 1, 'general', 'pumui', '품의서', 'active', '{"v":1,"sheets":[{"name":"1","cols":[100],"heights":[1],"cells":[[{"t":""}]],"merges":[]}]}', '[]', 'x/1.png', 'image/png', 1),
  ('f1100000-0000-0000-0000-000000000002', 'c1100000-0000-0000-0000-00000000000a', 'f1100000-0000-0000-0000-000000000002', 1, 'general', 'trip', '출장', 'active', '{"v":1,"sheets":[{"name":"1","cols":[100],"heights":[1],"cells":[[{"t":""}]],"merges":[]}]}', '[]', 'x/2.png', 'image/png', 1),
  ('f1100000-0000-0000-0000-000000000003', 'c1100000-0000-0000-0000-00000000000a', 'f1100000-0000-0000-0000-000000000003', 1, 'general', 'other', '기타', 'active', '{"v":1,"sheets":[{"name":"1","cols":[100],"heights":[1],"cells":[[{"t":""}]],"merges":[]}]}', '[]', 'x/3.png', 'image/png', 1),
  ('f1100000-0000-0000-0000-000000000004', 'c1100000-0000-0000-0000-00000000000a', 'f1100000-0000-0000-0000-000000000004', 1, 'leave', null, '휴가', 'active', '{"v":1,"sheets":[{"name":"1","cols":[100],"heights":[1],"cells":[[{"t":""}]],"merges":[]}]}', '[]', 'x/4.png', 'image/png', 1),
  ('f1100000-0000-0000-0000-000000000005', 'c1100000-0000-0000-0000-00000000000a', 'f1100000-0000-0000-0000-000000000005', 0, null, null, '새 문서', 'draft', null, '[]', 'x/5.png', 'image/png', 0),
  ('f1100000-0000-0000-0000-000000000006', 'c1100000-0000-0000-0000-00000000000a', 'f1100000-0000-0000-0000-000000000006', 0, null, null, '정정', 'draft', null, '[]', 'x/6.png', 'image/png', 0);

do $$
begin
  if private.form_slot_used('c1100000-0000-0000-0000-00000000000a') <> 3 then raise exception 'FAIL [used counts general only]'; end if;
  if private.form_slot_limit('c1100000-0000-0000-0000-00000000000a') <> 3 then raise exception 'FAIL [pro limit 3]'; end if;
  if (select form_slots from public.billing_plans where code = 'pro') <> 5 or (select form_slots_unlimited from public.billing_plans where code = 'pro') then raise exception 'FAIL [business 5]'; end if;
end;
$$;

select public._t_as101('a1100000-0000-0000-0000-000000000001');
set local role authenticated;
-- 4번째 결재 문서는 막힘, 근태 정정 양식은 됨(칸과 상관없음)
select public._t_raises101($q$select public.company_form_read_begin('f1100000-0000-0000-0000-000000000005', 'general')$q$, 'SLOTS_FULL', '4th general');
select public.company_form_read_begin('f1100000-0000-0000-0000-000000000006', 'correction');
reset role;

-- 추가 칸 1개(운영자) → 4번째 결재 문서 됨
update public.companies set extra_form_slots = 1 where id = 'c1100000-0000-0000-0000-00000000000a';
select public._t_as101('a1100000-0000-0000-0000-000000000001');
set local role authenticated;
select public.company_form_read_begin('f1100000-0000-0000-0000-000000000005', 'general');
reset role;

-- 칸 0(스타터 = 지출결의서만)이면 근태 양식도 막힘
update public.companies set extra_form_slots = 0 where id = 'c1100000-0000-0000-0000-00000000000a';
update public.billing_plans set form_slots = 0 where code = 'standard';
do $$
begin
  if not private.form_slot_blocked('c1100000-0000-0000-0000-00000000000a', 'leave') then raise exception 'FAIL [starter blocks attendance]'; end if;
  if not private.form_slot_blocked('c1100000-0000-0000-0000-00000000000a', 'general') then raise exception 'FAIL [starter blocks general]'; end if;
end;
$$;

select 'ok' as form_slots_101;
rollback;
