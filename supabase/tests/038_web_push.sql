-- =============================================================================
-- 038_web_push.sql — 웹푸시 구독·공지 2채널·리마인더 대상 (D-116, migration 057)
-- 회사 A(말일 마감): 관리자 a1, 직원 e1, 직원 e2 / 회사 B(다음 달 5일 마감): 관리자 b1, 직원 b2
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
from unnest(array['a3800000-0000-0000-0000-000000000001', 'a3800000-0000-0000-0000-000000000002', 'a3800000-0000-0000-0000-000000000003', 'b3800000-0000-0000-0000-000000000001', 'b3800000-0000-0000-0000-000000000002']::uuid[]) u;
insert into public.companies (id, name, invite_code, business_number, claim_deadline_type, claim_deadline_days) values
  ('c3800000-0000-0000-0000-00000000000a', '푸시A', 'PUSHAAAA', '1000000381', 'end_of_month', null),
  ('c3800000-0000-0000-0000-00000000000b', '푸시B', 'PUSHBBBB', '1000000382', 'next_month_day', 5);
insert into public.members (id, auth_user_id, company_id, name, phone, role, status, privacy_agreed_at) values
  ('a3810000-0000-0000-0000-000000000001', 'a3800000-0000-0000-0000-000000000001', 'c3800000-0000-0000-0000-00000000000a', 'A관리자', '01093801001', 'super_admin', 'approved', now()),
  ('a3810000-0000-0000-0000-000000000002', 'a3800000-0000-0000-0000-000000000002', 'c3800000-0000-0000-0000-00000000000a', 'A직원1', '01093801002', 'employee', 'approved', now()),
  ('a3810000-0000-0000-0000-000000000003', 'a3800000-0000-0000-0000-000000000003', 'c3800000-0000-0000-0000-00000000000a', 'A직원2', '01093801003', 'employee', 'approved', now()),
  ('b3810000-0000-0000-0000-000000000001', 'b3800000-0000-0000-0000-000000000001', 'c3800000-0000-0000-0000-00000000000b', 'B관리자', '01093802001', 'super_admin', 'approved', now()),
  ('b3810000-0000-0000-0000-000000000002', 'b3800000-0000-0000-0000-000000000002', 'c3800000-0000-0000-0000-00000000000b', 'B직원', '01093802002', 'employee', 'approved', now());
-- A직원1: 작성 중 결의서(영수증 있음), A직원2: 없음 / B직원: 작성 중
insert into public.expense_claims (id, company_id, member_id, title, status, item_count) values
  ('a3820000-0000-0000-0000-000000000001', 'c3800000-0000-0000-0000-00000000000a', 'a3810000-0000-0000-0000-000000000002', '작성 중', 'draft', 2),
  ('b3820000-0000-0000-0000-000000000001', 'c3800000-0000-0000-0000-00000000000b', 'b3810000-0000-0000-0000-000000000002', '작성 중', 'draft', 1);
-- A: 50시간 전 상신, 최종 단계 대기(관리자에게) / 10시간 전 상신(아직 독촉 안 함)
insert into public.expense_claims (id, company_id, member_id, title, status, item_count, submitted_at, current_round) values
  ('a3820000-0000-0000-0000-000000000002', 'c3800000-0000-0000-0000-00000000000a', 'a3810000-0000-0000-0000-000000000003', '오래 대기', 'submitted', 1, now() - interval '50 hours', 1),
  ('a3820000-0000-0000-0000-000000000003', 'c3800000-0000-0000-0000-00000000000a', 'a3810000-0000-0000-0000-000000000003', '방금 상신', 'submitted', 1, now() - interval '10 hours', 1);
insert into public.claim_approvals (claim_id, company_id, round, step_order, step_kind, approver_member_id, status) values
  ('a3820000-0000-0000-0000-000000000002', 'c3800000-0000-0000-0000-00000000000a', 1, 1, 'final', null, 'pending'),
  ('a3820000-0000-0000-0000-000000000003', 'c3800000-0000-0000-0000-00000000000a', 1, 1, 'final', null, 'pending');

