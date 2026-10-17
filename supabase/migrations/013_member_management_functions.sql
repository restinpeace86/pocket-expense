-- =============================================================================
-- 013_member_management_functions.sql — 멤버 편집·역할 변경·최고 관리자 넘기기·비활성화 (T3-4)
-- 기준: spec/features/roles-and-permissions.md §2·§3·§5, spec/screens/admin-team-members.md §4.B~D, D-038
-- 격리: 호출자는 승인된 관리자 이상, 대상은 반드시 호출자와 같은 회사. 다른 회사 대상은 존재 여부를 숨기고 NOT_FOUND.
-- 권한: 관리자는 일반 멤버(employee)와 본인만, 최고 관리자는 모두. 역할 변경·넘기기·관리자 비활성화는 최고 관리자만.
-- =============================================================================

-- 같은 회사 대상 멤버를 잠그고 가져온다 (다른 회사면 NOT_FOUND)
create or replace function private.lock_company_member(p_admin public.members, p_member_id uuid)
returns public.members
language plpgsql security definer
set search_path = ''
as $$
declare v public.members;
begin
  select * into v from public.members where id = p_member_id and company_id = p_admin.company_id for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = '42501';
  end if;
  return v;
end;
$$;

-- 관리자는 일반 멤버만 관리할 수 있다. 최고 관리자는 모두.
create or replace function private.require_can_manage(p_admin public.members, p_target public.members)
returns void
language plpgsql immutable
set search_path = ''
as $$
begin
  if p_admin.role = 'super_admin' then return; end if;
  if p_target.role <> 'employee' then
    raise exception 'NOT_ALLOWED' using errcode = '42501';
  end if;
end;
$$;

-- 멤버 정보 편집: 이름·휴대폰·부서·직급·사번 (관리자 본인 정보는 본인이 편집 가능)
create or replace function public.update_member(
  p_member_id uuid,
  p_name text,
  p_phone text,
  p_department_id uuid,
  p_position text,
  p_employee_number text
)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_admin public.members := private.require_admin();
  v_target public.members := private.lock_company_member(v_admin, p_member_id);
  v_name text := btrim(coalesce(p_name, ''));
  v_position text := nullif(btrim(coalesce(p_position, '')), '');
  v_no text := nullif(btrim(coalesce(p_employee_number, '')), '');
begin
  if v_target.id <> v_admin.id then
    perform private.require_can_manage(v_admin, v_target);
  end if;
  if length(v_name) = 0 or length(v_name) > 50 then raise exception 'INVALID_NAME'; end if;
  if length(v_position) > 50 or length(v_no) > 50 then raise exception 'INVALID_TEXT_LENGTH'; end if;
  if p_department_id is not null
     and not exists (select 1 from public.departments where id = p_department_id and company_id = v_admin.company_id) then
    raise exception 'INVALID_DEPARTMENT';
  end if;
  update public.members
     set name = v_name,
         phone = private.normalize_phone(p_phone),
         department_id = p_department_id,
         position = v_position,
         employee_number = v_no,
         updated_at = now()
   where id = v_target.id;
end;
$$;

-- 역할 변경(관리자 지정·해제): 최고 관리자만. 최고 관리자 역할은 넘기기로만 바뀐다.
create or replace function public.set_member_role(p_member_id uuid, p_role public.member_role)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_admin public.members := private.require_admin();
  v_target public.members := private.lock_company_member(v_admin, p_member_id);
begin
  if v_admin.role <> 'super_admin' then raise exception 'NOT_ALLOWED' using errcode = '42501'; end if;
  if p_role not in ('admin', 'employee') then raise exception 'INVALID_ROLE'; end if;
  if v_target.role = 'super_admin' then raise exception 'SUPER_ADMIN_LOCKED'; end if;
  if v_target.status <> 'approved' then raise exception 'NOT_APPROVED'; end if;
  update public.members set role = p_role, updated_at = now() where id = v_target.id;
end;
$$;

