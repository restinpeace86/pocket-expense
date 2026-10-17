-- =============================================================================
-- 014_reactivate_member.sql — 비활성(퇴사) 멤버 다시 활성화 (D-062, T3-4r)
-- 쓰임: 실수로 비활성화한 경우·재입사. 역할·부서·과거 기록은 그대로 두고 상태만 approved로 되돌린다.
-- 권한: 비활성화와 같은 기준 — 관리자는 일반 멤버만, 최고 관리자는 관리자까지. 다른 회사 대상은 NOT_FOUND.
-- =============================================================================

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
  update public.members set status = 'approved', updated_at = now() where id = v_target.id;
end;
$$;

revoke all on function public.reactivate_member(uuid) from public, anon;
grant execute on function public.reactivate_member(uuid) to authenticated;
