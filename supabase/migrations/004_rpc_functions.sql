-- =============================================================================
-- 004_rpc_functions.sql — 상태 전이 · 크레딧 서버 함수 (기준: spec/data/expense-lifecycle.md)
--   모든 함수는 SECURITY DEFINER이므로 RLS를 우회한다 → 함수 안에서 반드시
--   (1) 호출자의 승인된 멤버 확인 (2) 대상 행의 company_id가 호출자 회사와 같은지 확인한다.
--   다른 회사 행이면 존재 여부를 알려 주지 않도록 'NOT_FOUND'로 통일한다.
--   T1-4 범위: 상태 전이·권한·결재 단계 스냅샷. 상세 항목 검증·금액 재계산·계정과목 스냅샷은 T9-1에서 보강한다.
-- =============================================================================

-- 호출자(승인된 멤버) 조회. 없으면 예외.
create or replace function private.require_member()
returns public.members
language plpgsql stable security definer
set search_path = ''
as $$
declare v public.members;
begin
  select * into v from public.members where auth_user_id = (select auth.uid()) and status = 'approved';
  if not found then
    raise exception 'NOT_A_MEMBER' using errcode = '42501';
  end if;
  return v;
end;
$$;

-- 소명서 정산 금액: 지급(사비 회사 지원금) / 납부(법인카드 개인 부담) — D-010, D-047
create or replace function private.claim_settlement(p_claim_id uuid, out payout integer, out payback integer)
language sql stable security definer
set search_path = ''
as $$
  select
    coalesce(sum(case when i.payment_method = 'personal_card' then coalesce(i.company_supported_amount, i.amount, 0) else 0 end), 0)::integer,
    coalesce(sum(case when i.payment_method = 'corporate_card' then i.personal_burden_amount else 0 end), 0)::integer
  from public.expense_items i
  where i.claim_id = p_claim_id
$$;

-- 상신 ----------------------------------------------------------------------------
create or replace function public.submit_claim(p_claim_id uuid)
returns public.claim_status
language plpgsql security definer
set search_path = ''
as $$
declare
  v_member public.members;
  v_claim public.expense_claims;
  v_line_id uuid;
  v_round integer;
  v_step record;
  v_order integer := 0;
  v_own_order integer;
  v_item_count integer;
  v_payout integer;
  v_payback integer;
