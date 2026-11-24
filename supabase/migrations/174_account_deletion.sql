-- =============================================================================
-- 174_account_deletion.sql — 계정 삭제(D-314, spec/features/account-deletion.md)
-- 앱 스토어 정책: 앱에서 가입할 수 있으면 앱 안·웹에서 계정을 지울 수 있어야 한다.
-- 사용자 결정 2026-11-25:
--   ① 회사에 남긴 기록(지출결의서·영수증·출퇴근·휴가·채팅)은 회사에 남긴다 — 세무 5년·근태 3년 보관은 회사 의무.
--      기록에는 이름만 남고, 로그인 계정·휴대폰·이메일·차량번호·유종·계좌·알림 연결은 지운다.
--   ② 최고 관리자는 바로 지울 수 없다 — 먼저 [최고 관리자 넘기기], 혼자면 회사 해지를 운영자에게 요청(안내).
-- 순서: prepare_account_deletion()(이 함수, 본인) → 서버가 auth 사용자 삭제(service role).
--       함수는 몇 번 다시 불러도 같은 결과(이미 지운 뒤면 할 일 없음) → 중간에 실패해도 다시 누르면 끝난다.
-- =============================================================================

-- 지운 계정은 로그인 계정 연결이 없다(남은 기록의 주인 표시만). 휴대폰은 빈 값 허용(지운 계정만)
alter table public.members alter column auth_user_id drop not null;
alter table public.members add column if not exists account_deleted_at timestamptz;
alter table public.members drop constraint if exists members_phone_check;
alter table public.members add constraint members_phone_check
  check (phone ~ '^[0-9]{9,11}$' or (account_deleted_at is not null and phone = ''));
alter table public.members add constraint members_deleted_unlinked
  check (account_deleted_at is null or (auth_user_id is null and status = 'inactive'));

-- 지우기 전 확인(화면 안내용): 막히는 이유가 있으면 코드로 돌려준다
create or replace function public.account_deletion_check()
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  m public.members;
  t public.tax_office_members;
  v_company text;
  v_office text;
  v_reason text;
  v_others int := 0;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '42501'; end if;
  select * into m from public.members where auth_user_id = v_uid;
  select * into t from public.tax_office_members where auth_user_id = v_uid;
  if m.id is not null then
    select name into v_company from public.companies where id = m.company_id;
    if m.role = 'super_admin' then
      select count(*) into v_others from public.members where company_id = m.company_id and id <> m.id and status = 'approved';
      v_reason := case when v_others > 0 then 'SUPER_ADMIN_MUST_TRANSFER' else 'SOLE_ADMIN_CLOSE_COMPANY' end;
    elsif exists (select 1 from public.approval_line_steps where company_id = m.company_id and approver_member_id = m.id) then
      v_reason := 'SELF_IN_APPROVAL_LINE';
    elsif exists (select 1 from public.claim_approvals where company_id = m.company_id and approver_member_id = m.id and status = 'pending') then
      v_reason := 'SELF_HAS_PENDING_REVIEW';
    end if;
  end if;
  if v_reason is null and t.id is not null then
    select name into v_office from public.tax_offices where id = t.office_id;
    if t.role = 'admin' then v_reason := 'ADMIN_MUST_TRANSFER'; end if;
  end if;
  return jsonb_build_object('company', v_company, 'role', m.role, 'office', v_office, 'blocked', v_reason);
end;
$$;

-- 본인 계정 정리(auth 사용자 삭제 직전 단계)
create or replace function public.prepare_account_deletion()
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_check jsonb;
  m public.members;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '42501'; end if;
  v_check := public.account_deletion_check();
  if v_check->>'blocked' is not null then raise exception '%', v_check->>'blocked'; end if;

  select * into m from public.members where auth_user_id = v_uid for update;
  if m.id is not null then
    delete from public.member_bank_accounts where member_id = m.id;
    delete from public.push_subscriptions where member_id = m.id;
    delete from public.push_app_tokens where member_id = m.id;
    -- 이름·사번·부서·직급은 회사 기록의 주인 표시로 남긴다. 상태 inactive → 나만 보기 파일은 퇴사와 같이 30일 뒤 파기(134)
    update public.members
       set status = 'inactive', auth_user_id = null, account_deleted_at = now(),
           phone = '', email = null, vehicle_number = null, fuel_type = null, updated_at = now()
     where id = m.id;
  end if;
  -- 세무사무소: 소속 세무사는 사무소에서 빠진다(맡던 배정은 FK로 풀림 — leave_tax_office와 같음)
  delete from public.tax_office_members where auth_user_id = v_uid and role <> 'admin';
  -- 올린 파일(영수증 등)은 회사 자료로 남기고 '올린 사람' 연결만 끊는다 — 연결이 남아 있으면 auth 사용자를 지울 수 없다
  update storage.objects set owner = null, owner_id = null where owner = v_uid or owner_id = v_uid::text;
end;
$$;

-- 지운 계정은 다시 활성화할 수 없다(로그인 계정이 없음) — 다시 함께하려면 새로 초대
create or replace function public.reactivate_member(p_member_id uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_admin public.members := private.require_admin();
  v_target public.members := private.lock_company_member(v_admin, p_member_id);
begin
  perform private.require_can_manage(v_admin, v_target);
  if v_target.status <> 'inactive' then raise exception 'NOT_INACTIVE'; end if;
  if v_target.account_deleted_at is not null then raise exception 'ACCOUNT_DELETED'; end if;
  update public.members set status = 'approved', updated_at = now() where id = v_target.id;
end;
$$;

revoke all on function public.account_deletion_check(), public.prepare_account_deletion() from public, anon;
grant execute on function public.account_deletion_check(), public.prepare_account_deletion() to authenticated;
