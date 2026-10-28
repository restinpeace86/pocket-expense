-- =============================================================================
-- 052_card_reconcile_saved.sql — 카드 대조 결과 저장·건별 처리·다시 대조 시 처리 유지·권한·사무소 열람 (D-154, migration 082)
-- =============================================================================
begin;

-- 이 테스트는 가짜 번호로 회사·사무소를 만든다: 트랜잭션 안에서만 국세청 확인을 끈다(검증 자체는 003 테스트, D-155)
update private.app_settings set value = 'off' where key = 'business_verify_mode';

create function public._t_raises52(p_sql text, p_code text, p_label text)
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
grant execute on function public._t_raises52(text, text, text) to authenticated;
create function public._t_as52(p_uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
end;
$$;

insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at) values
  ('a5200000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sup52@test.local', now()),
  ('a5200000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'emp52@test.local', now()),
  ('a5200000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bsup52@test.local', now()),
  ('a5200000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'office52@test.local', now());
insert into public.companies (id, name, invite_code, business_number) values
  ('c5200000-0000-0000-0000-00000000000a', '대조A', 'RCNCAAAA', '1000000521'),
  ('c5200000-0000-0000-0000-00000000000b', '대조B', 'RCNCBBBB', '1000000522');
insert into public.members (id, auth_user_id, company_id, name, phone, role, status, privacy_agreed_at) values
  ('a5210000-0000-0000-0000-000000000001', 'a5200000-0000-0000-0000-000000000001', 'c5200000-0000-0000-0000-00000000000a', '가대표', '01095201001', 'super_admin', 'approved', now()),
  ('a5210000-0000-0000-0000-000000000002', 'a5200000-0000-0000-0000-000000000002', 'c5200000-0000-0000-0000-00000000000a', '나직원', '01095201002', 'employee', 'approved', now()),
  ('a5210000-0000-0000-0000-000000000003', 'a5200000-0000-0000-0000-000000000003', 'c5200000-0000-0000-0000-00000000000b', 'B대표', '01095201003', 'super_admin', 'approved', now());

-- 직원은 저장 불가
select public._t_as52('a5200000-0000-0000-0000-000000000002');
set local role authenticated;
select public._t_raises52($q$select public.save_card_reconciliation('2026-09', 'x.xlsx', '2026-09-01', '2026-09-30', '{}', '[]')$q$, '42501', 'employee save');
reset role;

-- 대표 A: 저장(결의서 없음 2건 + 내역에 없는 영수증 1건)
select public._t_as52('a5200000-0000-0000-0000-000000000001');
set local role authenticated;
select public._t_raises52($q$select public.save_card_reconciliation('2026-13', 'x', null, null, '{}', '[]')$q$, 'INVALID_MONTH', 'bad month');
select public._t_raises52($q$select public.save_card_reconciliation('2026-09', 'x', null, null, '{}', '[{"kind":"weird","fingerprint":"a"}]')$q$, 'INVALID_RECONCILE', 'bad kind');
do $$
declare v_id uuid; v_issue uuid;
begin
  v_id := public.save_card_reconciliation('2026-09', '9월.xlsx', '2026-09-01', '2026-09-30', '{"matched":10,"missing":2,"extra":1,"personal":0,"cancelled":1}',
    '[{"kind":"missing","fingerprint":"m1","date":"2026-09-03","merchant":"주유소","amount":"50000","last4":"7890"},
      {"kind":"missing","fingerprint":"m2","date":"2026-09-05","merchant":"마트","amount":"12000","last4":"7890"},
      {"kind":"extra","fingerprint":"e1","date":"2026-09-07","merchant":"카페","amount":"8000","item_id":"00000000-0000-0000-0000-000000000000","claim_title":"9월 미팅","member_name":"나직원"}]');
  if (select count(*) from public.card_reconcile_issues where reconciliation_id = v_id) <> 3 then raise exception 'FAIL [3 issues]'; end if;
  if (select item_id from public.card_reconcile_issues where fingerprint = 'e1') is not null then raise exception 'FAIL [foreign item not linked]'; end if;
  select id into v_issue from public.card_reconcile_issues where fingerprint = 'm1';
  perform public.set_card_issue_status(v_issue, 'claim_requested', null);
  perform public._t_raises52(format('select public.set_card_issue_status(%L, %L, %L)', v_issue, 'tax_review', ''), 'MEMO_REQUIRED', 'tax review memo');
  perform public._t_raises52(format('select public.set_card_issue_status(%L, %L, %L)', v_issue, 'refunded', null), 'INVALID_RECONCILE', 'missing cannot be refunded');
  select id into v_issue from public.card_reconcile_issues where fingerprint = 'm2';
  perform public.set_card_issue_status(v_issue, 'tax_review', '대표 개인 장보기로 보임, 세무사 판단 요청');
  -- 다시 대조(같은 달): m1·m2는 그대로 남고 e1은 사라짐 → 처리·메모 유지
  v_id := public.save_card_reconciliation('2026-09', '9월(2).xlsx', '2026-09-01', '2026-09-30', '{"matched":11,"missing":2}',
    '[{"kind":"missing","fingerprint":"m1","date":"2026-09-03","merchant":"주유소","amount":"50000","last4":"7890"},
      {"kind":"missing","fingerprint":"m2","date":"2026-09-05","merchant":"마트","amount":"12000","last4":"7890"}]');
  if (select count(*) from public.card_reconciliations) <> 1 then raise exception 'FAIL [one per month]'; end if;
  if (select status from public.card_reconcile_issues where fingerprint = 'm1') <> 'claim_requested' then raise exception 'FAIL [status kept]'; end if;
  if (select memo from public.card_reconcile_issues where fingerprint = 'm2') <> '대표 개인 장보기로 보임, 세무사 판단 요청' then raise exception 'FAIL [memo kept]'; end if;
  if (select resolved_by_name from public.card_reconcile_issues where fingerprint = 'm2') <> '가대표' then raise exception 'FAIL [resolver kept]'; end if;
  if exists (select 1 from public.card_reconcile_issues where fingerprint = 'e1') then raise exception 'FAIL [e1 gone]'; end if;
end;
$$;
select public._t_raises52($q$insert into public.card_reconciliations (company_id, month) values ('c5200000-0000-0000-0000-00000000000a', '2026-10')$q$, '42501', 'no direct insert');
select public.set_company_tax_office('X세무', 'office52@test.local', null, null, null);
reset role;

-- 다른 회사 대표: 못 보고 못 바꿈
select public._t_as52('a5200000-0000-0000-0000-000000000003');
set local role authenticated;
do $$ begin if (select count(*) from public.card_reconcile_issues) <> 0 then raise exception 'FAIL [isolation]'; end if; end; $$;
select public._t_raises52(format('select public.set_card_issue_status(%L, %L, null)', (select id from public.card_reconcile_issues limit 1), 'open'), 'NOT_FOUND', 'other company update');
reset role;
do $$ begin perform set_config('t.issue', (select id::text from public.card_reconcile_issues where fingerprint = 'm1'), true); end; $$;
select public._t_as52('a5200000-0000-0000-0000-000000000003');
set local role authenticated;
select public._t_raises52($q$select public.set_card_issue_status(current_setting('t.issue')::uuid, 'open', null)$q$, 'NOT_FOUND', 'other company update real id');
reset role;

-- 세무사무소: 등록 뒤 고객사 A 대조 결과를 읽기만
select public._t_as52('a5200000-0000-0000-0000-000000000004');
set local role authenticated;
select public.register_tax_office('X세무사무소', '2000000521', 'X대표', null, true, true);
do $$
begin
  if (select count(*) from public.card_reconciliations) <> 1 or (select count(*) from public.card_reconcile_issues) <> 2 then raise exception 'FAIL [office reads]'; end if;
end;
$$;
select public._t_raises52($q$select public.set_card_issue_status(current_setting('t.issue')::uuid, 'open', null)$q$, 'NOT_A_MEMBER', 'office cannot change');
reset role;

select 'card_reconcile_saved ok';
rollback;
