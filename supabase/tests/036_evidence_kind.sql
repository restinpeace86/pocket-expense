-- =============================================================================
-- 036_evidence_kind.sql — 영수증 대신 증빙 공통 틀 (D-108, migration 055)
-- =============================================================================
begin;

create function public._t_raises(p_sql text, p_code text, p_label text)
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
grant execute on function public._t_raises(text, text, text) to authenticated;

insert into auth.users (id, instance_id, aud, role, email)
select u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u::text || '@test.local'
from unnest(array['a3600000-0000-0000-0000-000000000001', 'a3600000-0000-0000-0000-000000000002', 'b3600000-0000-0000-0000-000000000001']::uuid[]) u;
insert into public.companies (id, name, invite_code, business_number) values
  ('c3600000-0000-0000-0000-00000000000a', '증빙틀A', 'EVKDAAAA', '1000000361'),
  ('c3600000-0000-0000-0000-00000000000b', '증빙틀B', 'EVKDBBBB', '1000000362');
insert into public.members (id, auth_user_id, company_id, name, phone, role, status, privacy_agreed_at) values
  ('a3610000-0000-0000-0000-000000000001', 'a3600000-0000-0000-0000-000000000001', 'c3600000-0000-0000-0000-00000000000a', 'A직원1', '01093601001', 'employee', 'approved', now()),
  ('a3610000-0000-0000-0000-000000000002', 'a3600000-0000-0000-0000-000000000002', 'c3600000-0000-0000-0000-00000000000a', 'A직원2', '01093601002', 'employee', 'approved', now()),
  ('b3610000-0000-0000-0000-000000000001', 'b3600000-0000-0000-0000-000000000001', 'c3600000-0000-0000-0000-00000000000b', 'B직원', '01093602001', 'employee', 'approved', now());
insert into public.expense_claims (id, company_id, member_id, title, description, category) values
  ('a3620000-0000-0000-0000-000000000001', 'c3600000-0000-0000-0000-00000000000a', 'a3610000-0000-0000-0000-000000000001', '증빙 테스트', '사유', 'meal');

-- 사진이 있으면 AI가 본 종류(앱 이용 내역), 없으면 영수증
insert into public.expense_items (id, claim_id, company_id, sort_order, category, payment_method, evidence_type, expense_date, amount, headcount, merchant_name, receipt_path, parse_status, ai_parsed_payload) values
  ('a3630000-0000-0000-0000-000000000001', 'a3620000-0000-0000-0000-000000000001', 'c3600000-0000-0000-0000-00000000000a', 1, 'meal', 'personal_card', 'card_slip', '2026-10-14', 9000, 1, '가게', 'c3600000-0000-0000-0000-00000000000a/a3610000-0000-0000-0000-000000000001/a3620000-0000-0000-0000-000000000001/1.jpg', 'success', '{"suggested_evidence_kind":"app_history"}'),
  ('a3630000-0000-0000-0000-000000000002', 'a3620000-0000-0000-0000-000000000001', 'c3600000-0000-0000-0000-00000000000a', 2, 'meal', 'personal_card', 'card_slip', '2026-10-14', 9000, 1, '가게2', 'c3600000-0000-0000-0000-00000000000a/a3610000-0000-0000-0000-000000000001/a3620000-0000-0000-0000-000000000001/2.jpg', 'success', '{}'),
  ('a3630000-0000-0000-0000-000000000003', 'a3620000-0000-0000-0000-000000000001', 'c3600000-0000-0000-0000-00000000000a', 3, 'meal', 'personal_card', null, '2026-10-14', 50000, 1, '축의금', null, 'none', null);
do $$
begin
  if (select evidence_kind from public.expense_items where id = 'a3630000-0000-0000-0000-000000000001') <> 'app_history' then raise exception 'FAIL [ai kind]'; end if;
  if (select evidence_kind from public.expense_items where id = 'a3630000-0000-0000-0000-000000000002') <> 'receipt' then raise exception 'FAIL [default receipt]'; end if;
  if (select evidence_kind from public.expense_items where id = 'a3630000-0000-0000-0000-000000000003') is not null then raise exception 'FAIL [no file no kind]'; end if;
end;
$$;

