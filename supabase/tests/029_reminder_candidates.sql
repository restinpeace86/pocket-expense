-- =============================================================================
-- 029_reminder_candidates.sql — 독촉 대상: 작성중·반려(영수증 있음)만, 활성 멤버만, 오늘 받은 사람 표시, 관리자만, 회사 격리 (migration 047)
-- =============================================================================
begin;

insert into auth.users (id, instance_id, aud, role, email)
select u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u::text || '@test.local'
from unnest(array['a2900000-0000-0000-0000-000000000001', 'a2900000-0000-0000-0000-000000000002', 'a2900000-0000-0000-0000-000000000003', 'a2900000-0000-0000-0000-000000000004', 'b2900000-0000-0000-0000-000000000001']::uuid[]) u;
insert into public.companies (id, name, invite_code, business_number) values
  ('c2900000-0000-0000-0000-00000000000a', '독촉A', 'RMNDAAAA', '1000000291'),
  ('c2900000-0000-0000-0000-00000000000b', '독촉B', 'RMNDBBBB', '1000000292');
insert into public.members (id, auth_user_id, company_id, name, phone, role, status, privacy_agreed_at) values
  ('a2910000-0000-0000-0000-000000000001', 'a2900000-0000-0000-0000-000000000001', 'c2900000-0000-0000-0000-00000000000a', '대표', '01092901001', 'super_admin', 'approved', now()),
  ('a2910000-0000-0000-0000-000000000002', 'a2900000-0000-0000-0000-000000000002', 'c2900000-0000-0000-0000-00000000000a', '가직원', '01092901002', 'employee', 'approved', now()),
  ('a2910000-0000-0000-0000-000000000003', 'a2900000-0000-0000-0000-000000000003', 'c2900000-0000-0000-0000-00000000000a', '나직원', '01092901003', 'employee', 'approved', now()),
  ('a2910000-0000-0000-0000-000000000004', 'a2900000-0000-0000-0000-000000000004', 'c2900000-0000-0000-0000-00000000000a', '퇴사자', '01092901004', 'employee', 'inactive', now()),
  ('b2910000-0000-0000-0000-000000000001', 'b2900000-0000-0000-0000-000000000001', 'c2900000-0000-0000-0000-00000000000b', 'B대표', '01092902001', 'super_admin', 'approved', now());
insert into public.expense_claims (id, company_id, member_id, title, status) values
  ('a2920000-0000-0000-0000-000000000001', 'c2900000-0000-0000-0000-00000000000a', 'a2910000-0000-0000-0000-000000000002', '작성중1', 'draft'),
  ('a2920000-0000-0000-0000-000000000002', 'c2900000-0000-0000-0000-00000000000a', 'a2910000-0000-0000-0000-000000000002', '반려', 'rejected'),
  ('a2920000-0000-0000-0000-000000000003', 'c2900000-0000-0000-0000-00000000000a', 'a2910000-0000-0000-0000-000000000003', '빈 작성중', 'draft'),
  ('a2920000-0000-0000-0000-000000000004', 'c2900000-0000-0000-0000-00000000000a', 'a2910000-0000-0000-0000-000000000003', '상신됨', 'submitted'),
  ('a2920000-0000-0000-0000-000000000005', 'c2900000-0000-0000-0000-00000000000a', 'a2910000-0000-0000-0000-000000000004', '퇴사자 작성중', 'draft');
insert into public.expense_items (claim_id, company_id, sort_order, payment_method, headcount) values
  ('a2920000-0000-0000-0000-000000000001', 'c2900000-0000-0000-0000-00000000000a', 1, 'personal_card', 1),
  ('a2920000-0000-0000-0000-000000000002', 'c2900000-0000-0000-0000-00000000000a', 1, 'personal_card', 1),
  ('a2920000-0000-0000-0000-000000000004', 'c2900000-0000-0000-0000-00000000000a', 1, 'personal_card', 1),
  ('a2920000-0000-0000-0000-000000000005', 'c2900000-0000-0000-0000-00000000000a', 1, 'personal_card', 1);
-- 가직원은 오늘 이미 받음(성공), 실패 기록은 세지 않음
insert into public.notification_logs (company_id, recipient_member_id, recipient_phone, template_code, status, payload, provider) values
  ('c2900000-0000-0000-0000-00000000000a', 'a2910000-0000-0000-0000-000000000002', '01092901002', 'REMINDER', 'sent', '{}', 'log');

select set_config('request.jwt.claims', '{"sub":"a2900000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
do $$
declare got text;
begin
  select string_agg(name || ':' || open_claims || ':' || reminded_today || ':' || has_phone, ',') into got from public.reminder_candidates();
  -- 가직원(작성중 1 + 반려 1), 나직원은 빈 작성중·상신만이라 제외, 퇴사자 제외
  if got is distinct from '가직원:2:true:true' then raise exception 'FAIL candidates %', got; end if;
end;
$$;
reset role;

select set_config('request.jwt.claims', '{"sub":"a2900000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  begin
    perform * from public.reminder_candidates();
    raise exception 'FAIL employee';
  exception when others then if sqlerrm <> 'NOT_ALLOWED' then raise; end if;
  end;
end;
$$;
reset role;
select set_config('request.jwt.claims', '{"sub":"b2900000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
do $$ begin if exists (select 1 from public.reminder_candidates()) then raise exception 'FAIL [B] sees A'; end if; end; $$;
reset role;

select 'REMINDER_CANDIDATES_OK' as result;
rollback;
