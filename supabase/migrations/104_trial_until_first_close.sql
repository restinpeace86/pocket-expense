-- =============================================================================
-- 104_trial_until_first_close.sql — 무료 이용을 "첫 월말 마감까지"로 + 후기 = 첫 결제 50% 쿠폰 (D-201)
-- 사용자 결정(2026-11-03):
-- ① 무료는 100장이 아니라 기간: 가입한 달 + 다음 달 세무 마감일(다음 달 5일, 쉬는 날이면 앞 영업일)까지. 25일 이후 가입은 한 달 더
--    → 어느 날 가입해도 월말 마감(세무사무소 전달)까지 한 번은 해 본다. 장수는 안전 상한만(800장 = 비즈니스 플랜 수준).
-- ② 모든 회사의 첫 결제 50% 할인(D-134)은 없애고, 후기(설문)를 남긴 회사에만 첫 결제 50% 쿠폰. 후기 +100장(D-130)은 없앰.
-- 결제 연동 전(B-4)이라 무료 종료일이 지나도 막지 않는다(표시·안내만). 이벤트 추가 지급(D-054)은 안전장치로 그대로.
-- =============================================================================

alter table public.companies
  add column trial_ends_on date,
  add column review_coupon_at timestamptz; -- 후기를 남겨 첫 결제 50% 쿠폰을 받은 때
alter table public.companies alter column receipt_credits_granted set default 800;

insert into private.app_settings (key, value) values ('trial_receipt_cap', '800') on conflict (key) do nothing;

-- 무료 종료일: 시작일이 25일 이후면 다음 달부터 센다. 기준 달의 다음 달 세무 마감일(5일, 쉬는 날이면 앞 영업일 — 마감 알림 D-161과 같은 계산)
create or replace function private.trial_end_for(p_start date)
returns date
language sql stable
set search_path = ''
as $$
  select private.prev_working_day(
    (date_trunc('month', p_start) + case when extract(day from p_start) >= 25 then interval '2 month' else interval '1 month' end)::date + 4)
$$;

create or replace function private.company_trial_defaults()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.trial_ends_on is null then new.trial_ends_on := private.trial_end_for((now() at time zone 'Asia/Seoul')::date); end if;
  return new;
end;
$$;
revoke all on function private.company_trial_defaults() from public, anon, authenticated;
create trigger companies_trial_defaults before insert on public.companies
  for each row execute function private.company_trial_defaults();

-- 가입 무료 지급 = 무료 기간 안전 상한(설정값). 회사 만들기 함수(create_company)는 그대로 두고 지급 줄만 맞춘다
create or replace function private.trial_grant_amount()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if new.reason = 'free_trial_grant' then
    new.delta := coalesce(nullif(private.setting('trial_receipt_cap', ''), '')::integer, 800);
  end if;
  return new;
end;
$$;
revoke all on function private.trial_grant_amount() from public, anon, authenticated;
create trigger credit_ledger_trial_grant before insert on public.credit_ledger
  for each row execute function private.trial_grant_amount();

-- 이미 있는 회사: 가입일 기준 무료 종료일, 이미 후기를 남긴 회사는 쿠폰
update public.companies set trial_ends_on = private.trial_end_for((created_at at time zone 'Asia/Seoul')::date) where trial_ends_on is null;
update public.companies c set review_coupon_at = s.created_at from public.feedback_surveys s where s.company_id = c.id and c.review_coupon_at is null;

-- 후기·설문: 조건은 그대로(공백 빼고 10자 이상 + 홈페이지 소개 동의, D-137), 보상은 +100장 대신 첫 결제 50% 쿠폰. 남은 크레딧을 돌려준다
create or replace function public.submit_feedback_survey(
  p_rating integer,
  p_useful_feature text,
  p_industry text,
  p_company_size text,
  p_job_role text,
  p_review text,
  p_display_consent boolean
)
returns integer
language plpgsql security definer
set search_path = ''
as $$
declare
  v_admin public.members := private.require_admin();
  v_review text := nullif(btrim(coalesce(p_review, '')), '');
  v_left integer;
begin
  if p_rating is null or p_rating not between 1 and 5 then raise exception 'INVALID_SURVEY'; end if;
  if v_review is not null and char_length(v_review) > 100 then raise exception 'INVALID_SURVEY'; end if;
  if char_length(regexp_replace(coalesce(v_review, ''), '\s', '', 'g')) < 10 then raise exception 'SURVEY_REVIEW_TOO_SHORT'; end if;
  if not coalesce(p_display_consent, false) then raise exception 'SURVEY_CONSENT_REQUIRED'; end if;
  perform 1 from public.companies where id = v_admin.company_id for update;
  if exists (select 1 from public.feedback_surveys where company_id = v_admin.company_id) then raise exception 'SURVEY_ALREADY_DONE'; end if;
  begin
    insert into public.feedback_surveys (company_id, member_id, rating, useful_feature, industry, company_size, job_role, review, display_consent, credits_granted)
    values (v_admin.company_id, v_admin.id, p_rating, p_useful_feature, p_industry, p_company_size, p_job_role, v_review, coalesce(p_display_consent, false), 0);
  exception when check_violation then
    raise exception 'INVALID_SURVEY';
  end;
  update public.companies set review_coupon_at = coalesce(review_coupon_at, now())
   where id = v_admin.company_id
   returning receipt_credits_granted - receipt_credits_used into v_left;
  return v_left;
end;
$$;
revoke all on function public.submit_feedback_survey(integer, text, text, text, text, text, boolean) from public, anon;
grant execute on function public.submit_feedback_survey(integer, text, text, text, text, text, boolean) to authenticated;
