-- 090_help_questions.sql — AI 도움말 하루 20번(D-251, migration 146)
begin;
create function public._t_as90(p_uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
end;
$$;
insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at) values
  ('a9000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'help90@test.local', now());
insert into public.companies (id, name, invite_code, business_number) values ('c9000000-0000-0000-0000-00000000000a', '도움말A', 'HLPAAAAA', '1000000901');
insert into public.members (id, auth_user_id, company_id, name, phone, role, status, privacy_agreed_at) values
  ('a9010000-0000-0000-0000-000000000001', 'a9000000-0000-0000-0000-000000000001', 'c9000000-0000-0000-0000-00000000000a', '직원', '01099001001', 'employee', 'approved', now());
select public._t_as90('a9000000-0000-0000-0000-000000000001');
set local role authenticated;
do $$
declare v integer; i integer; ok boolean := false;
begin
  v := public.help_take();
  if v <> 19 then raise exception 'FAIL [first %]', v; end if;
  for i in 2..20 loop v := public.help_take(); end loop;
  if v <> 0 then raise exception 'FAIL [20th %]', v; end if;
  begin
    perform public.help_take();
  exception when others then
    if sqlerrm = 'HELP_LIMIT' then ok := true; end if;
  end;
  if not ok then raise exception 'FAIL [limit]'; end if;
  begin
    perform count(*) from public.help_questions;
    raise exception 'FAIL [direct read]';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;
select 'ok' as help_questions_090;
rollback;