begin
  v_member := private.require_member();

  select * into v_claim from public.expense_claims where id = p_claim_id for update;
  if not found or v_claim.company_id <> v_member.company_id or v_claim.member_id <> v_member.id then
    raise exception 'NOT_FOUND' using errcode = '42501';
  end if;
  if v_claim.status not in ('draft', 'rejected') then
    raise exception 'INVALID_STATUS';
  end if;

  -- 기본 검증 (상세 검증은 T9-1)
  if length(trim(coalesce(v_claim.title, ''))) = 0 then raise exception 'TITLE_REQUIRED'; end if;
  if length(trim(coalesce(v_claim.description, ''))) = 0 then raise exception 'DESCRIPTION_REQUIRED'; end if;
  select count(*) into v_item_count from public.expense_items where claim_id = p_claim_id;
  if v_item_count < 1 or v_item_count > 30 then raise exception 'ITEM_COUNT_OUT_OF_RANGE'; end if;
  if exists (select 1 from public.expense_items where claim_id = p_claim_id and parse_status = 'parsing') then
    raise exception 'ITEMS_PARSING';
  end if;

  -- 합계 갱신
  update public.expense_claims c set
    item_count = v_item_count,
    total_amount = s.total_amount,
    total_company_supported = s.total_supported,
    total_personal_burden = s.total_burden
  from (
    select coalesce(sum(coalesce(amount, 0)), 0)::integer as total_amount,
           coalesce(sum(coalesce(company_supported_amount, amount, 0)), 0)::integer as total_supported,
           coalesce(sum(personal_burden_amount), 0)::integer as total_burden
    from public.expense_items where claim_id = p_claim_id
  ) s
  where c.id = p_claim_id;

  v_round := v_claim.current_round + 1;

  -- 결재라인 선택: 부서별 → 회사 기본 (D-039)
  select id into v_line_id from public.approval_lines
   where company_id = v_member.company_id and department_id = v_member.department_id;
  if v_line_id is null then
    select id into v_line_id from public.approval_lines
     where company_id = v_member.company_id and department_id is null;
  end if;

  -- 사전 검토 단계 스냅샷
  if v_line_id is not null then
    for v_step in
      select s.step_order, s.approver_member_id, m.status as approver_status
        from public.approval_line_steps s
        join public.members m on m.id = s.approver_member_id and m.company_id = s.company_id
       where s.approval_line_id = v_line_id and s.company_id = v_member.company_id
       order by s.step_order
    loop
      if v_step.approver_status <> 'approved' then
        raise exception 'INACTIVE_REVIEWER';
      end if;
      v_order := v_order + 1;
      insert into public.claim_approvals (claim_id, company_id, round, step_order, step_kind, approver_member_id, status)
      values (p_claim_id, v_member.company_id, v_round, v_order, 'review', v_step.approver_member_id, 'waiting');
      if v_step.approver_member_id = v_member.id then
        v_own_order := v_order;
      end if;
    end loop;
  end if;

  -- 관리자 최종 승인 단계 (고정)
  v_order := v_order + 1;
  insert into public.claim_approvals (claim_id, company_id, round, step_order, step_kind, approver_member_id, status)
  values (p_claim_id, v_member.company_id, v_round, v_order, 'final', null, 'waiting');

  -- 최고 관리자 본인 소명서: 결재 생략 (D-026)
  if v_member.role = 'super_admin' then
    update public.claim_approvals set status = 'skipped'
     where claim_id = p_claim_id and round = v_round;
    select payout, payback into v_payout, v_payback from private.claim_settlement(p_claim_id);
    update public.expense_claims set
      status = case when v_payout = 0 and v_payback = 0 then 'paid'::public.claim_status else 'approved'::public.claim_status end,
      settlement_required = (v_payout > 0 or v_payback > 0),
      self_approved = true,
      current_round = v_round,
      submitted_at = now(),
      approved_at = now(),
      paid_at = case when v_payout = 0 and v_payback = 0 then now() else null end
     where id = p_claim_id;
    return (select status from public.expense_claims where id = p_claim_id);
  end if;

  -- 본인이 사전 검토자로 포함되면 본인 단계까지 skip (D-026)
  if v_own_order is not null then
    update public.claim_approvals set status = 'skipped'
     where claim_id = p_claim_id and round = v_round and step_order <= v_own_order;
  end if;

  update public.claim_approvals set status = 'pending'
   where id = (select id from public.claim_approvals
                where claim_id = p_claim_id and round = v_round and status = 'waiting'
                order by step_order limit 1);

  update public.expense_claims set
    status = 'submitted', current_round = v_round, submitted_at = now(), self_approved = false, settlement_required = null
   where id = p_claim_id;
  return 'submitted';
end;
$$;

-- 처리 권한 확인용: 현재 pending 단계를 잠그고 반환
create or replace function private.lock_pending_step(p_claim public.expense_claims, p_member public.members)
returns public.claim_approvals
language plpgsql security definer
set search_path = ''
as $$
declare v_step public.claim_approvals;
begin
  select * into v_step from public.claim_approvals
   where claim_id = p_claim.id and round = p_claim.current_round and status = 'pending'
   for update;
  if not found then
    raise exception 'ALREADY_PROCESSED';
  end if;
  if v_step.step_kind = 'review' then
    if v_step.approver_member_id <> p_member.id then
      raise exception 'NOT_ALLOWED' using errcode = '42501';
    end if;
  else
    if p_member.role not in ('super_admin', 'admin') or p_claim.member_id = p_member.id then
      raise exception 'NOT_ALLOWED' using errcode = '42501';
    end if;
  end if;
  return v_step;
end;
$$;

-- 승인 (사전 검토 승인 / 관리자 일괄 승인) ---------------------------------------------
create or replace function public.approve_claim(p_claim_id uuid, p_comment text default null)
returns public.claim_status
language plpgsql security definer
set search_path = ''
as $$
declare
  v_member public.members;
  v_claim public.expense_claims;
  v_step public.claim_approvals;
  v_next uuid;
  v_payout integer;
  v_payback integer;
