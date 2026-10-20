-- =============================================================================
-- 036_my_profile.sql — 직원 [내 정보] 저장 (T6-9, employee-mobile.md ⑤, D-059)
-- - 본인 정보만: 이름, 휴대폰(알림톡 수신 번호), 직급, 사번, 차량번호, 정산 계좌. 부서·역할은 관리자만 바꾼다.
-- - 정산 계좌·차량번호는 [선택] 동의가 있어야 저장한다(가입 때와 같은 규칙). 지금 동의하면 동의 시각을 남긴다.
-- - 계좌는 은행·계좌번호·예금주를 모두 입력하거나 모두 비운다(비우면 지운다).
-- =============================================================================

create or replace function public.update_my_profile(
  p_name text,
  p_phone text,
  p_position text,
  p_employee_number text,
  p_vehicle_number text,
  p_bank_name text,
  p_account_number text,
  p_account_holder text,
  p_optional_agreed boolean default false
)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_member public.members := private.require_member();
  v_name text := btrim(coalesce(p_name, ''));
  v_position text := nullif(btrim(coalesce(p_position, '')), '');
  v_emp text := nullif(btrim(coalesce(p_employee_number, '')), '');
  v_vehicle text := nullif(btrim(coalesce(p_vehicle_number, '')), '');
  v_bank text := nullif(btrim(coalesce(p_bank_name, '')), '');
  v_account text := nullif(regexp_replace(coalesce(p_account_number, ''), '[^0-9-]', '', 'g'), '');
  v_holder text := nullif(btrim(coalesce(p_account_holder, '')), '');
  v_phone text;
begin
  if length(v_name) = 0 or length(v_name) > 50 then raise exception 'INVALID_NAME'; end if;
  v_phone := private.normalize_phone(p_phone);
  if length(coalesce(v_position, '')) > 50 or length(coalesce(v_emp, '')) > 50 or length(coalesce(v_vehicle, '')) > 20
     or length(coalesce(v_bank, '')) > 30 or length(coalesce(v_account, '')) > 30 or length(coalesce(v_holder, '')) > 50 then
    raise exception 'INVALID_TEXT_LENGTH';
  end if;
  if (v_bank is null) <> (v_account is null) or (v_bank is null) <> (v_holder is null) then raise exception 'INCOMPLETE_BANK_ACCOUNT'; end if;
  if (v_bank is not null or v_vehicle is not null) and v_member.optional_consent_at is null and p_optional_agreed is not true then
    raise exception 'OPTIONAL_CONSENT_REQUIRED';
  end if;

  update public.members set
    name = v_name,
    phone = v_phone,
    position = v_position,
    employee_number = v_emp,
    vehicle_number = v_vehicle,
    optional_consent_at = case when p_optional_agreed then coalesce(optional_consent_at, now()) else optional_consent_at end,
    updated_at = now()
  where id = v_member.id;

  if v_bank is null then
    delete from public.member_bank_accounts where member_id = v_member.id;
  else
    insert into public.member_bank_accounts (member_id, company_id, bank_name, account_number, account_holder)
    values (v_member.id, v_member.company_id, v_bank, v_account, v_holder)
    on conflict (member_id) do update set bank_name = excluded.bank_name, account_number = excluded.account_number, account_holder = excluded.account_holder, updated_at = now();
  end if;
end;
$$;

revoke all on function public.update_my_profile(text, text, text, text, text, text, text, text, boolean) from public, anon;
grant execute on function public.update_my_profile(text, text, text, text, text, text, text, text, boolean) to authenticated;
