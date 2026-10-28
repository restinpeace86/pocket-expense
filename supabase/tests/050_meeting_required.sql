-- =============================================================================
-- 050_meeting_required.sql — 외부 미팅비 결의서: 목적·거래처·참석자 모두 필수 (D-153, migration 080)
-- =============================================================================
begin;

insert into auth.users (id, instance_id, aud, role, email)
values ('a5000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'u50@test.local');
insert into public.companies (id, name, invite_code, business_number) values ('c5000000-0000-0000-0000-00000000000a', '미팅회사', 'MTNGAAAA', '1000000501');
insert into public.members (id, auth_user_id, company_id, name, phone, role, status, privacy_agreed_at) values
  ('a5010000-0000-0000-0000-000000000001', 'a5000000-0000-0000-0000-000000000001', 'c5000000-0000-0000-0000-00000000000a', '직원', '01095001001', 'employee', 'approved', now());
insert into public.expense_claims (id, company_id, member_id, title, description, category, meeting_purpose) values
  ('a5020000-0000-0000-0000-000000000001', 'c5000000-0000-0000-0000-00000000000a', 'a5010000-0000-0000-0000-000000000001', '거래처 미팅', '계약 협의', 'meeting', 'A사 계약 협의');

do $$
declare h jsonb;
begin
  h := private.claim_problems('a5020000-0000-0000-0000-000000000001')->'header';
  if not (h ? 'client_name') or not (h ? 'attendees') then raise exception 'FAIL [need client & attendees] %', h; end if;
  if h ? 'meeting_purpose' then raise exception 'FAIL [purpose filled]'; end if;
  update public.expense_claims set client_name = '(주)에이', attendees = '  ' where id = 'a5020000-0000-0000-0000-000000000001';
  h := private.claim_problems('a5020000-0000-0000-0000-000000000001')->'header';
  if h ? 'client_name' or not (h ? 'attendees') then raise exception 'FAIL [blank attendees] %', h; end if;
  update public.expense_claims set attendees = 'A사 김부장, 박과장' where id = 'a5020000-0000-0000-0000-000000000001';
  h := private.claim_problems('a5020000-0000-0000-0000-000000000001')->'header';
  if h ? 'client_name' or h ? 'attendees' then raise exception 'FAIL [filled] %', h; end if;
  -- 다른 카테고리는 거래처·참석자를 묻지 않음
  update public.expense_claims set category = 'meal', client_name = null, attendees = null where id = 'a5020000-0000-0000-0000-000000000001';
  h := private.claim_problems('a5020000-0000-0000-0000-000000000001')->'header';
  if h ? 'client_name' or h ? 'attendees' then raise exception 'FAIL [meal not required] %', h; end if;
end;
$$;

select 'meeting_required ok';
rollback;
