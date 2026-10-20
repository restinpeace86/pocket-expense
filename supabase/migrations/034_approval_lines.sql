-- =============================================================================
-- 034_approval_lines.sql — 사전 검토 결재라인 저장 (T4-1, approval-workflow.md §2)
-- - save_approval_line: 회사 기본(p_department_id = null) 또는 부서별 결재라인의 사전 검토 단계를 통째로 바꾼다(관리자 이상).
--   검토자는 같은 회사의 활성 멤버, 0~4명, 중복 불가. 부서별 라인을 0명으로 저장하면 그 라인을 지워 기본 결재라인을 따른다.
-- - 진행 중인 결재에는 영향 없음(상신 때 단계를 스냅샷하므로, D-012)
-- =============================================================================

create or replace function public.save_approval_line(p_department_id uuid, p_approver_ids uuid[])
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_member public.members := private.require_member();
  v_ids uuid[] := coalesce(p_approver_ids, '{}');
  v_line uuid;
  v_name text;
  i integer;
begin
  if v_member.role not in ('super_admin', 'admin') then
    raise exception 'NOT_ALLOWED' using errcode = '42501';
  end if;
  if cardinality(v_ids) > 4 then raise exception 'TOO_MANY_REVIEWERS'; end if;
  if cardinality(v_ids) <> (select count(distinct x) from unnest(v_ids) x) then raise exception 'DUPLICATE_REVIEWER'; end if;
  if exists (
    select 1 from unnest(v_ids) x
     where not exists (select 1 from public.members m where m.id = x and m.company_id = v_member.company_id and m.status = 'approved')
  ) then
    raise exception 'INVALID_REVIEWER';
  end if;

  if p_department_id is not null then
    select name into v_name from public.departments where id = p_department_id and company_id = v_member.company_id;
    if not found then raise exception 'NOT_FOUND' using errcode = '42501'; end if;
    if cardinality(v_ids) = 0 then
      delete from public.approval_lines where company_id = v_member.company_id and department_id = p_department_id;
      return null;
    end if;
  end if;

  select id into v_line from public.approval_lines where company_id = v_member.company_id and department_id is not distinct from p_department_id for update;
  if v_line is null then
    insert into public.approval_lines (company_id, name, department_id)
    values (v_member.company_id, coalesce(v_name || ' 결재라인', '기본 결재라인'), p_department_id)
    returning id into v_line;
  end if;

  delete from public.approval_line_steps where approval_line_id = v_line;
  for i in 1 .. cardinality(v_ids) loop
    insert into public.approval_line_steps (approval_line_id, company_id, step_order, approver_member_id)
    values (v_line, v_member.company_id, i, v_ids[i]);
  end loop;
  update public.approval_lines set updated_at = now() where id = v_line;
  return v_line;
end;
$$;

revoke all on function public.save_approval_line(uuid, uuid[]) from public, anon;
grant execute on function public.save_approval_line(uuid, uuid[]) to authenticated;
