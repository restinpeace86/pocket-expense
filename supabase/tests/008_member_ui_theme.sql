-- =============================================================================
-- 008_member_ui_theme.sql — 화면 색상 저장: 본인만, 다른 사람·다른 회사 불가 (D-066)
-- =============================================================================
begin;

insert into auth.users (id, instance_id, aud, role, email)
select u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u::text || '@test.local'
from unnest(array['a6000000-0000-0000-0000-000000000001', 'a6000000-0000-0000-0000-000000000002', 'b6000000-0000-0000-0000-000000000001']::uuid[]) u;
insert into public.companies (id, name, invite_code, business_number) values
  ('c6000000-0000-0000-0000-00000000000a', '색상회사A', 'THEMEAAA', '1000000051'),
  ('c6000000-0000-0000-0000-00000000000b', '색상회사B', 'THEMEBBB', '1000000052');
insert into public.members (id, auth_user_id, company_id, name, phone, role, status, privacy_agreed_at) values
  ('a5000000-0000-0000-0000-000000000001', 'a6000000-0000-0000-0000-000000000001', 'c6000000-0000-0000-0000-00000000000a', 'A대표', '01090001000', 'super_admin', 'approved', now()),
  ('a5000000-0000-0000-0000-000000000002', 'a6000000-0000-0000-0000-000000000002', 'c6000000-0000-0000-0000-00000000000a', 'A직원', '01090001001', 'employee', 'approved', now()),
  ('b5000000-0000-0000-0000-000000000001', 'b6000000-0000-0000-0000-000000000001', 'c6000000-0000-0000-0000-00000000000b', 'B대표', '01090002000', 'super_admin', 'approved', now());

-- A 직원: 본인 색상은 저장, 같은 회사 대표·다른 회사 행은 0건
select set_config('request.jwt.claims', '{"sub":"a6000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
do $$
declare n integer; v_ok boolean;
begin
  update public.members set ui_theme = 'wine' where auth_user_id = 'a6000000-0000-0000-0000-000000000002';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL [A_EMP] own theme not saved'; end if;
  update public.members set ui_theme = 'wine' where id = 'a5000000-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL [A_EMP] changed CEO theme'; end if;
  update public.members set ui_theme = 'wine' where id = 'b5000000-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL [A_EMP] changed other company member theme'; end if;
  begin
    update public.members set ui_theme = '<script>' where auth_user_id = 'a6000000-0000-0000-0000-000000000002';
    v_ok := false;
  exception when check_violation then v_ok := true; end;
  if not v_ok then raise exception 'FAIL [A_EMP] invalid theme value accepted'; end if;
  begin
    update public.members set role = 'admin' where auth_user_id = 'a6000000-0000-0000-0000-000000000002';
    v_ok := false;
  exception when insufficient_privilege then v_ok := true; end;
  if not v_ok then raise exception 'FAIL [A_EMP] changed own role'; end if;
  if (public.my_membership() ->> 'ui_theme') <> 'wine' then raise exception 'FAIL [A_EMP] my_membership has no ui_theme'; end if;
end $$;
reset role;

do $$
begin
  if (select ui_theme from public.members where id = 'a5000000-0000-0000-0000-000000000001') is not null
     or (select ui_theme from public.members where id = 'b5000000-0000-0000-0000-000000000001') is not null then
    raise exception 'FAIL [FINAL] other members theme changed';
  end if;
end $$;

select 'MEMBER_UI_THEME_OK' as result;
rollback;