begin
  v_member := private.require_member();
  select * into v_claim from public.expense_claims where id = p_claim_id for update;
  if not found or v_claim.company_id <> v_member.company_id then
    raise exception 'NOT_FOUND' using errcode = '42501';
  end if;
  if v_claim.status <> 'submitted' then
    raise exception 'INVALID_STATUS';
  end if;

  v_step := private.lock_pending_step(v_claim, v_member);
  update public.claim_approvals set status = 'approved', acted_by_member_id = v_member.id, acted_at = now(), comment = p_comment
   where id = v_step.id;

  select id into v_next from public.claim_approvals
   where claim_id = p_claim_id and round = v_claim.current_round and status = 'waiting'
   order by step_order limit 1;
  if v_next is not null then
    update public.claim_approvals set status = 'pending' where id = v_next;
    return 'submitted';
  end if;

  select payout, payback into v_payout, v_payback from private.claim_settlement(p_claim_id);
  update public.expense_claims set
    status = case when v_payout = 0 and v_payback = 0 then 'paid'::public.claim_status else 'approved'::public.claim_status end,
    settlement_required = (v_payout > 0 or v_payback > 0),
    approved_at = now(),
    paid_at = case when v_payout = 0 and v_payback = 0 then now() else null end
   where id = p_claim_id;
  return (select status from public.expense_claims where id = p_claim_id);
end;
$$;

-- 반려 ---------------------------------------------------------------------------
create or replace function public.reject_claim(p_claim_id uuid, p_reason text, p_flagged_item_ids uuid[] default '{}')
returns public.claim_status
language plpgsql security definer
set search_path = ''
as $$
declare
  v_member public.members;
  v_claim public.expense_claims;
  v_step public.claim_approvals;
begin
  v_member := private.require_member();
  select * into v_claim from public.expense_claims where id = p_claim_id for update;
  if not found or v_claim.company_id <> v_member.company_id then
    raise exception 'NOT_FOUND' using errcode = '42501';
  end if;
  if v_claim.status <> 'submitted' then
    raise exception 'INVALID_STATUS';
  end if;
  if length(trim(coalesce(p_reason, ''))) < 5 then
    raise exception 'REASON_TOO_SHORT';
  end if;
  -- 지목 항목은 반드시 이 소명서의 항목이어야 한다
  if exists (
    select 1 from unnest(coalesce(p_flagged_item_ids, '{}')) f(id)
    where not exists (select 1 from public.expense_items i where i.id = f.id and i.claim_id = p_claim_id)
  ) then
    raise exception 'INVALID_FLAGGED_ITEMS';
  end if;

  v_step := private.lock_pending_step(v_claim, v_member);
  update public.claim_approvals set
    status = 'rejected', acted_by_member_id = v_member.id, acted_at = now(),
    comment = p_reason, flagged_item_ids = coalesce(p_flagged_item_ids, '{}')
   where id = v_step.id;
  update public.claim_approvals set status = 'canceled'
   where claim_id = p_claim_id and round = v_claim.current_round and status = 'waiting';
  update public.expense_claims set status = 'rejected', rejection_reason = p_reason, rejected_at = now()
   where id = p_claim_id;
  return 'rejected';
end;
$$;

-- 정산 지급 완료 (여러 소명서 일괄) -----------------------------------------------------
create or replace function public.mark_claims_paid(p_claim_ids uuid[])
returns integer
language plpgsql security definer
set search_path = ''
as $$
declare
  v_member public.members;
  v_requested integer;
  v_eligible integer;
begin
  v_member := private.require_member();
  if v_member.role not in ('super_admin', 'admin') then
    raise exception 'NOT_ALLOWED' using errcode = '42501';
  end if;
  v_requested := coalesce(array_length(p_claim_ids, 1), 0);
  if v_requested = 0 then
    return 0;
  end if;

  perform 1 from public.expense_claims where id = any(p_claim_ids) for update;
  select count(*) into v_eligible from public.expense_claims
   where id = any(p_claim_ids) and company_id = v_member.company_id and status = 'approved';
  -- 한 건이라도 다른 회사이거나 정산 대기가 아니면 전체를 거부 (부분 처리 금지)
  if v_eligible <> (select count(distinct x) from unnest(p_claim_ids) x) then
    raise exception 'INVALID_CLAIMS';
  end if;

  update public.expense_claims set status = 'paid', paid_at = now(), paid_by_member_id = v_member.id
   where id = any(p_claim_ids) and company_id = v_member.company_id and status = 'approved';
  return v_eligible;
