-- =============================================================================
-- 012_member_admin_functions.sql — 가입 승인·거절, 공용 초대 코드 재발급 (T3-4 일부, T3-2 일부)
-- 기준: spec/features/auth-onboarding.md §4, spec/screens/admin-team-members.md §4.A
-- 격리: 호출자는 승인된 관리자 이상, 대상은 반드시 호출자와 같은 회사. 다른 회사 대상은 존재 여부를 숨기고 NOT_FOUND.
-- =============================================================================

create or replace function private.require_admin()
returns public.members
language plpgsql stable security definer
set search_path = ''
as $$
declare v public.members;
begin
  v := private.require_member();
  if v.role not in ('super_admin', 'admin') then
    raise exception 'NOT_ALLOWED' using errcode = '42501';
  end if;
  return v;
end;
$$;

-- 가입 승인: pending → approved
create or replace function public.approve_member(p_member_id uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare v_admin public.members := private.require_admin(); v_target public.members;
begin
  select * into v_target from public.members where id = p_member_id for update;
  if not found or v_target.company_id <> v_admin.company_id then
    raise exception 'NOT_FOUND' using errcode = '42501';
  end if;
  if v_target.status <> 'pending' then raise exception 'NOT_PENDING'; end if;
  update public.members set status = 'approved', approved_at = now() where id = p_member_id;
end;
$$;

-- 가입 거절: 승인 대기 멤버 행 삭제 (해당 계정은 다시 가입 신청할 수 있다). 정산 계좌는 cascade로 함께 삭제
create or replace function public.reject_member(p_member_id uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare v_admin public.members := private.require_admin(); v_target public.members;
begin
  select * into v_target from public.members where id = p_member_id for update;
  if not found or v_target.company_id <> v_admin.company_id then
    raise exception 'NOT_FOUND' using errcode = '42501';
  end if;
  if v_target.status <> 'pending' then raise exception 'NOT_PENDING'; end if;
  delete from public.members where id = p_member_id;
end;
$$;

-- 공용 초대 코드 재발급: 이전 링크·QR은 즉시 무효
create or replace function public.regenerate_invite_code()
returns text
language plpgsql security definer
set search_path = ''
as $$
declare v_admin public.members := private.require_admin(); v_code text := private.gen_invite_code();
begin
  update public.companies set invite_code = v_code where id = v_admin.company_id;
  return v_code;
end;
$$;

revoke all on function private.require_admin() from public, anon, authenticated;
revoke all on function public.approve_member(uuid), public.reject_member(uuid), public.regenerate_invite_code() from public, anon;
grant execute on function public.approve_member(uuid), public.reject_member(uuid), public.regenerate_invite_code() to authenticated;