select set_config('request.jwt.claims', '{"sub":"a3600000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
do $$
declare p jsonb; r jsonb;
begin
  -- 자료 없는 항목 → 증빙 자료를 묻는다
  p := public.check_claim_for_submit('a3620000-0000-0000-0000-000000000001');
  if not exists (select 1 from jsonb_array_elements(p->'items') e where e->>'item_id' = 'a3630000-0000-0000-0000-000000000003' and e->'fields' ? 'receipt') then raise exception 'FAIL [receipt asked] %', p; end if;
  -- 증빙 없음 + 짧은 사유 → 사유를 묻는다 / 증빙 구분은 기타로
  update public.expense_items set evidence_kind = 'none', no_evidence_reason = '없음' where id = 'a3630000-0000-0000-0000-000000000003';
  p := public.check_claim_for_submit('a3620000-0000-0000-0000-000000000001');
  if not exists (select 1 from jsonb_array_elements(p->'items') e where e->>'item_id' = 'a3630000-0000-0000-0000-000000000003' and e->'fields' ? 'no_evidence_reason' and not e->'fields' ? 'receipt') then raise exception 'FAIL [reason asked] %', p; end if;
  if (select evidence_type from public.expense_items where id = 'a3630000-0000-0000-0000-000000000003') <> 'other' then raise exception 'FAIL [evidence type other]'; end if;
  update public.expense_items set no_evidence_reason = '현금 축의금이라 받은 자료가 없음' where id = 'a3630000-0000-0000-0000-000000000003';
  if jsonb_array_length(public.check_claim_for_submit('a3620000-0000-0000-0000-000000000001')->'items') <> 0 then raise exception 'FAIL [reason ok] %', public.check_claim_for_submit('a3620000-0000-0000-0000-000000000001'); end if;

  -- 나중에 자료 붙이기 → 결의서 폴더 경로, 종류는 기타 자료(직원이 바꿈), 사유는 지움
  r := public.attach_item_evidence('a3630000-0000-0000-0000-000000000003');
  if r->>'receipt_path' <> 'c3600000-0000-0000-0000-00000000000a/a3610000-0000-0000-0000-000000000001/a3620000-0000-0000-0000-000000000001/a3630000-0000-0000-0000-000000000003_doc.jpg'
     or r->>'thumb_path' not like '%_doc_thumb.webp' then raise exception 'FAIL [attach path] %', r; end if;
  if (select row(evidence_kind, no_evidence_reason)::text from public.expense_items where id = 'a3630000-0000-0000-0000-000000000003') <> row('other'::public.evidence_kind, null::text)::text then raise exception 'FAIL [attach kind]'; end if;
  update public.expense_items set evidence_kind = 'invitation' where id = 'a3630000-0000-0000-0000-000000000003';
  -- 사진이 있는데 증빙 없음으로 바꾸면 기타 자료
  update public.expense_items set evidence_kind = 'none' where id = 'a3630000-0000-0000-0000-000000000002';
  if (select evidence_kind from public.expense_items where id = 'a3630000-0000-0000-0000-000000000002') <> 'other' then raise exception 'FAIL [none with file]'; end if;
  -- 떼기 → 다시 비움
  r := public.detach_item_evidence('a3630000-0000-0000-0000-000000000003');
  if (select receipt_path from public.expense_items where id = 'a3630000-0000-0000-0000-000000000003') is not null then raise exception 'FAIL [detach]'; end if;
end;
$$;
-- 이미 자료가 있으면 붙이기 불가, AI로 읽은 영수증은 떼기 불가
select public._t_raises($q$select public.attach_item_evidence('a3630000-0000-0000-0000-000000000001')$q$, 'ALREADY_HAS_EVIDENCE', 'A attach twice');
select public._t_raises($q$select public.detach_item_evidence('a3630000-0000-0000-0000-000000000001')$q$, 'NOT_ALLOWED', 'A detach parsed');
reset role;

-- 같은 회사 다른 직원·다른 회사는 못 붙인다
select set_config('request.jwt.claims', '{"sub":"a3600000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select public._t_raises($q$select public.attach_item_evidence('a3630000-0000-0000-0000-000000000003')$q$, '42501', 'A2 attach other');
reset role;
select set_config('request.jwt.claims', '{"sub":"b3600000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select public._t_raises($q$select public.attach_item_evidence('a3630000-0000-0000-0000-000000000003')$q$, '42501', 'B attach other company');
select public._t_raises($q$select public.detach_item_evidence('a3630000-0000-0000-0000-000000000003')$q$, '42501', 'B detach other company');
reset role;

select 'EVIDENCE_KIND_OK' as result;
rollback;
