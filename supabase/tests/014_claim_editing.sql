-- =============================================================================
-- 014_claim_editing.sql — 소명서 편집 화면(E-02)이 쓰는 직접 쓰기의 권한·격리 테스트 (T6 묶음 A)
-- 화면 서버 액션은 사용자 세션으로 expense_claims·expense_items를 직접 고친다(열 권한 + RLS).
-- 회사 A(직원 a_e1·a_e2), 회사 B(대표 b_sup, 법인카드 B). A에는 법인카드 A.
-- =============================================================================
begin;

create function public._t_fails(p_sql text, p_label text)
returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    return;
  end;
  raise exception 'FAIL [%] expected an error but succeeded', p_label;
end;
$$;
create function public._t_rows(p_sql text) returns integer language plpgsql as $$
declare n integer;
begin
  execute p_sql;
  get diagnostics n = row_count;
  return n;
end;
$$;
grant execute on function public._t_fails(text, text), public._t_rows(text) to authenticated;

insert into auth.users (id, instance_id, aud, role, email)
select u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u::text || '@test.local'
from unnest(array['a1700000-0000-0000-0000-000000000002', 'a1700000-0000-0000-0000-000000000003', 'b1700000-0000-0000-0000-000000000001']::uuid[]) u;
insert into public.companies (id, name, invite_code, business_number) values
  ('c1700000-0000-0000-0000-00000000000a', '편집회사A', 'EDTAAAAA', '1000000171'),
  ('c1700000-0000-0000-0000-00000000000b', '편집회사B', 'EDTBBBBB', '1000000172');
insert into public.members (id, auth_user_id, company_id, name, phone, role, status, privacy_agreed_at, meal_limit_override) values
  ('a1800000-0000-0000-0000-000000000002', 'a1700000-0000-0000-0000-000000000002', 'c1700000-0000-0000-0000-00000000000a', 'A직원1', '01096101001', 'employee', 'approved', now(), 12000),
  ('a1800000-0000-0000-0000-000000000003', 'a1700000-0000-0000-0000-000000000003', 'c1700000-0000-0000-0000-00000000000a', 'A직원2', '01096101002', 'employee', 'approved', now(), null),
  ('b1800000-0000-0000-0000-000000000001', 'b1700000-0000-0000-0000-000000000001', 'c1700000-0000-0000-0000-00000000000b', 'B대표', '01097101000', 'super_admin', 'approved', now(), null);
insert into public.corporate_cards (id, company_id, nickname, last4) values
  ('a1900000-0000-0000-0000-000000000001', 'c1700000-0000-0000-0000-00000000000a', 'A 법인', '1234'),
  ('b1900000-0000-0000-0000-000000000001', 'c1700000-0000-0000-0000-00000000000b', 'B 법인', '5678');
insert into public.expense_claims (id, company_id, member_id, title, status) values
  ('a2000000-0000-0000-0000-000000000001', 'c1700000-0000-0000-0000-00000000000a', 'a1800000-0000-0000-0000-000000000002', '', 'draft'),
  ('a2000000-0000-0000-0000-000000000009', 'c1700000-0000-0000-0000-00000000000a', 'a1800000-0000-0000-0000-000000000002', '상신됨', 'draft');
update public.expense_claims set status = 'submitted' where id = 'a2000000-0000-0000-0000-000000000009';
-- 마감된 항목이 든 작성 중 소명서(삭제 금지 조건 확인용)
insert into public.expense_claims (id, company_id, member_id, title) values
  ('a2000000-0000-0000-0000-000000000002', 'c1700000-0000-0000-0000-00000000000a', 'a1800000-0000-0000-0000-000000000002', '마감 항목 포함');
insert into public.expense_items (claim_id, company_id, sort_order, payment_method, closed_month, closing_seq, closing_kind) values
  ('a2000000-0000-0000-0000-000000000002', 'c1700000-0000-0000-0000-00000000000a', 1, 'personal_card', '2026-09', 1, 'current');

