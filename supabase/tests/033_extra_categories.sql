-- =============================================================================
-- 033_extra_categories.sql — 추가 카테고리 기본 계정과목·전액 지원 (todo_improvement(2차) 9, D-102, migration 050·051)
-- =============================================================================
begin;

insert into auth.users (id, instance_id, aud, role, email)
select u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u::text || '@test.local'
from unnest(array['a3300000-0000-0000-0000-000000000001']::uuid[]) u;
insert into public.companies (id, name, invite_code, business_number, meal_limit_per_person, meal_limit_mode) values
  ('c3300000-0000-0000-0000-00000000000a', '추가카테고리', 'XCATAAAA', '1000000331', 10000, 'split');
insert into public.members (id, auth_user_id, company_id, name, phone, role, status, privacy_agreed_at) values
  ('a3310000-0000-0000-0000-000000000001', 'a3300000-0000-0000-0000-000000000001', 'c3300000-0000-0000-0000-00000000000a', '직원', '01093301001', 'employee', 'approved', now());
-- 관리자가 이미 '도서인쇄비'를 만들어 둔 회사: 새로 만들지 않고 그것을 쓴다(업무용 도서). 세미나·교육은 교육훈련비(D-107)
insert into public.account_titles (company_id, name, sort_order) values ('c3300000-0000-0000-0000-00000000000a', '도서인쇄비', 9);
select private.seed_account_defaults('c3300000-0000-0000-0000-00000000000a');
select private.seed_account_defaults('c3300000-0000-0000-0000-00000000000a'); -- 두 번 해도 그대로

do $$
declare r record; v_expect jsonb := '{"team_dinner":"복리후생비","condolence:external":"기업업무추진비","condolence:internal":"복리후생비","seminar":"교육훈련비","books":"도서인쇄비","training":"교육훈련비","company_car":"차량유지비","saas":"지급수수료","meal":"복리후생비","meeting":"기업업무추진비"}';
begin
  for r in select m.category::text || coalesce(':' || m.condolence_target, '') as c, t.name from public.account_title_mappings m join public.account_titles t on t.id = m.account_title_id
            where m.company_id = 'c3300000-0000-0000-0000-00000000000a' and m.trip_type is null and m.purchase_type is null loop
    if v_expect->>r.c is distinct from r.name then raise exception 'FAIL [mapping] % → %', r.c, r.name; end if;
  end loop;
  if (select count(*) from public.account_title_mappings where company_id = 'c3300000-0000-0000-0000-00000000000a' and trip_type is null and purchase_type is null) <> 10 then raise exception 'FAIL [mapping count]'; end if; -- 경조사비는 내부·외부 2줄(D-123)
  if (select count(*) from public.account_titles where company_id = 'c3300000-0000-0000-0000-00000000000a' and name = '도서인쇄비') <> 1 then raise exception 'FAIL [dup title]'; end if;
end;
$$;

insert into public.expense_claims (id, company_id, member_id, title, description) values
  ('a3320000-0000-0000-0000-000000000001', 'c3300000-0000-0000-0000-00000000000a', 'a3310000-0000-0000-0000-000000000001', '회식', '팀 회식');
insert into public.expense_items (claim_id, company_id, sort_order, category, payment_method, evidence_type, expense_date, amount, headcount, merchant_name, receipt_path) values
  ('a3320000-0000-0000-0000-000000000001', 'c3300000-0000-0000-0000-00000000000a', 1, 'meal', 'personal_card', 'card_slip', '2026-10-14', 250000, 5, '고깃집', 'c3300000-0000-0000-0000-00000000000a/r/1.jpg');

select set_config('request.jwt.claims', '{"sub":"a3300000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
do $$
declare r record;
begin
  -- 회식비: 식대 한도(1인 1만 원) 없이 전액 지원
  perform public.set_claim_category('a3320000-0000-0000-0000-000000000001', 'team_dinner');
  select * into r from public.expense_items where claim_id = 'a3320000-0000-0000-0000-000000000001';
  if row(r.category, r.company_supported_amount, r.personal_burden_amount)::text <> row('team_dinner'::public.expense_category, 250000, 0)::text then
    raise exception 'FAIL [team_dinner full] %', row(r.category, r.company_supported_amount, r.personal_burden_amount);
  end if;
  if jsonb_array_length(public.check_claim_for_submit('a3320000-0000-0000-0000-000000000001')->'header') <> 0
     or jsonb_array_length(public.check_claim_for_submit('a3320000-0000-0000-0000-000000000001')->'items') <> 0 then
    raise exception 'FAIL [no extra required fields] %', public.check_claim_for_submit('a3320000-0000-0000-0000-000000000001');
  end if;
  -- 식대로 바꾸면 다시 한도 적용(5명 × 1만 = 5만 원)
  perform public.set_claim_category('a3320000-0000-0000-0000-000000000001', 'meal');
  if (select company_supported_amount from public.expense_items where claim_id = 'a3320000-0000-0000-0000-000000000001') <> 50000 then raise exception 'FAIL [meal limit back]'; end if;
  perform public.set_claim_category('a3320000-0000-0000-0000-000000000001', 'saas');
  if (select row(category, company_supported_amount)::text from public.expense_items where claim_id = 'a3320000-0000-0000-0000-000000000001') <> row('saas'::public.expense_category, 250000)::text then raise exception 'FAIL [saas]'; end if;
end;
$$;
reset role;

select 'EXTRA_CATEGORIES_OK' as result;
rollback;
