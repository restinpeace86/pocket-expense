-- =============================================================================
-- 071_survey_review_required.sql — 설문 +100장 조건: 후기 10자 이상 + 홈페이지 소개 동의 (D-137, D-130·D-135 보완)
-- - 설문 크레딧의 목적은 랜딩에 보일 실제 후기. 짧은 후기·소개 미동의로는 100장을 주지 않는다(서버에서 막음)
-- =============================================================================

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
  -- 100장은 홈페이지에 소개할 후기의 대가: 공백 빼고 10자 이상 후기 + 소개 동의가 있어야 한다(D-137)
  if char_length(regexp_replace(coalesce(v_review, ''), '\s', '', 'g')) < 10 then raise exception 'SURVEY_REVIEW_TOO_SHORT'; end if;
  if not coalesce(p_display_consent, false) then raise exception 'SURVEY_CONSENT_REQUIRED'; end if;
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
