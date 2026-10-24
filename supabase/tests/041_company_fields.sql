-- =============================================================================
-- 041_company_fields.sql — 회사 추가 항목(직원 작성 · 필수) 상신 확인 (D-120, migration 061)
-- =============================================================================
begin;

insert into auth.users (id, instance_id, aud, role, email)
select u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u::text || '@test.local'
from unnest(array['a4100000-0000-0000-0000-000000000001', 'a4100000-0000-0000-0000-000000000002']::uuid[]) u;
insert into public.companies (id, name, invite_code, business_number) values
  ('c4100000-0000-0000-0000-00000000000a', '추가항목회사', 'CSTMFLDA', '1000000411'),
  ('c4100000-0000-0000-0000-00000000000b', '다른회사', 'CSTMFLDB', '1000000412');
insert into public.members (id, auth_user_id, company_id, name, phone, role, status, privacy_agreed_at) values
  ('a4110000-0000-0000-0000-000000000001', 'a4100000-0000-0000-0000-000000000001', 'c4100000-0000-0000-0000-00000000000a', '직원', '01094101001', 'employee', 'approved', now()),
  ('a4110000-0000-0000-0000-000000000002', 'a4100000-0000-0000-0000-000000000002', 'c4100000-0000-0000-0000-00000000000b', '남의직원', '01094101002', 'employee', 'approved', now());
insert into public.expense_claims (id, company_id, member_id, title, description) values
  ('a4120000-0000-0000-0000-000000000001', 'c4100000-0000-0000-0000-00000000000a', 'a4110000-0000-0000-0000-000000000001', '결의서', '사유'),
  ('a4120000-0000-0000-0000-000000000002', 'c4100000-0000-0000-0000-00000000000b', 'a4110000-0000-0000-0000-000000000002', '결의서', '사유');
-- 양식회사: 필수 '프로젝트'(직원 작성), 선택 '예산'(직원 작성), 고정값·안 정한 칸은 묻지 않음
insert into public.form_templates (company_id, version, is_active, schema) values ('c4100000-0000-0000-0000-00000000000a', 1, true, '{
  "v": 1, "columns": [{"key": "item.amount", "label": "금액"}],
  "header": [{"key": "custom.proj0001", "label": "프로젝트", "mode": "input", "required": true},
             {"key": "custom.bdgt0001", "label": "예산", "mode": "input", "required": false},
             {"key": "custom.keep0001", "label": "보존기간", "mode": "fixed", "value": "5년"}],
  "footer": [{"key": "custom.pend0001", "label": "미정", "mode": "input", "required": true, "pending": true}]}');

do $$
declare h jsonb;
begin
  h := private.claim_problems('a4120000-0000-0000-0000-000000000001') -> 'header';
  if not h ? 'custom:프로젝트' then raise exception 'FAIL [required missing] %', h; end if;
  if h ? 'custom:예산' or h ? 'custom:보존기간' or h ? 'custom:미정' then raise exception 'FAIL [only required input] %', h; end if;
  -- 다른 회사 결의서는 이 양식의 영향을 받지 않는다
  h := private.claim_problems('a4120000-0000-0000-0000-000000000002') -> 'header';
  if exists (select 1 from jsonb_array_elements_text(h) x where x like 'custom:%') then raise exception 'FAIL [isolation] %', h; end if;
end;
$$;

-- 직원이 값을 쓰면 통과, 너무 큰 값·배열은 거절
select set_config('request.jwt.claims', '{"sub":"a4100000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
update public.expense_claims set header_custom_payload = '{"custom.proj0001": "A프로젝트"}' where id = 'a4120000-0000-0000-0000-000000000001';
do $$
begin
  begin
    update public.expense_claims set header_custom_payload = jsonb_build_object('custom.proj0001', repeat('가', 5000)) where id = 'a4120000-0000-0000-0000-000000000001';
    raise exception 'FAIL [size] accepted';
  exception when check_violation then null;
  end;
  begin
    update public.expense_claims set header_custom_payload = '[]' where id = 'a4120000-0000-0000-0000-000000000001';
    raise exception 'FAIL [shape] accepted';
  exception when check_violation then null;
  end;
  -- 남의 회사 결의서는 못 바꾼다(RLS: 0행)
  update public.expense_claims set header_custom_payload = '{"x": "y"}' where id = 'a4120000-0000-0000-0000-000000000002';
end;
$$;
reset role;
do $$
declare h jsonb;
begin
  h := private.claim_problems('a4120000-0000-0000-0000-000000000001') -> 'header';
  if h ? 'custom:프로젝트' then raise exception 'FAIL [filled still required] %', h; end if;
  if (select header_custom_payload from public.expense_claims where id = 'a4120000-0000-0000-0000-000000000002') <> '{}'::jsonb then raise exception 'FAIL [isolation write]'; end if;
end;
$$;

select 'COMPANY_FIELDS_OK' as result;
rollback;
