-- 106_setup_wizard.sql — 최초 1회 설정 진행 기록(D-300, migration 171)
-- 관리자만 기록 · 직원은 못 함 · 다른 회사 기록 안 보임 · 완료한 단계는 건너뛰어도 완료로 남음 · finished 기록 · 직접 쓰기 막힘 · 기존 회사 legacy
begin;
create function public._t_raises106(p_sql text, p_code text, p_label text)
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
grant execute on function public._t_raises106(text, text, text) to authenticated;
create function public._t_as106(p_uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
end;
$$;

do $$
begin
  if exists (select 1 from public.companies c where not exists (select 1 from public.setup_wizards w where w.company_id = c.id and w.legacy)) then
    raise exception 'FAIL [existing companies legacy]';
  end if;
end;
$$;

insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at) values
  ('a1060000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bossa106@test.local', now()),
  ('a1060000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'empa106@test.local', now()),
  ('a1060000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bossb106@test.local', now());
insert into public.companies (id, name, invite_code, business_number) values
  ('c1060000-0000-0000-0000-00000000000a', '마법사A', 'WZDAAAAA', '1000001106'),
  ('c1060000-0000-0000-0000-00000000000b', '마법사B', 'WZDBBBBB', '1000002106');
insert into public.members (id, auth_user_id, company_id, name, phone, role, status, privacy_agreed_at, approved_at) values
  ('a1061000-0000-0000-0000-000000000001', 'a1060000-0000-0000-0000-000000000001', 'c1060000-0000-0000-0000-00000000000a', 'A대표', '01010601001', 'super_admin', 'approved', now(), now()),
  ('a1061000-0000-0000-0000-000000000002', 'a1060000-0000-0000-0000-000000000002', 'c1060000-0000-0000-0000-00000000000a', 'A직원', '01010601002', 'employee', 'approved', now(), now()),
  ('a1061000-0000-0000-0000-000000000003', 'a1060000-0000-0000-0000-000000000003', 'c1060000-0000-0000-0000-00000000000b', 'B대표', '01010601003', 'super_admin', 'approved', now(), now());

-- 직원은 못 함
select public._t_as106('a1060000-0000-0000-0000-000000000002');
set local role authenticated;
select public._t_raises106($q$select public.setup_wizard_answer_intro()$q$, 'NOT_ALLOWED', 'employee intro');
select public._t_raises106($q$select public.setup_wizard_mark('cards', 'done')$q$, 'NOT_ALLOWED', 'employee mark');
do $$ begin if (select count(*) from public.setup_wizard_steps) <> 0 then raise exception 'FAIL [employee reads]'; end if; end; $$;
reset role;

-- A 대표: 새 회사라 기록 없음 → 안내 답 → 단계 기록 · 이상한 값 거절 · 직접 쓰기 막힘
select public._t_as106('a1060000-0000-0000-0000-000000000001');
set local role authenticated;
do $$ begin if exists (select 1 from public.setup_wizards) then raise exception 'FAIL [new company has row]'; end if; end; $$;
select public.setup_wizard_answer_intro();
select public.setup_wizard_mark('cards', 'done');
select public.setup_wizard_mark('vehicles', 'skipped');
select public.setup_wizard_mark('cards', 'skipped'); -- 완료는 완료로 남는다
select public.setup_wizard_mark('vehicles', 'done'); -- 건너뜀 → 완료는 바뀐다
select public._t_raises106($q$select public.setup_wizard_mark('cards', 'maybe')$q$, 'BAD_INPUT', 'bad status');
select public._t_raises106($q$select public.setup_wizard_mark('Bad Key', 'done')$q$, 'BAD_INPUT', 'bad key');
select public._t_raises106($q$insert into public.setup_wizard_steps (company_id, step_key, status) values ('c1060000-0000-0000-0000-00000000000b', 'cards', 'done')$q$, '42501', 'direct insert');
select public._t_raises106($q$update public.setup_wizards set finished_at = now()$q$, '42501', 'direct update');
do $$
begin
  if (select status from public.setup_wizard_steps where step_key = 'cards') <> 'done' then raise exception 'FAIL [done stays]'; end if;
  if (select status from public.setup_wizard_steps where step_key = 'vehicles') <> 'done' then raise exception 'FAIL [skip -> done]'; end if;
  if (select intro_answered_at from public.setup_wizards) is null then raise exception 'FAIL [intro]'; end if;
  if (select legacy from public.setup_wizards) then raise exception 'FAIL [new not legacy]'; end if;
  if (select finished_at from public.setup_wizards) is not null then raise exception 'FAIL [not finished yet]'; end if;
end;
$$;
select public.setup_wizard_mark('files', 'done', true);
do $$ begin if (select finished_at from public.setup_wizards) is null then raise exception 'FAIL [finished]'; end if; end; $$;
reset role;

-- B 대표: A 기록이 안 보임
select public._t_as106('a1060000-0000-0000-0000-000000000003');
set local role authenticated;
do $$
begin
  if exists (select 1 from public.setup_wizards) or exists (select 1 from public.setup_wizard_steps) then raise exception 'FAIL [B sees A]'; end if;
end;
$$;
select public.setup_wizard_mark('cards', 'skipped');
do $$ begin if (select count(*) from public.setup_wizard_steps) <> 1 then raise exception 'FAIL [B own only]'; end if; end; $$;
reset role;

do $$
begin
  if (select count(*) from public.setup_wizard_steps where company_id = 'c1060000-0000-0000-0000-00000000000a') <> 3 then raise exception 'FAIL [A count]'; end if;
  if (select status from public.setup_wizard_steps where company_id = 'c1060000-0000-0000-0000-00000000000b' and step_key = 'cards') <> 'skipped' then raise exception 'FAIL [B separate]'; end if;
end;
$$;

select 'ok' as setup_wizard_106;
rollback;
