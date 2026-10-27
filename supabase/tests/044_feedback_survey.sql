-- =============================================================================
-- 044_feedback_survey.sql — 설문 +100 크레딧(회사당 1회, 후기 10자·소개 동의 필수)·권한·회사 격리 (D-130, D-137, migration 066·071)
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
grant execute on function public._t_raises(text, text, text) to authenticated, anon;

insert into auth.users (id, instance_id, aud, role, email)
select u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u::text || '@test.local'
from unnest(array['a4400000-0000-0000-0000-000000000001', 'a4400000-0000-0000-0000-000000000002', 'a4400000-0000-0000-0000-000000000003', 'a4400000-0000-0000-0000-000000000004']::uuid[]) u;
insert into public.companies (id, name, invite_code, business_number, receipt_credits_granted, receipt_credits_used) values
  ('c4400000-0000-0000-0000-00000000000a', '설문회사', 'SRVYCPNA', '1000000441', 100, 97),
  ('c4400000-0000-0000-0000-00000000000b', '다른회사', 'SRVYCPNB', '1000000442', 100, 0);
insert into public.members (id, auth_user_id, company_id, name, phone, role, status, privacy_agreed_at) values
  ('a4410000-0000-0000-0000-000000000001', 'a4400000-0000-0000-0000-000000000001', 'c4400000-0000-0000-0000-00000000000a', '대표', '01094401001', 'super_admin', 'approved', now()),
  ('a4410000-0000-0000-0000-000000000002', 'a4400000-0000-0000-0000-000000000002', 'c4400000-0000-0000-0000-00000000000a', '직원', '01094401002', 'employee', 'approved', now()),
  ('a4410000-0000-0000-0000-000000000003', 'a4400000-0000-0000-0000-000000000003', 'c4400000-0000-0000-0000-00000000000a', '경리', '01094401003', 'admin', 'approved', now()),
  ('a4410000-0000-0000-0000-000000000004', 'a4400000-0000-0000-0000-000000000004', 'c4400000-0000-0000-0000-00000000000b', '남의대표', '01094401004', 'super_admin', 'approved', now());

-- 직원: 설문 제출 불가
select set_config('request.jwt.claims', '{"sub":"a4400000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select public._t_raises($q$select public.submit_feedback_survey(5, 'receipt_ai', 'construction', '5-10', 'site_manager', '현장 영수증 정리가 편해졌어요', true)$q$, '42501', 'E submit');
reset role;

-- 대표: 잘못된 값은 거절, 정상 제출 → 남은 크레딧 3 + 100 = 103
select set_config('request.jwt.claims', '{"sub":"a4400000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select public._t_raises($q$select public.submit_feedback_survey(6, 'receipt_ai', 'construction', '5-10', 'site_manager', '현장 영수증 정리가 편해졌어요', true)$q$, 'INVALID_SURVEY', 'A rating');
select public._t_raises($q$select public.submit_feedback_survey(5, 'receipt_ai', 'space', '5-10', 'site_manager', '현장 영수증 정리가 편해졌어요', true)$q$, 'INVALID_SURVEY', 'A industry');
select public._t_raises($q$select public.submit_feedback_survey(5, 'receipt_ai', 'construction', '5-10', 'site_manager', repeat('가', 101), true)$q$, 'INVALID_SURVEY', 'A review long');
select public._t_raises($q$select public.submit_feedback_survey(5, 'receipt_ai', 'construction', '5-10', 'site_manager', '좋 아 요 좋 아 요', true)$q$, 'SURVEY_REVIEW_TOO_SHORT', 'A review short');
select public._t_raises($q$select public.submit_feedback_survey(5, 'receipt_ai', 'construction', '5-10', 'site_manager', null, true)$q$, 'SURVEY_REVIEW_TOO_SHORT', 'A review null');
select public._t_raises($q$select public.submit_feedback_survey(5, 'receipt_ai', 'construction', '5-10', 'site_manager', '현장 영수증 정리가 편해졌어요', false)$q$, 'SURVEY_CONSENT_REQUIRED', 'A no consent');
do $$
declare v integer;
begin
  v := public.submit_feedback_survey(5, 'receipt_ai', 'construction', '5-10', 'site_manager', '  현장 영수증 정리가 편해졌어요  ', true);
  if v <> 103 then raise exception 'FAIL [A credits left] %', v; end if;
  if (select count(*) from public.feedback_surveys) <> 1 then raise exception 'FAIL [A sees own survey]'; end if;
  if (select review from public.feedback_surveys) <> '현장 영수증 정리가 편해졌어요' then raise exception 'FAIL [A review trimmed]'; end if;
end;
$$;
-- 두 번째 제출(같은 사람)
select public._t_raises($q$select public.submit_feedback_survey(4, 'tax_export', 'construction', '5-10', 'ceo', '두 번째 후기도 써 봅니다 열 자', true)$q$, 'SURVEY_ALREADY_DONE', 'A twice');
reset role;

-- 같은 회사 다른 관리자도 다시 받을 수 없음
select set_config('request.jwt.claims', '{"sub":"a4400000-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select public._t_raises($q$select public.submit_feedback_survey(4, 'tax_export', 'construction', '5-10', 'finance', '다른 관리자 후기도 열 자 넘게', true)$q$, 'SURVEY_ALREADY_DONE', 'A2 twice');
reset role;

-- 직원은 설문 내용을 볼 수 없음
select set_config('request.jwt.claims', '{"sub":"a4400000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
do $$ begin if (select count(*) from public.feedback_surveys) <> 0 then raise exception 'FAIL [E sees survey]'; end if; end; $$;
reset role;

-- 다른 회사 관리자: 남의 설문 안 보임, 자기 회사는 따로 1회
select set_config('request.jwt.claims', '{"sub":"a4400000-0000-0000-0000-000000000004","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  if (select count(*) from public.feedback_surveys) <> 0 then raise exception 'FAIL [B sees A survey]'; end if;
  if public.submit_feedback_survey(3, 'other', 'it', '1-4', 'ceo', '다른 회사도 잘 쓰고 있어요', true) <> 200 then raise exception 'FAIL [B credits]'; end if;
  if (select count(*) from public.feedback_surveys) <> 1 then raise exception 'FAIL [B own]'; end if;
end;
$$;
select public._t_raises($q$update public.feedback_surveys set is_displayed = false$q$, '42501', 'B update direct');
reset role;

-- anon: 표 접근 불가, 함수 실행 불가
set local role anon;
select public._t_raises($q$select count(*) from public.feedback_surveys$q$, '42501', 'anon select');
select public._t_raises($q$select public.submit_feedback_survey(5, 'other', 'it', '1-4', 'ceo', '익명은 낼 수 없어요 열 자', true)$q$, '42501', 'anon submit');
reset role;

do $$
begin
  if (select count(*) from public.credit_ledger where company_id = 'c4400000-0000-0000-0000-00000000000a' and reason = 'survey_bonus' and delta = 100) <> 1 then raise exception 'FAIL [ledger A]'; end if;
  if (select receipt_credits_granted from public.companies where id = 'c4400000-0000-0000-0000-00000000000a') <> 200 then raise exception 'FAIL [granted A]'; end if;
end;
$$;

select 'feedback_survey_OK' as result;
rollback;