-- 최고 관리자 넘기기: 한 트랜잭션으로 대상 super_admin, 본인 admin
create or replace function public.transfer_super_admin(p_member_id uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_admin public.members := private.require_admin();
  v_target public.members := private.lock_company_member(v_admin, p_member_id);
begin
  if v_admin.role <> 'super_admin' then raise exception 'NOT_ALLOWED' using errcode = '42501'; end if;
  if v_target.id = v_admin.id then raise exception 'INVALID_TARGET'; end if;
  if v_target.status <> 'approved' then raise exception 'NOT_APPROVED'; end if;
  -- 회사당 최고 관리자 1명(partial unique) 유지: 본인을 먼저 내린다
  update public.members set role = 'admin', updated_at = now() where id = v_admin.id;
  update public.members set role = 'super_admin', updated_at = now() where id = v_target.id;
end;
$$;

-- 비활성화 전 점검: 경고(진행 가능)와 차단(먼저 처리 필요) 정보
create or replace function public.member_deactivation_check(p_member_id uuid)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_admin public.members := private.require_admin();
  v_target public.members;
  v_unpaid integer; v_payout integer; v_payback integer; v_open integer;
  v_line_steps integer; v_reviews integer;
begin
  select * into v_target from public.members where id = p_member_id and company_id = v_admin.company_id;
  if not found then raise exception 'NOT_FOUND' using errcode = '42501'; end if;
  perform private.require_can_manage(v_admin, v_target);

  select count(*), coalesce(sum(s.payout), 0), coalesce(sum(s.payback), 0)
    into v_unpaid, v_payout, v_payback
    from public.expense_claims c
    cross join lateral private.claim_settlement(c.id) s
   where c.company_id = v_admin.company_id and c.member_id = v_target.id and c.status = 'approved';
  select count(*) into v_open from public.expense_claims
   where company_id = v_admin.company_id and member_id = v_target.id and status in ('draft', 'rejected');
  select count(*) into v_line_steps from public.approval_line_steps
   where company_id = v_admin.company_id and approver_member_id = v_target.id;
  select count(*) into v_reviews from public.claim_approvals
   where company_id = v_admin.company_id and approver_member_id = v_target.id and status = 'pending';

  return jsonb_build_object(
    'unpaid_claims', v_unpaid, 'payout_amount', v_payout, 'payback_amount', v_payback,
    'open_claims', v_open, 'approval_line_steps', v_line_steps, 'pending_reviews', v_reviews,
    'blocked', v_line_steps > 0 or v_reviews > 0
  );
end;
$$;

-- 비활성화(퇴사 처리): 과거 기록은 보존, 회사 데이터 접근·신규 청구 차단(require_member가 approved만 통과)
create or replace function public.deactivate_member(p_member_id uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_admin public.members := private.require_admin();
  v_target public.members := private.lock_company_member(v_admin, p_member_id);
begin
  if v_target.role = 'super_admin' then raise exception 'SUPER_ADMIN_LOCKED'; end if;
  if v_target.id = v_admin.id then raise exception 'INVALID_TARGET'; end if;
  perform private.require_can_manage(v_admin, v_target);
  if v_target.status <> 'approved' then raise exception 'NOT_APPROVED'; end if;
  if exists (select 1 from public.approval_line_steps where company_id = v_admin.company_id and approver_member_id = v_target.id) then
    raise exception 'MEMBER_IN_APPROVAL_LINE';
  end if;
  if exists (select 1 from public.claim_approvals where company_id = v_admin.company_id and approver_member_id = v_target.id and status = 'pending') then
    raise exception 'MEMBER_HAS_PENDING_REVIEW';
  end if;
  update public.members set status = 'inactive', updated_at = now() where id = v_target.id;
end;
$$;

revoke all on function private.lock_company_member(public.members, uuid), private.require_can_manage(public.members, public.members)
  from public, anon, authenticated;
revoke all on function public.update_member(uuid, text, text, uuid, text, text), public.set_member_role(uuid, public.member_role),
  public.transfer_super_admin(uuid), public.member_deactivation_check(uuid), public.deactivate_member(uuid) from public, anon;
grant execute on function public.update_member(uuid, text, text, uuid, text, text), public.set_member_role(uuid, public.member_role),
  public.transfer_super_admin(uuid), public.member_deactivation_check(uuid), public.deactivate_member(uuid) to authenticated;
