-- =============================================================================
-- 033_submit_flow.sql — 상신 검증·금액 재계산·계정과목 스냅샷 (T9-1, expense-lifecycle.md §2·§5·§7)
-- - private.claim_problems: 상신 전에 빠진 칸을 소명서(헤더)·항목별로 모두 돌려준다(화면이 강조·이동에 쓴다)
-- - public.check_claim_for_submit: 본인 작성 중 소명서만
-- - submit_claim(004) 보강: 문제가 있으면 CLAIM_INCOMPLETE, 금액을 서버에서 다시 계산, 계정과목 스냅샷(관리자 조정 항목 유지)
-- - refresh_claim_totals(027)는 같은 계산(private.recompute_claim)을 쓴다
-- =============================================================================

-- 항목 금액·소명서 합계 다시 계산 (권한 확인은 부르는 쪽에서)
create or replace function private.recompute_claim(p_claim_id uuid)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_claim public.expense_claims;
  v_company public.companies;
  v_override integer;
  r record;
  a record;
  v_result jsonb;
begin
  select * into v_claim from public.expense_claims where id = p_claim_id;
  select * into v_company from public.companies where id = v_claim.company_id;
  select meal_limit_override into v_override from public.members where id = v_claim.member_id;
  for r in select id, category, trip_type, amount, headcount from public.expense_items where claim_id = v_claim.id loop
    select * into a from private.item_amounts(r.category, r.trip_type, r.amount, r.headcount, v_company, v_override);
    update public.expense_items
       set company_supported_amount = a.supported,
           personal_burden_amount = a.burden,
           applied_meal_limit_per_person = a.applied_limit,
           applied_meal_limit_mode = a.applied_mode,
           updated_at = now()
     where id = r.id;
  end loop;
  update public.expense_claims c
     set item_count = s.n,
         total_amount = s.total,
         total_company_supported = s.supported,
         total_personal_burden = s.burden,
         updated_at = now()
    from (
      select count(*)::integer n, coalesce(sum(amount), 0)::integer total,
             coalesce(sum(company_supported_amount), 0)::integer supported, coalesce(sum(personal_burden_amount), 0)::integer burden
      from public.expense_items where claim_id = v_claim.id
    ) s
   where c.id = v_claim.id
  returning jsonb_build_object('item_count', c.item_count, 'total_amount', c.total_amount,
                               'total_company_supported', c.total_company_supported, 'total_personal_burden', c.total_personal_burden)
    into v_result;
  return v_result;
end;
$$;

create or replace function public.refresh_claim_totals(p_claim_id uuid)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
begin
  perform private.lock_my_editable_claim(p_claim_id);
  return private.recompute_claim(p_claim_id);
end;
$$;

-- 상신 검증 (expense-lifecycle.md §2). 반환: {"header": [코드...], "items": [{"item_id", "sort_order", "fields": [코드...]}]}
create or replace function private.claim_problems(p_claim_id uuid)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_claim public.expense_claims;
  v_header text[] := '{}';
  v_count integer;
  v_has_cards boolean;
  v_items jsonb;
