-- =============================================================================
-- 025_tax_closing.sql — 세무 마감 잠금·해제·증빙 순번·전월 추가분·권한·격리 (migration 043)
-- 회사 A: 최고 관리자 sup, 관리자 adm, 직원 e1 / 회사 B: 관리자 b_adm
-- =============================================================================
begin;

create function public._t_raises25(p_sql text, p_code text, p_label text)
returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlerrm = p_code or sqlstate = p_code then return; end if;
    raise exception 'FAIL [%] expected % but got % (%)', p_label, p_code, sqlerrm, sqlstate;
  end;
  raise exception 'FAIL [%] expected % but succeeded', p_label, p_code;
end;
$$;
grant execute on function public._t_raises25(text, text, text) to authenticated;

insert into auth.users (id, instance_id, aud, role, email)
select u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u::text || '@test.local'
from unnest(array['a2500000-0000-0000-0000-000000000001', 'a2500000-0000-0000-0000-000000000002', 'a2500000-0000-0000-0000-000000000003', 'b2500000-0000-0000-0000-000000000001']::uuid[]) u;
insert into public.companies (id, name, invite_code, business_number) values
  ('c2500000-0000-0000-0000-00000000000a', '마감회사A', 'CLSDAAAA', '1000000251'),
  ('c2500000-0000-0000-0000-00000000000b', '마감회사B', 'CLSDBBBB', '1000000252');
insert into public.members (id, auth_user_id, company_id, name, phone, role, status, privacy_agreed_at) values
  ('a2510000-0000-0000-0000-000000000001', 'a2500000-0000-0000-0000-000000000001', 'c2500000-0000-0000-0000-00000000000a', '가대표', '01092501001', 'super_admin', 'approved', now()),
  ('a2510000-0000-0000-0000-000000000002', 'a2500000-0000-0000-0000-000000000002', 'c2500000-0000-0000-0000-00000000000a', '나관리', '01092501002', 'admin', 'approved', now()),
  ('a2510000-0000-0000-0000-000000000003', 'a2500000-0000-0000-0000-000000000003', 'c2500000-0000-0000-0000-00000000000a', '다직원', '01092501003', 'employee', 'approved', now()),
  ('b2510000-0000-0000-0000-000000000001', 'b2500000-0000-0000-0000-000000000001', 'c2500000-0000-0000-0000-00000000000b', 'B관리', '01092502001', 'super_admin', 'approved', now());
insert into public.expense_claims (id, company_id, member_id, title, status) values
  ('a2520000-0000-0000-0000-000000000001', 'c2500000-0000-0000-0000-00000000000a', 'a2510000-0000-0000-0000-000000000003', '9월 승인', 'approved'),
  ('a2520000-0000-0000-0000-000000000002', 'c2500000-0000-0000-0000-00000000000a', 'a2510000-0000-0000-0000-000000000003', '9월 결재중', 'submitted'),
  ('a2520000-0000-0000-0000-000000000003', 'c2500000-0000-0000-0000-00000000000a', 'a2510000-0000-0000-0000-000000000003', '8월 지급', 'paid'),
  ('a2520000-0000-0000-0000-000000000004', 'c2500000-0000-0000-0000-00000000000a', 'a2510000-0000-0000-0000-000000000003', '10월 승인', 'approved');
insert into public.expense_items (id, claim_id, company_id, sort_order, category, payment_method, expense_date, amount, headcount) values
  ('a2530000-0000-0000-0000-000000000001', 'a2520000-0000-0000-0000-000000000001', 'c2500000-0000-0000-0000-00000000000a', 2, 'meal', 'personal_card', '2026-09-20', 9000, 1),
  ('a2530000-0000-0000-0000-000000000002', 'a2520000-0000-0000-0000-000000000001', 'c2500000-0000-0000-0000-00000000000a', 1, 'meal', 'personal_card', '2026-09-10', 8000, 1),
  ('a2530000-0000-0000-0000-000000000003', 'a2520000-0000-0000-0000-000000000002', 'c2500000-0000-0000-0000-00000000000a', 1, 'meal', 'personal_card', '2026-09-15', 7000, 1),
  ('a2530000-0000-0000-0000-000000000004', 'a2520000-0000-0000-0000-000000000003', 'c2500000-0000-0000-0000-00000000000a', 1, 'meal', 'personal_card', '2026-08-30', 6000, 1),
  ('a2530000-0000-0000-0000-000000000005', 'a2520000-0000-0000-0000-000000000004', 'c2500000-0000-0000-0000-00000000000a', 1, 'meal', 'personal_card', '2026-10-05', 5000, 1);

