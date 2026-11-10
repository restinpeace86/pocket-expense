-- =============================================================================
-- 086_feedback.sql — 의견 보내기 (D-246, migration 135)
-- 저장(회사·이름은 로그인에서) / 한 회사 하루 5건(다른 회사는 따로) / 내용 길이·구분 / 캡처는 버그 + 내 회사 경로만 /
-- 주소 '?' 뒤 잘라냄 / 회사 사용자는 표를 못 읽음(관리자도) / 대기 멤버 못 보냄 / 새벽 정리는 서버 전용
-- =============================================================================
begin;

create function public._t_raises86(p_sql text, p_code text, p_label text)
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
grant execute on function public._t_raises86(text, text, text) to authenticated;
create function public._t_as86(p_uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
end;
$$;

insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at) values
  ('a8700000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'boss86@test.local', now()),
  ('a8700000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'emp86@test.local', now()),
  ('a8700000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'wait86@test.local', now()),
  ('a8700000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bboss86@test.local', now());
insert into public.companies (id, name, invite_code, business_number) values
  ('c8700000-0000-0000-0000-00000000000a', '의견A', 'FAAAAAAA', '1000000861'),
  ('c8700000-0000-0000-0000-00000000000b', '의견B', 'FBBBBBBB', '1000000862');
insert into public.members (id, auth_user_id, company_id, name, phone, role, status, privacy_agreed_at, approved_at) values
  ('a8710000-0000-0000-0000-000000000001', 'a8700000-0000-0000-0000-000000000001', 'c8700000-0000-0000-0000-00000000000a', 'A대표', '01098601001', 'super_admin', 'approved', now(), now()),
  ('a8710000-0000-0000-0000-000000000002', 'a8700000-0000-0000-0000-000000000002', 'c8700000-0000-0000-0000-00000000000a', 'A직원', '01098601002', 'employee', 'approved', now(), now()),
  ('a8710000-0000-0000-0000-000000000003', 'a8700000-0000-0000-0000-000000000003', 'c8700000-0000-0000-0000-00000000000a', 'A대기', '01098601003', 'employee', 'pending', now(), null),
  ('a8710000-0000-0000-0000-000000000004', 'a8700000-0000-0000-0000-000000000004', 'c8700000-0000-0000-0000-00000000000b', 'B대표', '01098601004', 'super_admin', 'approved', now(), now());

-- ① 직원이 버그 신고(캡처 포함) — 회사·이름은 로그인에서, 주소 ? 뒤 잘림
select public._t_as86('a8700000-0000-0000-0000-000000000002');
set local role authenticated;
do $$
declare v uuid;
begin
  v := public.feedback_submit('f8700000-0000-0000-0000-000000000001', 'bug', '  승인 누르면 멈춰요  ', '/workspace/x/admin/approvals?tab=wait&token=secret', 'Mozilla/5.0 Test', '1280x720', 'abc1234',
    'c8700000-0000-0000-0000-00000000000a/f8700000-0000-0000-0000-000000000001.png');
  if v <> 'f8700000-0000-0000-0000-000000000001' then raise exception 'FAIL [id] %', v; end if;
  if public.feedback_today_count() <> 1 then raise exception 'FAIL [today 1]'; end if;
end $$;
-- 회사 사용자는 표를 못 읽음
select public._t_raises86('select count(*) from public.feedback_logs', '42501', '직원 표 읽기');
-- 잘못된 입력
select public._t_raises86($q$select public.feedback_submit(null, 'bug', '짧음', null, null, null, null, null)$q$, 'INVALID_FEEDBACK', '5자 미만');
select public._t_raises86($q$select public.feedback_submit(null, 'idea', '다섯 글자 이상', null, null, null, null, null)$q$, 'INVALID_FEEDBACK', '구분');
select public._t_raises86($q$select public.feedback_submit(null, 'feature', '기능 요청에 캡처', null, null, null, null, 'c8700000-0000-0000-0000-00000000000a/x.png')$q$, 'INVALID_FEEDBACK', '기능 요청 캡처');
select public._t_raises86($q$select public.feedback_submit(null, 'bug', '남의 회사 경로', null, null, null, null, 'c8700000-0000-0000-0000-00000000000b/x.png')$q$, 'INVALID_FEEDBACK', '남의 회사 캡처 경로');
select public._t_raises86($q$select public.feedback_submit(null, 'bug', repeat('가', 2001), null, null, null, null, null)$q$, 'INVALID_FEEDBACK', '2000자 초과');
reset role;

-- ② 관리자도 표를 못 읽음 + 회사 하루 5건(직원 1 + 관리자 4 = 5, 6번째 막힘)
select public._t_as86('a8700000-0000-0000-0000-000000000001');
set local role authenticated;
select public._t_raises86('select count(*) from public.feedback_logs', '42501', '관리자 표 읽기');
select public.feedback_submit(null, 'feature', '이런 기능이 있으면 좋겠어요 1', '/a', null, null, null, null);
select public.feedback_submit(null, 'feature', '이런 기능이 있으면 좋겠어요 2', '/a', null, null, null, null);
select public.feedback_submit(null, 'feature', '이런 기능이 있으면 좋겠어요 3', '/a', null, null, null, null);
select public.feedback_submit(null, 'bug', '이런 버그가 있어요 4', '/a', null, null, null, null);
select public._t_raises86($q$select public.feedback_submit(null, 'bug', '여섯 번째 의견이에요', null, null, null, null, null)$q$, 'FEEDBACK_LIMIT', '회사 하루 5건');
do $$ begin if public.feedback_today_count() <> 5 then raise exception 'FAIL [today 5]'; end if; end $$;
reset role;

-- ③ 다른 회사는 따로 셈
select public._t_as86('a8700000-0000-0000-0000-000000000004');
set local role authenticated;
do $$ begin if public.feedback_today_count() <> 0 then raise exception 'FAIL [B today 0]'; end if; end $$;
select public.feedback_submit(null, 'bug', 'B회사 버그 신고예요', null, null, null, null, null);
reset role;

-- ④ 어제 보낸 건 오늘 건수에 안 들어감
update public.feedback_logs set created_at = now() - interval '1 day 1 hour' where company_id = 'c8700000-0000-0000-0000-00000000000a' and content like '이런 기능%1';
select public._t_as86('a8700000-0000-0000-0000-000000000001');
set local role authenticated;
select public.feedback_submit(null, 'feature', '하루 지나 한 칸 비었어요', null, null, null, null, null);
reset role;

-- ⑤ 대기 멤버는 못 보냄
select public._t_as86('a8700000-0000-0000-0000-000000000003');
set local role authenticated;
select public._t_raises86($q$select public.feedback_submit(null, 'bug', '대기 멤버 의견이에요', null, null, null, null, null)$q$, 'NOT_A_MEMBER', '대기 멤버');
select public._t_raises86('select public.feedback_due()', '42501', '새벽 정리는 서버 전용');
reset role;

-- ⑥ 저장된 값 확인(운영 키 = 기본 역할)
do $$
declare r public.feedback_logs;
begin
  select * into r from public.feedback_logs where id = 'f8700000-0000-0000-0000-000000000001';
  if r.company_id <> 'c8700000-0000-0000-0000-00000000000a' or r.member_id <> 'a8710000-0000-0000-0000-000000000002' or r.reporter_name <> 'A직원' then raise exception 'FAIL [who]'; end if;
  if r.content <> '승인 누르면 멈춰요' then raise exception 'FAIL [trim] %', r.content; end if;
  if r.page_url <> '/workspace/x/admin/approvals' then raise exception 'FAIL [url] %', r.page_url; end if;
  if r.status <> 'pending' then raise exception 'FAIL [status]'; end if;
  if (select count(*) from public.feedback_logs where company_id = 'c8700000-0000-0000-0000-00000000000b') <> 1 then raise exception 'FAIL [B count]'; end if;
end $$;

-- ⑦ 새벽 정리: 해결 1년 지난 것만
update public.feedback_logs set status = 'resolved', resolved_at = now() - interval '400 days' where id = 'f8700000-0000-0000-0000-000000000001';
do $$
declare n integer;
begin
  select count(*) into n from public.feedback_due();
  if n <> 1 then raise exception 'FAIL [due] %', n; end if;
  if exists (select 1 from public.feedback_logs where id = 'f8700000-0000-0000-0000-000000000001') then raise exception 'FAIL [due deleted]'; end if;
end $$;

select 'feedback ok';
rollback;
