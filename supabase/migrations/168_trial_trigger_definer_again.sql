-- 168: 167에서 company_trial_defaults를 다시 만들 때 security definer가 빠짐(105에서 넣었던 것) → 되돌림
-- 영향: 가입(create_company, definer)은 정상이었고, 운영 키로 회사를 직접 넣는 경로(자동 점검)만 'permission denied for schema private'
create or replace function private.company_trial_defaults()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if new.trial_ends_on is null and not new.billing_exempt then new.trial_ends_on := private.trial_end_for((now() at time zone 'Asia/Seoul')::date); end if;
  return new;
end;
$$;
revoke all on function private.company_trial_defaults() from public, anon, authenticated;
