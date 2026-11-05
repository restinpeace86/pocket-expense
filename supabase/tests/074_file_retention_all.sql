-- =============================================================================
-- 074_file_retention_all.sql — 보관 기간을 회의 자료에도(D-218, migration 118)
-- 기준일 = 올린 날·회의 끝난 날 중 늦은 날 / 회사 기간(30·60·90) 따름 / 지운 자료는 저장 공간·10개 한도에서 빠짐 /
-- 메신저가 꺼져도 관리자가 기간 설정 / 정리 함수는 서버 전용
-- =============================================================================
begin;

create function public._t_raises74(p_sql text, p_code text, p_label text)
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
grant execute on function public._t_raises74(text, text, text) to authenticated;
create function public._t_as74(p_uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
end;
$$;

insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at) values
  ('a7400000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'boss74@test.local', now());
insert into public.companies (id, name, invite_code, business_number) values ('c7400000-0000-0000-0000-00000000000a', '보관A', 'RETAAAAA', '1000000741');
insert into public.members (id, auth_user_id, company_id, name, phone, role, status, privacy_agreed_at) values
  ('a7410000-0000-0000-0000-000000000001', 'a7400000-0000-0000-0000-000000000001', 'c7400000-0000-0000-0000-00000000000a', 'A대표', '01097401001', 'super_admin', 'approved', now());
insert into public.company_features (company_id, feature, enabled) values
  ('c7400000-0000-0000-0000-00000000000a', 'calendar', true), ('c7400000-0000-0000-0000-00000000000a', 'messenger', false)
on conflict (company_id, feature) do update set enabled = excluded.enabled;

-- 회의 셋: 지난 회의(50일 전 끝남), 앞으로 회의(20일 뒤), 지난 회의(10일 전)
insert into public.calendar_events (id, company_id, created_by_member_id, title, kind, all_day, starts_at, ends_at) values
  ('e7400000-0000-0000-0000-000000000001', 'c7400000-0000-0000-0000-00000000000a', 'a7410000-0000-0000-0000-000000000001', '옛 회의', 'meeting', false, date_bin('10 minutes', now() - interval '50 days', timestamptz '2000-01-01') - interval '1 hour', date_bin('10 minutes', now() - interval '50 days', timestamptz '2000-01-01')),
  ('e7400000-0000-0000-0000-000000000002', 'c7400000-0000-0000-0000-00000000000a', 'a7410000-0000-0000-0000-000000000001', '앞 회의', 'meeting', false, date_bin('10 minutes', now() + interval '20 days', timestamptz '2000-01-01'), date_bin('10 minutes', now() + interval '20 days', timestamptz '2000-01-01') + interval '1 hour'),
  ('e7400000-0000-0000-0000-000000000003', 'c7400000-0000-0000-0000-00000000000a', 'a7410000-0000-0000-0000-000000000001', '최근 회의', 'meeting', false, date_bin('10 minutes', now() - interval '10 days', timestamptz '2000-01-01') - interval '1 hour', date_bin('10 minutes', now() - interval '10 days', timestamptz '2000-01-01'));
-- 자료: 모두 60일 전에 올림(앞 회의 자료는 미리 올린 것)
insert into public.calendar_event_files (id, company_id, event_id, uploaded_by_member_id, path, name, size, created_at) values
  ('f7400000-0000-0000-0000-000000000001', 'c7400000-0000-0000-0000-00000000000a', 'e7400000-0000-0000-0000-000000000001', 'a7410000-0000-0000-0000-000000000001', 'c7400000-0000-0000-0000-00000000000a/e7400000-0000-0000-0000-000000000001/1.pdf', '1.pdf', 1000, now() - interval '60 days'),
  ('f7400000-0000-0000-0000-000000000002', 'c7400000-0000-0000-0000-00000000000a', 'e7400000-0000-0000-0000-000000000002', 'a7410000-0000-0000-0000-000000000001', 'c7400000-0000-0000-0000-00000000000a/e7400000-0000-0000-0000-000000000002/2.pdf', '2.pdf', 2000, now() - interval '60 days'),
  ('f7400000-0000-0000-0000-000000000003', 'c7400000-0000-0000-0000-00000000000a', 'e7400000-0000-0000-0000-000000000003', 'a7410000-0000-0000-0000-000000000001', 'c7400000-0000-0000-0000-00000000000a/e7400000-0000-0000-0000-000000000003/3.pdf', '3.pdf', 4000, now() - interval '60 days');

-- ① 메신저가 꺼진 회사도 관리자가 기간 설정 + 줄이면 비워지는 양에 회의 자료(30일 기준 = 옛 회의 자료만)
select public._t_as74('a7400000-0000-0000-0000-000000000001');
set local role authenticated;
do $$
declare
  st jsonb := public.chat_retention_status();
begin
  if (st ->> 'older_than_30')::bigint <> 1000 then raise exception 'FAIL [freed 30 includes only past meeting files] %', st; end if;
  if (st ->> 'used')::bigint <> 7000 then raise exception 'FAIL [used] %', st; end if;
  perform public.chat_set_attachment_days(30);
  perform public._t_raises74($q$select public.meeting_files_due(10)$q$, '42501', 'due is server only');
end;
$$;
reset role;

-- ② 30일: 옛 회의(끝난 지 50일) 자료만 대상 — 앞 회의(미리 올림)·최근 회의(끝난 지 10일)는 아님
do $$
declare
  ids uuid[] := (select array_agg(id) from public.meeting_files_due(100) where path like 'c7400000-0000-0000-0000-00000000000a/%');
begin
  if ids is distinct from array['f7400000-0000-0000-0000-000000000001'::uuid] then raise exception 'FAIL [due 30] %', ids; end if;
  if public.meeting_files_mark_purged(ids) <> 1 then raise exception 'FAIL [mark]'; end if;
  if (select purged_at from public.calendar_event_files where id = 'f7400000-0000-0000-0000-000000000001') is null then raise exception 'FAIL [purged_at]'; end if;
  if private.chat_storage_used('c7400000-0000-0000-0000-00000000000a') <> 6000 then raise exception 'FAIL [used excludes purged]'; end if;
  if exists (select 1 from public.meeting_files_due(100) where path like 'c7400000-0000-0000-0000-00000000000a/%') then raise exception 'FAIL [due again]'; end if;
end;
$$;

-- ③ 일정 JSON에 purged 표시
select public._t_as74('a7400000-0000-0000-0000-000000000001');
set local role authenticated;
do $$
begin
  if (public.calendar_event('e7400000-0000-0000-0000-000000000001'::uuid) -> 'files' -> 0 ->> 'purged')::boolean is not true then raise exception 'FAIL [json purged]'; end if;
  if (public.calendar_event('e7400000-0000-0000-0000-000000000003'::uuid) -> 'files' -> 0 ->> 'purged')::boolean is not false then raise exception 'FAIL [json live]'; end if;
end;
$$;
reset role;

select 'ok' as file_retention_all_074;
rollback;