begin
  select * into v_claim from public.expense_claims where id = p_claim_id;
  if length(btrim(coalesce(v_claim.title, ''))) = 0 then v_header := array_append(v_header, 'title'); end if;
  if length(btrim(coalesce(v_claim.description, ''))) = 0 then v_header := array_append(v_header, 'description'); end if;
  if v_claim.is_business_trip then
    if length(btrim(coalesce(v_claim.trip_destination, ''))) = 0 then v_header := array_append(v_header, 'trip_destination'); end if;
    if v_claim.trip_start_date is null or v_claim.trip_end_date is null then v_header := array_append(v_header, 'trip_period');
    elsif v_claim.trip_end_date < v_claim.trip_start_date then v_header := array_append(v_header, 'trip_period_order'); end if;
    if length(btrim(coalesce(v_claim.trip_purpose, ''))) = 0 then v_header := array_append(v_header, 'trip_purpose'); end if;
  end if;
  select count(*) into v_count from public.expense_items where claim_id = p_claim_id;
  if v_count = 0 then v_header := array_append(v_header, 'no_items'); end if;
  if v_count > 30 then v_header := array_append(v_header, 'too_many_items'); end if;
  select exists (select 1 from public.corporate_cards where company_id = v_claim.company_id and is_active) into v_has_cards;

  select coalesce(jsonb_agg(jsonb_build_object('item_id', id, 'sort_order', sort_order, 'fields', to_jsonb(f)) order by sort_order), '[]'::jsonb)
    into v_items
    from (
      select i.id, i.sort_order, array_remove(array[
        case when i.parse_status = 'parsing' then 'parsing' end,
        case when i.category is null then 'category' end,
        case when i.payment_method = 'corporate_card' and v_has_cards and i.corporate_card_id is null then 'corporate_card' end,
        case when i.evidence_type is null then 'evidence_type' end,
        case when i.expense_date is null then 'expense_date' end,
        case when i.amount is null or i.amount <= 0 then 'amount' end,
        -- 영수증이 필요한 분류 (자차 유류비만 영수증 선택)
        case when i.receipt_path is null and not (i.category = 'trip' and i.trip_type = 'own_car') then 'receipt' end,
        case when (i.category = 'meal' or (i.category = 'trip' and i.trip_type = 'meal')) and coalesce(i.headcount, 1) < 1 then 'headcount' end, -- 비어 있으면 기본 1명(금액 계산과 같음)
        case when i.category = 'meeting' and length(btrim(coalesce(i.purpose, ''))) = 0 then 'purpose' end,
        case when i.category = 'purchase' and i.purchase_type is null then 'purchase_type' end,
        case when i.category = 'purchase' and length(btrim(coalesce(i.purpose, ''))) = 0 then 'purpose' end,
        case when i.category = 'trip' and i.trip_type is null then 'trip_type' end,
        case when i.category = 'trip' and i.trip_type = 'lodging' and (i.trip_start_date is null or i.trip_end_date is null) then 'lodging_period' end,
        case when i.category = 'trip' and i.trip_type = 'other' and length(btrim(coalesce(i.purpose, ''))) = 0 then 'purpose' end,
        case when i.category = 'trip' and i.trip_type = 'own_car' and (i.start_location is null or i.end_location is null or coalesce(i.distance_km, 0) <= 0) then 'own_car_route' end
      ], null) as f
      from public.expense_items i
      where i.claim_id = p_claim_id
    ) x
   where cardinality(f) > 0;
  return jsonb_build_object('header', to_jsonb(v_header), 'items', v_items);
end;
$$;

create or replace function public.check_claim_for_submit(p_claim_id uuid)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare v_member public.members := private.require_member();
begin
  if not exists (select 1 from public.expense_claims where id = p_claim_id and company_id = v_member.company_id and member_id = v_member.id) then
    raise exception 'NOT_FOUND' using errcode = '42501';
  end if;
  return private.claim_problems(p_claim_id);
end;
$$;

-- 상신 (004 정의 + 검증·재계산·계정과목 스냅샷)
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
  v_payout integer;
  v_payback integer;
  v_problems jsonb;
begin
  v_member := private.require_member();

  select * into v_claim from public.expense_claims where id = p_claim_id for update;
  if not found or v_claim.company_id <> v_member.company_id or v_claim.member_id <> v_member.id then
    raise exception 'NOT_FOUND' using errcode = '42501';
  end if;
  if v_claim.status not in ('draft', 'rejected') then
    raise exception 'INVALID_STATUS';
  end if;

  v_problems := private.claim_problems(p_claim_id);
  if jsonb_array_length(v_problems->'header') > 0 or jsonb_array_length(v_problems->'items') > 0 then
    raise exception 'CLAIM_INCOMPLETE' using detail = v_problems::text;
  end if;

  -- 금액을 서버에서 다시 계산해 확정 (§5)
  perform private.recompute_claim(p_claim_id);

  -- 계정과목 스냅샷 (§7): 관리자가 바꾼 항목은 그대로, 매핑이 없으면 비움
  update public.expense_items i
     set (account_title_id, account_title_name, account_title_code) = (
       select t.id, t.name, t.code
         from public.account_title_mappings m
         join public.account_titles t on t.id = m.account_title_id and t.company_id = m.company_id
        where m.company_id = i.company_id and m.category = i.category
          and m.trip_type is not distinct from i.trip_type and m.purchase_type is not distinct from i.purchase_type
     )
   where i.claim_id = p_claim_id and not i.account_title_overridden;

  v_round := v_claim.current_round + 1;

  -- 결재라인 선택: 부서별 → 회사 기본 (D-039)
  select id into v_line_id from public.approval_lines
   where company_id = v_member.company_id and department_id = v_member.department_id;
  if v_line_id is null then
    select id into v_line_id from public.approval_lines
     where company_id = v_member.company_id and department_id is null;
  end if;

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

revoke all on function private.recompute_claim(uuid), private.claim_problems(uuid) from public, anon, authenticated;
revoke all on function public.check_claim_for_submit(uuid) from public, anon;
grant execute on function public.check_claim_for_submit(uuid) to authenticated;