end;
$$;

-- 영수증 업로드 크레딧 차감 + 이벤트 추가 지급 (D-046, D-054) ----------------------------------
-- service_role 전용: 서버가 세션에서 확인한 멤버 id와 환경변수 이벤트 설정을 넘긴다.
create or replace function public.consume_receipt_credit(
  p_item_id uuid, p_member_id uuid, p_event_enabled boolean, p_event_amount integer
)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_item public.expense_items;
  v_claim public.expense_claims;
  v_company public.companies;
  v_bonus boolean := false;
begin
  select * into v_item from public.expense_items where id = p_item_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  select * into v_claim from public.expense_claims where id = v_item.claim_id;
  if v_claim.member_id <> p_member_id or v_claim.company_id <> v_item.company_id
     or not exists (select 1 from public.members m where m.id = p_member_id and m.company_id = v_item.company_id and m.status = 'approved') then
    raise exception 'NOT_FOUND';
  end if;
  if v_claim.status not in ('draft', 'rejected') then raise exception 'INVALID_STATUS'; end if;

  select * into v_company from public.companies where id = v_item.company_id for update;

  if v_item.credit_charged then
    return jsonb_build_object('charged', false, 'bonus_granted', false,
                              'remaining', v_company.receipt_credits_granted - v_company.receipt_credits_used);
  end if;

  -- 이미 0장인 상태(이벤트가 꺼져 있다가 켜진 경우 포함)
  if v_company.receipt_credits_granted - v_company.receipt_credits_used <= 0 then
    if p_event_enabled and coalesce(p_event_amount, 0) > 0 then
      update public.companies set receipt_credits_granted = receipt_credits_granted + p_event_amount, last_event_bonus_at = now()
       where id = v_company.id returning * into v_company;
      insert into public.credit_ledger (company_id, delta, reason) values (v_company.id, p_event_amount, 'event_bonus');
      v_bonus := true;
    else
      raise exception 'NO_CREDITS';
    end if;
  end if;

  update public.companies set receipt_credits_used = receipt_credits_used + 1
   where id = v_company.id returning * into v_company;
  insert into public.credit_ledger (company_id, delta, reason, item_id, member_id)
  values (v_company.id, -1, 'receipt_upload', p_item_id, p_member_id);
  update public.expense_items set credit_charged = true where id = p_item_id;

  -- 이번 차감으로 0장이 되면 즉시 이벤트 추가 지급
  if v_company.receipt_credits_granted - v_company.receipt_credits_used = 0
     and p_event_enabled and coalesce(p_event_amount, 0) > 0 then
    update public.companies set receipt_credits_granted = receipt_credits_granted + p_event_amount, last_event_bonus_at = now()
     where id = v_company.id returning * into v_company;
    insert into public.credit_ledger (company_id, delta, reason) values (v_company.id, p_event_amount, 'event_bonus');
    v_bonus := true;
  end if;

  return jsonb_build_object('charged', true, 'bonus_granted', v_bonus,
                            'remaining', v_company.receipt_credits_granted - v_company.receipt_credits_used);
end;
$$;

-- 실행 권한 -----------------------------------------------------------------------
revoke all on function private.require_member(), private.claim_settlement(uuid),
  private.lock_pending_step(public.expense_claims, public.members) from public, anon, authenticated;
revoke all on function public.submit_claim(uuid), public.approve_claim(uuid, text),
  public.reject_claim(uuid, text, uuid[]), public.mark_claims_paid(uuid[]),
  public.consume_receipt_credit(uuid, uuid, boolean, integer) from public, anon;
grant execute on function public.submit_claim(uuid), public.approve_claim(uuid, text),
  public.reject_claim(uuid, text, uuid[]), public.mark_claims_paid(uuid[]) to authenticated;
revoke execute on function public.consume_receipt_credit(uuid, uuid, boolean, integer) from authenticated;
grant execute on function public.consume_receipt_credit(uuid, uuid, boolean, integer) to service_role;
