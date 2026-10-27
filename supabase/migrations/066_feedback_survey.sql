-- =============================================================================
-- 066_feedback_survey.sql — 후기·설문 작성 시 +100 크레딧(회사당 1회) + 랜딩 실제 사용자 후기 (7차 개선사항 7, D-130)
-- - 설문 1건 = 회사 1곳(크레딧이 회사 단위라서). 관리자 이상만 제출(submit_feedback_survey)
-- - 제출과 같은 트랜잭션에서 receipt_credits_granted += 100, credit_ledger +100 'survey_bonus'. 두 번째 제출은 'SURVEY_ALREADY_DONE'
-- - 랜딩 표시: 홈페이지 소개 동의(display_consent) + 운영자가 숨기지 않음(is_displayed) + 한 줄 후기가 있는 것만.
--   작성자는 업종·직무·규모로만(회사명·이름 없음). 랜딩은 서버가 service role로 익명 칸만 읽는다(anon 권한 없음)
-- - 운영자(app_admins)가 앱관리자 화면에서 is_displayed를 끈다(service role)
-- =============================================================================

-- 크레딧 이력 사유에 설문 지급 추가
do $$
declare c text;
begin
  select conname into c from pg_constraint
   where conrelid = 'public.credit_ledger'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%reason%';
  if c is not null then execute format('alter table public.credit_ledger drop constraint %I', c); end if;
end;
$$;
alter table public.credit_ledger
  add constraint credit_ledger_reason_check check (reason in ('free_trial_grant', 'receipt_upload', 'event_bonus', 'survey_bonus'));

create table public.feedback_surveys (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null unique references public.companies (id) on delete cascade,
  member_id uuid,
  rating smallint not null check (rating between 1 and 5),
  useful_feature text not null check (useful_feature in ('receipt_ai', 'kakao_approval', 'tax_export', 'form_template', 'meal_split', 'trip', 'payouts', 'other')),
  industry text not null check (industry in ('construction', 'interior', 'it', 'manufacturing', 'distribution', 'service', 'nonprofit', 'other')),
  company_size text not null check (company_size in ('1-4', '5-10', '11-30', '31+')),
  job_role text not null check (job_role in ('ceo', 'site_manager', 'finance', 'office_admin', 'team_lead', 'other')),
  review text check (review is null or char_length(review) between 1 and 100),
  display_consent boolean not null default false,
  is_displayed boolean not null default true,
  credits_granted integer not null default 100 check (credits_granted >= 0),
  created_at timestamptz not null default now(),
  foreign key (member_id, company_id) references public.members (id, company_id) on delete set null (member_id)
);
create index feedback_surveys_display_idx on public.feedback_surveys (created_at desc) where display_consent and is_displayed and review is not null;

alter table public.feedback_surveys enable row level security;
alter table public.feedback_surveys force row level security;
revoke all on public.feedback_surveys from anon, authenticated;
grant select on public.feedback_surveys to authenticated;
-- 자기 회사 관리자만 참여 여부·내용을 본다. 쓰기는 함수로만
create policy feedback_surveys_select on public.feedback_surveys for select to authenticated
  using (company_id = (select private.current_company_id()) and (select private.is_admin()));

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
  v_bonus constant integer := 100;
  v_review text := nullif(btrim(coalesce(p_review, '')), '');
  v_left integer;
begin
  if p_rating is null or p_rating not between 1 and 5 then raise exception 'INVALID_SURVEY'; end if;
  if v_review is not null and char_length(v_review) > 100 then raise exception 'INVALID_SURVEY'; end if;
  -- 회사당 1회: 먼저 잠그고 확인(동시에 두 관리자가 내도 한 번만)
  perform 1 from public.companies where id = v_admin.company_id for update;
  if exists (select 1 from public.feedback_surveys where company_id = v_admin.company_id) then raise exception 'SURVEY_ALREADY_DONE'; end if;
  begin
    insert into public.feedback_surveys (company_id, member_id, rating, useful_feature, industry, company_size, job_role, review, display_consent, credits_granted)
    values (v_admin.company_id, v_admin.id, p_rating, p_useful_feature, p_industry, p_company_size, p_job_role, v_review, coalesce(p_display_consent, false), v_bonus);
  exception when check_violation then
    raise exception 'INVALID_SURVEY';
  end;
  update public.companies set receipt_credits_granted = receipt_credits_granted + v_bonus
   where id = v_admin.company_id
   returning receipt_credits_granted - receipt_credits_used into v_left;
  insert into public.credit_ledger (company_id, delta, reason, member_id) values (v_admin.company_id, v_bonus, 'survey_bonus', v_admin.id);
  return v_left;
end;
$$;
revoke all on function public.submit_feedback_survey(integer, text, text, text, text, text, boolean) from public, anon;
grant execute on function public.submit_feedback_survey(integer, text, text, text, text, text, boolean) to authenticated;