-- ── A 직원1: 새 소명서 → 헤더 저장 → 영수증 없이 항목 → 항목 저장 ─────────────────────
select set_config('request.jwt.claims', '{"sub":"a1700000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
do $$
declare v_item uuid; v_claim uuid;
begin
  -- 화면(createDraftClaimAction)과 같이 id 없이 만든다(id는 열 권한이 없다). 이후 검사는 준비해 둔 0001 소명서로 한다.
  insert into public.expense_claims (company_id, member_id, title)
  values ('c1700000-0000-0000-0000-00000000000a', 'a1800000-0000-0000-0000-000000000002', '') returning id into v_claim;
  if v_claim is null then raise exception 'FAIL [A_E1] create draft'; end if;
  perform public._t_fails(format($q$insert into public.expense_claims (id, company_id, member_id, title) values (gen_random_uuid(), 'c1700000-0000-0000-0000-00000000000a', 'a1800000-0000-0000-0000-000000000002', '')$q$), 'A_E1 set id');
  -- 다른 사람 이름으로·다른 회사로는 만들 수 없다
  perform public._t_fails($q$insert into public.expense_claims (company_id, member_id, title) values ('c1700000-0000-0000-0000-00000000000a', 'a1800000-0000-0000-0000-000000000003', 'x')$q$, 'A_E1 claim as other member');
  perform public._t_fails($q$insert into public.expense_claims (company_id, member_id, title) values ('c1700000-0000-0000-0000-00000000000b', 'a1800000-0000-0000-0000-000000000002', 'x')$q$, 'A_E1 claim into B');
  -- 상태·합계는 직접 못 바꾼다
  perform public._t_fails($q$update public.expense_claims set status = 'approved' where id = 'a2000000-0000-0000-0000-000000000001'$q$, 'A_E1 status');
  perform public._t_fails($q$update public.expense_claims set total_amount = 1 where id = 'a2000000-0000-0000-0000-000000000001'$q$, 'A_E1 totals');

  -- 헤더 저장 (saveClaimHeaderAction이 쓰는 열)
  if public._t_rows($q$update public.expense_claims set title = '10/15 부산 출장', description = '지사 점검', default_payment_method = 'personal_card',
       is_business_trip = true, trip_destination = '부산', trip_start_date = '2026-10-15', trip_end_date = '2026-10-16', trip_purpose = '점검'
       where id = 'a2000000-0000-0000-0000-000000000001'$q$) <> 1 then
    raise exception 'FAIL [A_E1] header save';
  end if;

  -- 영수증 없이 항목 추가 (createManualItemAction)
  insert into public.expense_items (claim_id, company_id, sort_order, category, payment_method, headcount)
  values ('a2000000-0000-0000-0000-000000000001', 'c1700000-0000-0000-0000-00000000000a', 1, 'trip', 'personal_card', 1)
  returning id into v_item;
  perform set_config('t.item', v_item::text, true);

  -- 항목 저장 (saveItemAction이 쓰는 열)
  if public._t_rows(format($q$update public.expense_items set category = 'trip', trip_type = 'lodging', purchase_type = null, payment_method = 'corporate_card',
       corporate_card_id = 'a1900000-0000-0000-0000-000000000001', evidence_type = 'card_slip', expense_date = '2026-10-15', merchant_name = '부산호텔',
       merchant_business_number = '1234567890', amount = 90000, supply_amount = 81818, vat_amount = 8182, headcount = 1, purpose = null,
       client_name = null, attendees = null, trip_start_date = '2026-10-15', trip_end_date = '2026-10-16' where id = %L$q$, v_item)) <> 1 then
    raise exception 'FAIL [A_E1] item save';
  end if;
  -- 다른 회사 법인카드는 붙일 수 없다(복합 FK)
  perform public._t_fails(format($q$update public.expense_items set corporate_card_id = 'b1900000-0000-0000-0000-000000000001' where id = %L$q$, v_item), 'A_E1 B card');
  -- 계산값·크레딧·인식 결과·경로는 직접 못 바꾼다
  perform public._t_fails(format($q$update public.expense_items set company_supported_amount = 1 where id = %L$q$, v_item), 'A_E1 supported');
  perform public._t_fails(format($q$update public.expense_items set credit_charged = true where id = %L$q$, v_item), 'A_E1 credit');
  perform public._t_fails(format($q$update public.expense_items set receipt_path = 'c1700000-0000-0000-0000-00000000000b/x.jpg' where id = %L$q$, v_item), 'A_E1 path');
  perform public._t_fails(format($q$update public.expense_items set parse_status = 'success' where id = %L$q$, v_item), 'A_E1 parse_status');
  -- 세부 유형은 맞는 카테고리에서만
  perform public._t_fails(format($q$update public.expense_items set category = 'meal', trip_type = 'lodging' where id = %L$q$, v_item), 'A_E1 trip_type on meal');

  perform public.refresh_claim_totals('a2000000-0000-0000-0000-000000000001');
  if (select row(item_count, total_amount)::text from public.expense_claims where id = 'a2000000-0000-0000-0000-000000000001') <> row(1, 90000)::text then
    raise exception 'FAIL [A_E1] totals after save';
  end if;

  -- 편집 화면이 읽는 회사 정책·내 개인 한도·우리 회사 카드
  if (select meal_limit_override from public.members where id = 'a1800000-0000-0000-0000-000000000002') <> 12000 then raise exception 'FAIL [A_E1] own override'; end if;
  if (select count(*) from public.corporate_cards) <> 1 then raise exception 'FAIL [A_E1] sees other company cards'; end if;
  if (select count(*) from public.companies) <> 1 then raise exception 'FAIL [A_E1] sees other companies'; end if;

  -- 상신된 소명서는 고칠 수도, 항목을 넣을 수도, 지울 수도 없다
  if public._t_rows($q$update public.expense_claims set title = 'x' where id = 'a2000000-0000-0000-0000-000000000009'$q$) <> 0 then raise exception 'FAIL [A_E1] edit submitted'; end if;
  perform public._t_fails($q$insert into public.expense_items (claim_id, company_id, sort_order, payment_method) values ('a2000000-0000-0000-0000-000000000009', 'c1700000-0000-0000-0000-00000000000a', 1, 'personal_card')$q$, 'A_E1 item into submitted');
  if public._t_rows($q$delete from public.expense_claims where id = 'a2000000-0000-0000-0000-000000000009'$q$) <> 0 then raise exception 'FAIL [A_E1] delete submitted'; end if;
end;
$$;

-- ── A 직원2(같은 회사 다른 사람): 남의 소명서·항목은 안 보이고 못 고친다 ─────────────────
select set_config('request.jwt.claims', '{"sub":"a1700000-0000-0000-0000-000000000003","role":"authenticated"}', true);
do $$
begin
  if (select count(*) from public.expense_claims) <> 0 or (select count(*) from public.expense_items) <> 0 then raise exception 'FAIL [A_E2] sees other member claims'; end if;
  if public._t_rows($q$update public.expense_claims set title = 'x' where id = 'a2000000-0000-0000-0000-000000000001'$q$) <> 0 then raise exception 'FAIL [A_E2] edit other claim'; end if;
  if public._t_rows(format($q$update public.expense_items set amount = 1 where id = %L$q$, current_setting('t.item'))) <> 0 then raise exception 'FAIL [A_E2] edit other item'; end if;
  if public._t_rows(format($q$delete from public.expense_items where id = %L$q$, current_setting('t.item'))) <> 0 then raise exception 'FAIL [A_E2] delete other item'; end if;
  perform public._t_fails($q$insert into public.expense_items (claim_id, company_id, sort_order, payment_method) values ('a2000000-0000-0000-0000-000000000001', 'c1700000-0000-0000-0000-00000000000a', 2, 'personal_card')$q$, 'A_E2 item into other claim');
  perform public._t_fails($q$select public.refresh_claim_totals('a2000000-0000-0000-0000-000000000001')$q$, 'A_E2 refresh other');
end;
$$;

-- ── B 대표(다른 회사 최고 관리자): 아무것도 안 보이고 못 고친다 ─────────────────────────
select set_config('request.jwt.claims', '{"sub":"b1700000-0000-0000-0000-000000000001","role":"authenticated"}', true);
do $$
begin
  if (select count(*) from public.expense_claims) <> 0 or (select count(*) from public.expense_items) <> 0 then raise exception 'FAIL [B_SUP] sees A claims'; end if;
  if public._t_rows($q$delete from public.expense_claims where id = 'a2000000-0000-0000-0000-000000000001'$q$) <> 0 then raise exception 'FAIL [B_SUP] delete A claim'; end if;
  perform public._t_fails($q$insert into public.expense_items (claim_id, company_id, sort_order, payment_method) values ('a2000000-0000-0000-0000-000000000001', 'c1700000-0000-0000-0000-00000000000b', 1, 'personal_card')$q$, 'B_SUP item into A claim (B company id)');
  perform public._t_fails($q$insert into public.expense_items (claim_id, company_id, sort_order, payment_method) values ('a2000000-0000-0000-0000-000000000001', 'c1700000-0000-0000-0000-00000000000a', 1, 'personal_card')$q$, 'B_SUP item into A claim (A company id)');
end;
$$;

-- ── A 직원1: 작성 중 소명서 삭제 → 항목도 함께 ──────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"a1700000-0000-0000-0000-000000000002","role":"authenticated"}', true);
do $$
begin
  if public._t_rows($q$delete from public.expense_claims where id = 'a2000000-0000-0000-0000-000000000002'$q$) <> 0 then raise exception 'FAIL [A_E1] deleted claim with closed items'; end if;
  if public._t_rows($q$delete from public.expense_claims where id = 'a2000000-0000-0000-0000-000000000001'$q$) <> 1 then raise exception 'FAIL [A_E1] delete draft'; end if;
  if (select count(*) from public.expense_items where claim_id = 'a2000000-0000-0000-0000-000000000001') <> 0 then raise exception 'FAIL [A_E1] items not cascaded'; end if;
end;
$$;

reset role;
select 'CLAIM_EDITING_OK' as result;
rollback;
