-- =============================================================================
-- 001_tenant_isolation.sql — 회사 간 데이터 격리 테스트 (T1-6, 릴리스 차단 테스트)
-- 실행: npm run test:db   (트랜잭션 안에서 데이터를 만들고 마지막에 ROLLBACK → 흔적 없음)
-- 실패 시 'FAIL [...]' 메시지와 함께 오류로 끝난다.
-- 등장인물: 회사 A(최고 관리자 a_super, 직원 a_emp, 승인 대기 a_pend), 회사 B(b_super, b_emp), 외부인 outsider, 비로그인 anon
-- =============================================================================
begin;

-- ---------- 준비 (postgres) ----------
insert into auth.users (id, instance_id, aud, role, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a_super@test.local'),
  ('aaaaaaaa-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a_emp@test.local'),
  ('aaaaaaaa-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a_pend@test.local'),
  ('bbbbbbbb-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b_super@test.local'),
  ('bbbbbbbb-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b_emp@test.local'),
  ('cccccccc-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'outsider@test.local');

insert into public.companies (id, name, invite_code, business_number) values
  ('1a000000-0000-0000-0000-000000000000', '테스트회사A', 'AAAAAAAA', '1000000001'),
  ('1b000000-0000-0000-0000-000000000000', '테스트회사B', 'BBBBBBBB', '1000000002');
insert into public.departments (id, company_id, name) values
  ('da000000-0000-0000-0000-000000000000', '1a000000-0000-0000-0000-000000000000', '경영지원'),
  ('db000000-0000-0000-0000-000000000000', '1b000000-0000-0000-0000-000000000000', '경영지원');
insert into public.members (id, auth_user_id, company_id, name, phone, department_id, role, status, privacy_agreed_at) values
  ('2a000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', '1a000000-0000-0000-0000-000000000000', 'A대표', '01011110001', 'da000000-0000-0000-0000-000000000000', 'super_admin', 'approved', now()),
  ('2a000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002', '1a000000-0000-0000-0000-000000000000', 'A직원', '01011110002', 'da000000-0000-0000-0000-000000000000', 'employee', 'approved', now()),
  ('2a000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000003', '1a000000-0000-0000-0000-000000000000', 'A대기', '01011110003', 'da000000-0000-0000-0000-000000000000', 'employee', 'pending', now()),
  ('2b000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', '1b000000-0000-0000-0000-000000000000', 'B대표', '01022220001', 'db000000-0000-0000-0000-000000000000', 'super_admin', 'approved', now()),
  ('2b000000-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002', '1b000000-0000-0000-0000-000000000000', 'B직원', '01022220002', 'db000000-0000-0000-0000-000000000000', 'employee', 'approved', now());
insert into public.approval_lines (id, company_id, name) values
  ('3a000000-0000-0000-0000-000000000000', '1a000000-0000-0000-0000-000000000000', '기본 결재라인'),
  ('3b000000-0000-0000-0000-000000000000', '1b000000-0000-0000-0000-000000000000', '기본 결재라인');
insert into public.member_bank_accounts (member_id, company_id, bank_name, account_number, account_holder) values
  ('2a000000-0000-0000-0000-000000000002', '1a000000-0000-0000-0000-000000000000', '테스트은행', '111-111', 'A직원'),
  ('2b000000-0000-0000-0000-000000000002', '1b000000-0000-0000-0000-000000000000', '테스트은행', '222-222', 'B직원');
insert into public.corporate_cards (id, company_id, nickname, last4) values
  ('6a000000-0000-0000-0000-000000000000', '1a000000-0000-0000-0000-000000000000', 'A카드', '1111'),
  ('6b000000-0000-0000-0000-000000000000', '1b000000-0000-0000-0000-000000000000', 'B카드', '2222');
insert into public.expense_claims (id, company_id, member_id, title, description) values
  ('4a000000-0000-0000-0000-000000000001', '1a000000-0000-0000-0000-000000000000', '2a000000-0000-0000-0000-000000000002', 'A 소명서', 'A 테스트'),
  ('4b000000-0000-0000-0000-000000000001', '1b000000-0000-0000-0000-000000000000', '2b000000-0000-0000-0000-000000000002', 'B 소명서', 'B 테스트');
-- 상신 검증(033)을 통과하도록 증빙 구분·영수증 경로를 채워 둔다 (이 테스트의 목적은 격리)
insert into public.expense_items (id, claim_id, company_id, category, payment_method, evidence_type, amount, expense_date, receipt_path) values
  ('5a000000-0000-0000-0000-000000000001', '4a000000-0000-0000-0000-000000000001', '1a000000-0000-0000-0000-000000000000', 'meal', 'personal_card', 'card_slip', 10000, current_date,
   '1a000000-0000-0000-0000-000000000000/2a000000-0000-0000-0000-000000000002/4a000000-0000-0000-0000-000000000001/5a000000-0000-0000-0000-000000000001.jpg'),
  ('5a000000-0000-0000-0000-000000000002', '4a000000-0000-0000-0000-000000000001', '1a000000-0000-0000-0000-000000000000', 'meal', 'personal_card', 'card_slip', 5000, current_date,
   '1a000000-0000-0000-0000-000000000000/2a000000-0000-0000-0000-000000000002/4a000000-0000-0000-0000-000000000001/5a000000-0000-0000-0000-000000000002.jpg'),
  ('5b000000-0000-0000-0000-000000000001', '4b000000-0000-0000-0000-000000000001', '1b000000-0000-0000-0000-000000000000', 'meal', 'corporate_card', 'card_slip', 20000, current_date,
   '1b000000-0000-0000-0000-000000000000/2b000000-0000-0000-0000-000000000002/4b000000-0000-0000-0000-000000000001/5b000000-0000-0000-0000-000000000001.jpg');
insert into storage.objects (bucket_id, name) values
  ('receipts', '1a000000-0000-0000-0000-000000000000/2a000000-0000-0000-0000-000000000002/4a000000-0000-0000-0000-000000000001/5a000000-0000-0000-0000-000000000001.jpg'),
  ('receipts', '1b000000-0000-0000-0000-000000000000/2b000000-0000-0000-0000-000000000002/4b000000-0000-0000-0000-000000000001/5b000000-0000-0000-0000-000000000001.jpg');

-- ---------- DB 구조 수준 방어 (postgres) ----------
do $$
declare v_ok boolean;
begin
  -- 복합 외래키: B 회사 id로 A 소명서에 항목을 붙일 수 없다
  begin
    insert into public.expense_items (claim_id, company_id, amount) values ('4a000000-0000-0000-0000-000000000001', '1b000000-0000-0000-0000-000000000000', 1);
    v_ok := false;
  exception when foreign_key_violation then v_ok := true;
  end;
  if not v_ok then raise exception 'FAIL [FK] B company item attached to A claim'; end if;

  -- 복합 외래키: A 소명서에 B 법인카드를 연결할 수 없다
  begin
    update public.expense_items set corporate_card_id = '6b000000-0000-0000-0000-000000000000' where id = '5a000000-0000-0000-0000-000000000001';
    v_ok := false;
  exception when foreign_key_violation then v_ok := true;
  end;
  if not v_ok then raise exception 'FAIL [FK] A item linked to B corporate card'; end if;

  -- 영수증 경로는 자기 회사 폴더만
  begin
    update public.expense_items set receipt_path = '1b000000-0000-0000-0000-000000000000/x.jpg' where id = '5a000000-0000-0000-0000-000000000001';
    v_ok := false;
  exception when check_violation then v_ok := true;
  end;
  if not v_ok then raise exception 'FAIL [CHECK] A item receipt_path points to B folder'; end if;
end $$;

-- ---------- 크레딧 함수 (service_role 전용) ----------
set local role service_role;
do $$
declare v_ok boolean; r jsonb;
begin
  -- 다른 회사 멤버 id로 A 항목 차감 시도 → 거부
  begin
    perform public.consume_receipt_credit('5a000000-0000-0000-0000-000000000001', '2b000000-0000-0000-0000-000000000002', true, 100);
    v_ok := false;
  exception when others then v_ok := true;
  end;
  if not v_ok then raise exception 'FAIL [CREDIT] B member consumed A item credit'; end if;

  r := public.consume_receipt_credit('5a000000-0000-0000-0000-000000000001', '2a000000-0000-0000-0000-000000000002', true, 100);
  if (r->>'charged')::boolean is not true or (r->>'remaining')::int <> 99 then raise exception 'FAIL [CREDIT] first charge %', r; end if;
  r := public.consume_receipt_credit('5a000000-0000-0000-0000-000000000001', '2a000000-0000-0000-0000-000000000002', true, 100);
  if (r->>'charged')::boolean is not false then raise exception 'FAIL [CREDIT] double charge %', r; end if;
end $$;
reset role;

-- 이벤트 추가 지급: 남은 1장 → 차감으로 0장이 되는 순간 +100
update public.companies set receipt_credits_used = receipt_credits_granted - 1 where id = '1a000000-0000-0000-0000-000000000000';
set local role service_role;
do $$
declare r jsonb;
begin
  r := public.consume_receipt_credit('5a000000-0000-0000-0000-000000000002', '2a000000-0000-0000-0000-000000000002', true, 100);
  if (r->>'bonus_granted')::boolean is not true or (r->>'remaining')::int <> 100 then raise exception 'FAIL [CREDIT] event bonus %', r; end if;
end $$;
reset role;
-- 이벤트 꺼짐 + 0장 → 차감 거부
update public.companies set receipt_credits_used = receipt_credits_granted where id = '1a000000-0000-0000-0000-000000000000';
update public.expense_items set credit_charged = false where id = '5a000000-0000-0000-0000-000000000002';
set local role service_role;
do $$
declare v_ok boolean;
begin
  begin
    perform public.consume_receipt_credit('5a000000-0000-0000-0000-000000000002', '2a000000-0000-0000-0000-000000000002', false, 100);
    v_ok := false;
  exception when others then v_ok := sqlerrm = 'NO_CREDITS';
  end;
  if not v_ok then raise exception 'FAIL [CREDIT] no-credit upload allowed when event off'; end if;
end $$;
reset role;

-- ---------- 회사 A 직원 ----------
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
do $$
declare r record; n integer; v_ok boolean;
begin
  for r in select * from (values
    ('companies', (select count(*) from public.companies), 1),
    ('companies_B', (select count(*) from public.companies where id = '1b000000-0000-0000-0000-000000000000'), 0),
    ('members', (select count(*) from public.members), 3),
    ('members_B', (select count(*) from public.members where company_id = '1b000000-0000-0000-0000-000000000000'), 0),
    ('departments', (select count(*) from public.departments), 1),
    ('claims', (select count(*) from public.expense_claims), 1),
    ('claims_B', (select count(*) from public.expense_claims where company_id = '1b000000-0000-0000-0000-000000000000'), 0),
    ('items', (select count(*) from public.expense_items), 2),
    ('bank', (select count(*) from public.member_bank_accounts), 1),
    ('cards', (select count(*) from public.corporate_cards), 1),
    ('approval_lines', (select count(*) from public.approval_lines), 1),
    ('account_titles', (select count(*) from public.account_titles), 0),
    ('credit_ledger', (select count(*) from public.credit_ledger), 0),
    ('receipts_objects', (select count(*) from storage.objects where bucket_id = 'receipts'), 1)
  ) v(label, actual, expected) loop
    if r.actual <> r.expected then raise exception 'FAIL [A_EMP] %: expected %, got %', r.label, r.expected, r.actual; end if;
  end loop;

  begin
    insert into public.expense_claims (company_id, member_id, title) values ('1b000000-0000-0000-0000-000000000000', '2a000000-0000-0000-0000-000000000002', 'x');
    v_ok := false;
  exception when others then v_ok := true;
  end;
  if not v_ok then raise exception 'FAIL [A_EMP] created claim in company B'; end if;

  begin
    insert into public.expense_items (claim_id, company_id, amount) values ('4b000000-0000-0000-0000-000000000001', '1b000000-0000-0000-0000-000000000000', 1);
    v_ok := false;
  exception when others then v_ok := true;
  end;
  if not v_ok then raise exception 'FAIL [A_EMP] added item to B claim'; end if;

  update public.expense_claims set title = 'hacked' where id = '4b000000-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL [A_EMP] updated B claim'; end if;
  delete from public.expense_items where id = '5b000000-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL [A_EMP] deleted B item'; end if;
  update public.members set name = 'hacked' where id = '2b000000-0000-0000-0000-000000000002';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL [A_EMP] updated B member'; end if;

  -- 민감 칸 직접 변경 불가 (상태·영수증 경로·크레딧)
  begin
    update public.expense_claims set status = 'paid' where id = '4a000000-0000-0000-0000-000000000001';
    v_ok := false;
  exception when insufficient_privilege then v_ok := true;
  end;
  if not v_ok then raise exception 'FAIL [A_EMP] changed claim status directly'; end if;
  begin
    update public.expense_items set receipt_path = null where id = '5a000000-0000-0000-0000-000000000001';
    v_ok := false;
  exception when insufficient_privilege then v_ok := true;
  end;
  if not v_ok then raise exception 'FAIL [A_EMP] changed receipt_path directly'; end if;
  begin
    update public.companies set receipt_credits_granted = 99999 where id = '1a000000-0000-0000-0000-000000000000';
    v_ok := false;
  exception when insufficient_privilege then v_ok := true;
  end;
  if not v_ok then raise exception 'FAIL [A_EMP] changed company credits'; end if;
  begin
    update public.members set role = 'super_admin' where id = '2a000000-0000-0000-0000-000000000002';
    v_ok := false;
  exception when insufficient_privilege then v_ok := true;
  end;
  if not v_ok then raise exception 'FAIL [A_EMP] escalated own role'; end if;

  -- 크레딧 함수는 앱 사용자에게 막혀 있다
  begin
    perform public.consume_receipt_credit('5a000000-0000-0000-0000-000000000001', '2a000000-0000-0000-0000-000000000002', true, 100);
    v_ok := false;
  exception when insufficient_privilege then v_ok := true;
  end;
  if not v_ok then raise exception 'FAIL [A_EMP] called service-only credit function'; end if;

  -- 다른 회사 영수증 파일 업로드 불가
  begin
    insert into storage.objects (bucket_id, name) values ('receipts', '1b000000-0000-0000-0000-000000000000/2b000000-0000-0000-0000-000000000002/4b000000-0000-0000-0000-000000000001/evil.jpg');
    v_ok := false;
  exception when others then v_ok := true;
  end;
  if not v_ok then raise exception 'FAIL [A_EMP] uploaded into B receipts folder'; end if;

  -- 직원은 승인 불가, 다른 회사 소명서 상신 불가
  begin
    perform public.submit_claim('4b000000-0000-0000-0000-000000000001');
    v_ok := false;
  exception when others then v_ok := true;
  end;
  if not v_ok then raise exception 'FAIL [A_EMP] submitted B claim'; end if;

  if public.submit_claim('4a000000-0000-0000-0000-000000000001') <> 'submitted' then
    raise exception 'FAIL [A_EMP] own submit did not become submitted';
  end if;
  begin
    perform public.approve_claim('4a000000-0000-0000-0000-000000000001');
    v_ok := false;
  exception when others then v_ok := true;
  end;
  if not v_ok then raise exception 'FAIL [A_EMP] employee approved a claim'; end if;
end $$;
reset role;

-- ---------- 회사 B 최고 관리자: A 소명서를 보지도, 처리하지도 못한다 ----------
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
do $$
declare r record; v_ok boolean;
begin
  for r in select * from (values
    ('companies', (select count(*) from public.companies), 1),
    ('members', (select count(*) from public.members), 2),
    ('claims', (select count(*) from public.expense_claims), 1),
    ('claims_A', (select count(*) from public.expense_claims where company_id = '1a000000-0000-0000-0000-000000000000'), 0),
    ('items_A', (select count(*) from public.expense_items where company_id = '1a000000-0000-0000-0000-000000000000'), 0),
    ('approvals_A', (select count(*) from public.claim_approvals where company_id = '1a000000-0000-0000-0000-000000000000'), 0),
    ('bank', (select count(*) from public.member_bank_accounts), 1),
    ('ledger_A', (select count(*) from public.credit_ledger where company_id = '1a000000-0000-0000-0000-000000000000'), 0),
    ('receipts_objects', (select count(*) from storage.objects where bucket_id = 'receipts'), 1)
  ) v(label, actual, expected) loop
    if r.actual <> r.expected then raise exception 'FAIL [B_SUPER] %: expected %, got %', r.label, r.expected, r.actual; end if;
  end loop;

  begin
    perform public.approve_claim('4a000000-0000-0000-0000-000000000001');
    v_ok := false;
  exception when others then v_ok := true;
  end;
  if not v_ok then raise exception 'FAIL [B_SUPER] approved A claim'; end if;
  begin
    perform public.reject_claim('4a000000-0000-0000-0000-000000000001', '다른 회사 반려 시도');
    v_ok := false;
  exception when others then v_ok := true;
  end;
  if not v_ok then raise exception 'FAIL [B_SUPER] rejected A claim'; end if;
  begin
    perform public.mark_claims_paid(array['4a000000-0000-0000-0000-000000000001'::uuid]);
    v_ok := false;
  exception when others then v_ok := true;
  end;
  if not v_ok then raise exception 'FAIL [B_SUPER] paid A claim'; end if;
end $$;
reset role;

-- ---------- 회사 A 최고 관리자: 자기 회사만 보고, 승인·지급 처리 ----------
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
do $$
declare r record; v_ok boolean; v_status public.claim_status;
begin
  for r in select * from (values
    ('claims', (select count(*) from public.expense_claims), 1),
    ('claims_B', (select count(*) from public.expense_claims where company_id = '1b000000-0000-0000-0000-000000000000'), 0),
    ('bank', (select count(*) from public.member_bank_accounts), 1),
    ('ledger', (select count(*) from public.credit_ledger), 3),
    ('cards_B', (select count(*) from public.corporate_cards where company_id = '1b000000-0000-0000-0000-000000000000'), 0),
    ('receipts_objects', (select count(*) from storage.objects where bucket_id = 'receipts'), 1)
  ) v(label, actual, expected) loop
    if r.actual <> r.expected then raise exception 'FAIL [A_SUPER] %: expected %, got %', r.label, r.expected, r.actual; end if;
  end loop;

  begin
    perform public.mark_claims_paid(array['4a000000-0000-0000-0000-000000000001'::uuid, '4b000000-0000-0000-0000-000000000001'::uuid]);
    v_ok := false;
  exception when others then v_ok := true;
  end;
  if not v_ok then raise exception 'FAIL [A_SUPER] batch payout including B claim was accepted'; end if;

  v_status := public.approve_claim('4a000000-0000-0000-0000-000000000001');
  if v_status <> 'approved' then raise exception 'FAIL [A_SUPER] approve → expected approved (사비 정산 대기), got %', v_status; end if;
  if public.mark_claims_paid(array['4a000000-0000-0000-0000-000000000001'::uuid]) <> 1 then
    raise exception 'FAIL [A_SUPER] payout count';
  end if;
end $$;
reset role;

-- ---------- 회사 A 승인 대기 멤버: 자기 멤버 행 외에는 아무것도 못 본다 ----------
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
do $$
declare r record;
begin
  for r in select * from (values
    ('companies', (select count(*) from public.companies), 0),
    ('members', (select count(*) from public.members), 1),
    ('departments', (select count(*) from public.departments), 0),
    ('claims', (select count(*) from public.expense_claims), 0),
    ('items', (select count(*) from public.expense_items), 0),
    ('receipts_objects', (select count(*) from storage.objects where bucket_id = 'receipts'), 0)
  ) v(label, actual, expected) loop
    if r.actual <> r.expected then raise exception 'FAIL [A_PEND] %: expected %, got %', r.label, r.expected, r.actual; end if;
  end loop;
end $$;
reset role;

-- ---------- 어느 회사에도 속하지 않은 로그인 사용자 ----------
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
do $$
declare r record;
begin
  for r in select * from (values
    ('companies', (select count(*) from public.companies), 0),
    ('members', (select count(*) from public.members), 0),
    ('claims', (select count(*) from public.expense_claims), 0),
    ('items', (select count(*) from public.expense_items), 0),
    ('bank', (select count(*) from public.member_bank_accounts), 0),
    ('receipts_objects', (select count(*) from storage.objects where bucket_id = 'receipts'), 0)
  ) v(label, actual, expected) loop
    if r.actual <> r.expected then raise exception 'FAIL [OUTSIDER] %: expected %, got %', r.label, r.expected, r.actual; end if;
  end loop;
end $$;
reset role;

-- ---------- 비로그인(anon): 요금제만 읽을 수 있다 ----------
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $$
declare v_ok boolean;
begin
  if (select count(*) from public.billing_plans) = 0 then raise exception 'FAIL [ANON] billing_plans not readable'; end if;
  begin
    perform count(*) from public.expense_claims;
    v_ok := false;
  exception when insufficient_privilege then v_ok := true;
  end;
  if not v_ok then raise exception 'FAIL [ANON] could read expense_claims'; end if;
  begin
    perform count(*) from public.members;
    v_ok := false;
  exception when insufficient_privilege then v_ok := true;
  end;
  if not v_ok then raise exception 'FAIL [ANON] could read members'; end if;
  begin
    perform public.submit_claim('4a000000-0000-0000-0000-000000000001');
    v_ok := false;
  exception when insufficient_privilege then v_ok := true;
  end;
  if not v_ok then raise exception 'FAIL [ANON] could call submit_claim'; end if;
end $$;
reset role;

-- ---------- 최종 상태 확인 (postgres) ----------
do $$
begin
  if (select status from public.expense_claims where id = '4b000000-0000-0000-0000-000000000001') <> 'draft'
     or (select title from public.expense_claims where id = '4b000000-0000-0000-0000-000000000001') <> 'B 소명서' then
    raise exception 'FAIL [FINAL] B claim was modified by another company';
  end if;
  if (select status from public.expense_claims where id = '4a000000-0000-0000-0000-000000000001') <> 'paid' then
    raise exception 'FAIL [FINAL] A claim flow did not reach paid';
  end if;
end $$;

select 'TENANT_ISOLATION_OK' as result;
rollback;
