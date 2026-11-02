-- =============================================================================
-- 105_trial_trigger_definer.sql — 무료 종료일 트리거 권한 보완 (D-201, migration 104 보완)
-- 회사 행을 서비스 키 등으로 직접 넣을 때 트리거가 private 함수를 못 불러 실패하던 문제(permission denied for schema private).
-- 트리거 함수와 종료일 계산을 security definer로 — 가입(create_company)은 원래 definer라 영향 없었음
-- =============================================================================
create or replace function private.trial_end_for(p_start date)
returns date
language sql stable security definer
set search_path = ''
as $$
  select private.prev_working_day(
    (date_trunc('month', p_start) + case when extract(day from p_start) >= 25 then interval '2 month' else interval '1 month' end)::date + 4)
$$;
revoke all on function private.trial_end_for(date) from public, anon, authenticated;

create or replace function private.company_trial_defaults()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if new.trial_ends_on is null then new.trial_ends_on := private.trial_end_for((now() at time zone 'Asia/Seoul')::date); end if;
  return new;
end;
$$;
revoke all on function private.company_trial_defaults() from public, anon, authenticated;