-- ── 관리자: 9월 대상 = 승인된 9월 항목 2건(결재중 제외, 마감 안 된 8월은 추가분 아님), 사용일자 순 ─────
select set_config('request.jwt.claims', '{"sub":"a2500000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
do $$
declare r jsonb;
begin
  if (select string_agg(item_id::text || ':' || kind || ':' || seq || ':' || closed, ',' order by seq) from public.tax_month_items('2026-09'))
     <> 'a2530000-0000-0000-0000-000000000002:current:1:false,a2530000-0000-0000-0000-000000000001:current:2:false' then
    raise exception 'FAIL [ADM] sep pending %', (select string_agg(item_id::text || ':' || seq, ',') from public.tax_month_items('2026-09'));
  end if;
  r := public.close_tax_month('2026-09');
  if (r->>'count')::int <> 2 or (r->>'already')::boolean then raise exception 'FAIL [ADM] close %', r; end if;
  r := public.close_tax_month('2026-09');
  if not (r->>'already')::boolean or (r->>'count')::int <> 2 then raise exception 'FAIL [ADM] re-close %', r; end if;
  if (select string_agg(seq::text, ',' order by seq) from public.tax_month_items('2026-09') where closed) <> '1,2' then raise exception 'FAIL [ADM] closed list'; end if;
end;
$$;
select public._t_raises25($q$select public.close_tax_month('2099-01')$q$, 'INVALID_MONTH', 'ADM future month');
select public._t_raises25($q$select public.close_tax_month('2026-07')$q$, 'NOTHING_TO_CLOSE', 'ADM empty month');
select public._t_raises25($q$select public.reopen_tax_month('2026-09', '실수')$q$, 'NOT_ALLOWED', 'ADM reopen (not super)');
reset role;

-- 마감 뒤 9월 결재중 건이 승인됨 → 10월 패키지의 전월 추가분(당월 다음 순번)
update public.expense_claims set status = 'approved' where id = 'a2520000-0000-0000-0000-000000000002';

select set_config('request.jwt.claims', '{"sub":"a2500000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  if (select string_agg(item_id::text || ':' || kind || ':' || seq, ',' order by seq) from public.tax_month_items('2026-10'))
     <> 'a2530000-0000-0000-0000-000000000005:current:1,a2530000-0000-0000-0000-000000000003:carryover:2' then
    raise exception 'FAIL [ADM] oct with carryover %', (select string_agg(item_id::text || ':' || kind, ',') from public.tax_month_items('2026-10'));
  end if;
  perform public.close_tax_month('2026-10');
end;
$$;
reset role;
do $$
begin
  if (select closed_month || ':' || closing_kind || ':' || closing_seq from public.expense_items where id = 'a2530000-0000-0000-0000-000000000003') <> '2026-10:carryover:2' then
    raise exception 'FAIL carryover recorded';
  end if;
end;
$$;

-- ── 직원·다른 회사는 못 한다 / 다른 회사 항목은 안 보인다 ─────────────────────
select set_config('request.jwt.claims', '{"sub":"a2500000-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select public._t_raises25($q$select public.close_tax_month('2026-10')$q$, 'NOT_ALLOWED', 'E1 close');
select public._t_raises25($q$select * from public.tax_month_items('2026-10')$q$, 'NOT_ALLOWED', 'E1 list');
do $$
begin
  begin
    update public.expense_items set closed_month = null where id = 'a2530000-0000-0000-0000-000000000001';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;
select set_config('request.jwt.claims', '{"sub":"b2500000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  if exists (select 1 from public.tax_month_items('2026-09')) or exists (select 1 from public.tax_month_items('2026-10')) then raise exception 'FAIL [B] sees A items'; end if;
end;
$$;
select public._t_raises25($q$select public.reopen_tax_month('2026-09', '남의 회사')$q$, 'NOT_CLOSED', 'B reopen A month');
reset role;

-- ── 최고 관리자: 사유 없이 해제 불가, 해제하면 9월 항목 마감 기록 지움(10월 추가분은 그대로) ───────
select set_config('request.jwt.claims', '{"sub":"a2500000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select public._t_raises25($q$select public.reopen_tax_month('2026-09', '  ')$q$, 'INVALID_REOPEN_REASON', 'SUP empty reason');
do $$
begin
  perform public.reopen_tax_month('2026-09', '세무사 요청으로 계정과목 수정');
  if exists (select 1 from public.expense_items where closed_month = '2026-09') then raise exception 'FAIL [SUP] sep still closed'; end if;
  if (select closed_month from public.expense_items where id = 'a2530000-0000-0000-0000-000000000003') <> '2026-10' then raise exception 'FAIL [SUP] oct carryover lost'; end if;
  if (select status || ':' || reopen_reason from public.monthly_closings where year_month = '2026-09') <> 'reopened:세무사 요청으로 계정과목 수정' then raise exception 'FAIL [SUP] reopen row'; end if;
  -- 해제된 9월은 다시 대기 대상으로 집계된다
  if (select count(*) from public.tax_month_items('2026-09')) <> 2 then raise exception 'FAIL [SUP] sep pending again'; end if;
end;
$$;
reset role;

select 'TAX_CLOSING_OK' as result;
rollback;
