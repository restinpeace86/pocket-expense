-- =============================================================================
-- 040_form_layouts.sql — 지출결의서 양식 저장·되돌리기 (D-118, migration 060)
-- 관리자만 저장, 버전 증가·활성 1개, 다른 회사 양식은 안 보이고 못 바꿈, 원본 파일 경로는 자기 회사 폴더만
-- =============================================================================
begin;

create function public._t_raises(p_sql text, p_code text, p_label text)
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
grant execute on function public._t_raises(text, text, text) to authenticated;

insert into auth.users (id, instance_id, aud, role, email)
select u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u::text || '@test.local'
from unnest(array['a4000000-0000-0000-0000-000000000001', 'a4000000-0000-0000-0000-000000000002', 'a4000000-0000-0000-0000-000000000003']::uuid[]) u;
insert into public.companies (id, name, invite_code, business_number) values
  ('c4000000-0000-0000-0000-00000000000a', '양식회사', 'FRMLAYTA', '1000000401'),
  ('c4000000-0000-0000-0000-00000000000b', '다른회사', 'FRMLAYTB', '1000000402');
insert into public.members (id, auth_user_id, company_id, name, phone, role, status, privacy_agreed_at) values
  ('a4010000-0000-0000-0000-000000000001', 'a4000000-0000-0000-0000-000000000001', 'c4000000-0000-0000-0000-00000000000a', '관리자', '01094001001', 'super_admin', 'approved', now()),
  ('a4010000-0000-0000-0000-000000000002', 'a4000000-0000-0000-0000-000000000002', 'c4000000-0000-0000-0000-00000000000a', '직원', '01094001002', 'employee', 'approved', now()),
  ('a4010000-0000-0000-0000-000000000003', 'a4000000-0000-0000-0000-000000000003', 'c4000000-0000-0000-0000-00000000000b', '남의관리자', '01094001003', 'super_admin', 'approved', now());

-- 직원: 저장·되돌리기 불가
select set_config('request.jwt.claims', '{"sub":"a4000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select public._t_raises($q$select public.save_form_template('{"v":1,"columns":[{"key":"item.amount"}]}')$q$, '42501', 'E save');
select public._t_raises($q$select public.clear_form_template()$q$, '42501', 'E clear');
reset role;

-- 관리자: 잘못된 양식·남의 회사 경로 거절, 두 번 저장 → v2만 활성, 되돌리기 → 활성 없음(기본 양식)
select set_config('request.jwt.claims', '{"sub":"a4000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select public._t_raises($q$select public.save_form_template('{"v":1,"columns":[]}')$q$, 'INVALID_FORM_LAYOUT', 'A empty columns');
select public._t_raises($q$select public.save_form_template('[]')$q$, 'INVALID_FORM_LAYOUT', 'A not object');
select public._t_raises($q$select public.save_form_template('{"v":1,"columns":[{"key":"item.amount"}]}', 'c4000000-0000-0000-0000-00000000000b/x.jpg')$q$, 'INVALID_FORM_SOURCE', 'A other company path');
select public._t_raises($q$insert into public.form_templates (company_id, version, schema, is_active) values ('c4000000-0000-0000-0000-00000000000b', 1, '{}', true)$q$, '42501', 'A insert other company');
do $$
declare v1 uuid; v2 uuid; r record;
begin
  v1 := public.save_form_template('{"v":1,"base":"monthly","columns":[{"key":"item.amount"}]}', 'c4000000-0000-0000-0000-00000000000a/form-1.jpg', '{"title":"지출결의서"}');
  v2 := public.save_form_template('{"v":1,"base":"single","columns":[{"key":"item.amount"}]}');
  select count(*) filter (where is_active) as active, max(version) as ver, bool_and(id <> v1 or not is_active) as v1_off into r from public.form_templates;
  if row(r.active, r.ver, r.v1_off)::text <> row(1, 2, true)::text then raise exception 'FAIL [versions] %', r; end if;
  if (select schema ->> 'base' from public.form_templates where is_active) <> 'single' then raise exception 'FAIL [active]'; end if;
  perform public.clear_form_template();
  if exists (select 1 from public.form_templates where is_active) then raise exception 'FAIL [clear]'; end if;
  if (select count(*) from public.form_templates) <> 2 then raise exception 'FAIL [history kept]'; end if;
  perform public.save_form_template('{"v":1,"base":"detailed","columns":[{"key":"item.amount"}]}');
end;
$$;
reset role;

-- 다른 회사 관리자: 양식회사 양식이 안 보이고, 자기 회사 저장은 자기 회사 v1
select set_config('request.jwt.claims', '{"sub":"a4000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  if exists (select 1 from public.form_templates) then raise exception 'FAIL [isolation read]'; end if;
  perform public.save_form_template('{"v":1,"columns":[{"key":"item.amount"}]}');
  update public.form_templates set is_active = false where company_id = 'c4000000-0000-0000-0000-00000000000a';
end;
$$;
reset role;
do $$
begin
  if (select version from public.form_templates where company_id = 'c4000000-0000-0000-0000-00000000000b') <> 1 then raise exception 'FAIL [other v1]'; end if;
  if (select count(*) from public.form_templates where company_id = 'c4000000-0000-0000-0000-00000000000a' and is_active) <> 1 then raise exception 'FAIL [isolation write]'; end if;
  if (select version from public.form_templates where company_id = 'c4000000-0000-0000-0000-00000000000a' and is_active) <> 3 then raise exception 'FAIL [v3]'; end if;
end;
$$;

select 'FORM_LAYOUTS_OK' as result;
rollback;