-- ── 대상 계산(서버) ─────────────────────────────────────────────────────────
do $$
declare v jsonb;
begin
  -- A: 10/31 말일 마감 → 10/28(D-3)·10/31(D-day)만, 작성 중 결의서 있는 A직원1만
  v := public.push_deadline_targets('2026-10-28');
  if not exists (select 1 from jsonb_array_elements(v) e where e->>'member_id' = 'a3810000-0000-0000-0000-000000000002' and (e->>'days_left')::int = 3) then raise exception 'FAIL [A D-3] %', v; end if;
  if exists (select 1 from jsonb_array_elements(v) e where e->>'member_id' = 'a3810000-0000-0000-0000-000000000003') then raise exception 'FAIL [no open claims]'; end if;
  v := public.push_deadline_targets('2026-10-29');
  if exists (select 1 from jsonb_array_elements(v) e where e->>'company_id' = 'c3800000-0000-0000-0000-00000000000a') then raise exception 'FAIL [A D-2 none] %', v; end if;
  v := public.push_deadline_targets('2026-10-31');
  if not exists (select 1 from jsonb_array_elements(v) e where e->>'company_id' = 'c3800000-0000-0000-0000-00000000000a' and (e->>'days_left')::int = 0) then raise exception 'FAIL [A D-day] %', v; end if;
  -- B: 다음 달 5일 마감 → 11/2(D-3)·11/5
  v := public.push_deadline_targets('2026-11-02');
  if not exists (select 1 from jsonb_array_elements(v) e where e->>'member_id' = 'b3810000-0000-0000-0000-000000000002' and e->>'deadline' = '2026-11-05') then raise exception 'FAIL [B D-3] %', v; end if;

  -- 결재 대기 24시간 넘은 건만, 관리자(청구자 제외)에게
  v := public.push_approval_targets(now(), 24);
  if jsonb_array_length(v) <> 1 or v->0->>'member_id' <> 'a3810000-0000-0000-0000-000000000001' or (v->0->>'pending')::int <> 1 then raise exception 'FAIL [approval] %', v; end if;
end;
$$;

-- ── A 직원1: 구독 등록(본인만), 공지 읽기 ──────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"a3800000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
insert into public.push_subscriptions (company_id, member_id, endpoint, p256dh, auth) values
  ('c3800000-0000-0000-0000-00000000000a', 'a3810000-0000-0000-0000-000000000002', 'https://push.example.test/a1', repeat('p', 30), repeat('a', 16));
select public._t_raises($q$insert into public.push_subscriptions (company_id, member_id, endpoint, p256dh, auth) values ('c3800000-0000-0000-0000-00000000000a', 'a3810000-0000-0000-0000-000000000003', 'https://push.example.test/x', repeat('p', 30), repeat('a', 16))$q$, '42501', 'E1 other member sub');
select public._t_raises($q$insert into public.announcements (scope, company_id, title, body, created_by_member_id) values ('company', 'c3800000-0000-0000-0000-00000000000a', '직원 공지', '내용', 'a3810000-0000-0000-0000-000000000002')$q$, '42501', 'E1 company notice');
select public._t_raises($q$insert into public.announcements (scope, title, body) values ('platform', '가짜 전체 공지', '내용')$q$, '42501', 'E1 platform notice');
select public._t_raises($q$select public.push_deadline_targets('2026-10-28')$q$, '42501', 'E1 targets');
reset role;

-- ── A 관리자: 사내 공지 ─────────────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"a3800000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
insert into public.announcements (scope, company_id, title, body, created_by_member_id) values
  ('company', 'c3800000-0000-0000-0000-00000000000a', '식대 단가 변경', '11월부터 1인 12,000원', 'a3810000-0000-0000-0000-000000000001');
select public._t_raises($q$insert into public.announcements (scope, company_id, title, body, created_by_member_id) values ('company', 'c3800000-0000-0000-0000-00000000000b', '침투', '내용', 'a3810000-0000-0000-0000-000000000001')$q$, '42501', 'A admin other company');
do $$ begin
  if exists (select 1 from public.push_subscriptions) then raise exception 'FAIL [admin sees others subs]'; end if;
end $$;
reset role;
-- 서버가 쓰는 전체 공지
insert into public.announcements (scope, title, body) values ('platform', '정기 점검 안내', '10/30 02시~03시');

-- ── B 직원: A 사내 공지는 안 보이고 전체 공지는 보인다 ─────────────────────────────
select set_config('request.jwt.claims', '{"sub":"b3800000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  if exists (select 1 from public.announcements where scope = 'company') then raise exception 'FAIL [B sees A notice]'; end if;
  if not exists (select 1 from public.announcements where scope = 'platform') then raise exception 'FAIL [B platform notice]'; end if;
  if exists (select 1 from public.push_subscriptions) then raise exception 'FAIL [B sees A sub]'; end if;
end $$;
select public._t_raises($q$select 1 from public.push_logs$q$, '42501', 'B push_logs'); -- 서버 전용(권한 자체가 없음)
reset role;
-- A 직원1은 사내 공지를 본다
select set_config('request.jwt.claims', '{"sub":"a3800000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  if (select count(*) from public.announcements) <> 2 then raise exception 'FAIL [A employee notices]'; end if;
  if (select count(*) from public.push_subscriptions) <> 1 then raise exception 'FAIL [own sub]'; end if;
  delete from public.push_subscriptions;
  if exists (select 1 from public.push_subscriptions) then raise exception 'FAIL [delete own]'; end if;
end $$;
reset role;

select 'WEB_PUSH_OK' as result;
rollback;
