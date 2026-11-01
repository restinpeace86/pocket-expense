-- =============================================================================
-- 063_tax_requests_unified.sql — 확인 요청 하나로 (D-196, migration 102)
-- 사무소 시작 → 회사 안 읽음 → 회사 답 → 사무소 안 읽음 / 회사 시작(달·영수증) → 사무소 안 읽음 → 사무소 답 → [확인함]
-- 회사 영수증 요청은 영수증 칸(tax_review_*)과 맞춰짐(확인함 = 엑셀 '확인 필요'에서 빠짐). 열어 보면 내 쪽 안 읽음만 지움. 남의 회사는 못 건드림
-- =============================================================================
begin;

update private.app_settings set value = 'off' where key = 'business_verify_mode';

create function public._t_raises63(p_sql text, p_code text, p_label text)
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
grant execute on function public._t_raises63(text, text, text) to authenticated;
create function public._t_item_resolved63(p uuid) returns timestamptz language sql security definer set search_path = '' as $$ select tax_review_resolved_at from public.expense_items where id = p $$;
grant execute on function public._t_item_resolved63(uuid) to authenticated;
create function public._t_as63(p_uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
end;
$$;

insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at) values
  ('a6300000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'boss63@test.local', now()),
  ('a6300000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bboss63@test.local', now()),
  ('a6300000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'office63@test.local', now());
insert into public.companies (id, name, invite_code, business_number) values
  ('c6300000-0000-0000-0000-00000000000a', '확인A', 'CHKAAAAA', '1000000631'),
  ('c6300000-0000-0000-0000-00000000000b', '확인B', 'CHKBBBBB', '1000000632');
insert into public.members (id, auth_user_id, company_id, name, phone, role, status, privacy_agreed_at) values
  ('a6310000-0000-0000-0000-000000000001', 'a6300000-0000-0000-0000-000000000001', 'c6300000-0000-0000-0000-00000000000a', 'A대표', '01096301001', 'super_admin', 'approved', now()),
  ('a6310000-0000-0000-0000-000000000003', 'a6300000-0000-0000-0000-000000000003', 'c6300000-0000-0000-0000-00000000000b', 'B대표', '01096301003', 'super_admin', 'approved', now());
insert into public.expense_claims (id, company_id, member_id, title, status) values
  ('c6320000-0000-0000-0000-000000000001', 'c6300000-0000-0000-0000-00000000000a', 'a6310000-0000-0000-0000-000000000001', '9월', 'approved');
insert into public.expense_items (id, claim_id, company_id, sort_order, category, payment_method, expense_date, amount, headcount, merchant_name) values
  ('c6330000-0000-0000-0000-000000000001', 'c6320000-0000-0000-0000-000000000001', 'c6300000-0000-0000-0000-00000000000a', 1, 'meal', 'personal_card', '2026-09-10', 12000, 1, '김밥집'),
  ('c6330000-0000-0000-0000-000000000002', 'c6320000-0000-0000-0000-000000000001', 'c6300000-0000-0000-0000-00000000000a', 2, 'meal', 'personal_card', '2026-09-12', 30000, 1, '회의카페');

-- B는 사무소 연결 전: 회사 요청 불가
select public._t_as63('a6300000-0000-0000-0000-000000000003');
set local role authenticated;
select public._t_raises63($q$select public.create_company_tax_request('2026-09', null, '질문')$q$, 'NO_TAX_OFFICE', 'no office');
reset role;

select public._t_as63('a6300000-0000-0000-0000-000000000004');
set local role authenticated;
select public.register_tax_office('확인세무', '2000000631', '확대표', null, true, true);
reset role;
select public._t_as63('a6300000-0000-0000-0000-000000000001');
set local role authenticated;
select public.set_company_tax_office('확인세무', 'office63@test.local', null, null, null);
reset role;

-- ① 사무소 시작 → 회사 안 읽음 → 회사 답 → 사무소 안 읽음
select public._t_as63('a6300000-0000-0000-0000-000000000004');
set local role authenticated;
do $$
declare v_id uuid := public.create_tax_office_request('c6300000-0000-0000-0000-00000000000a', '2026-09', null, '세금계산서 없음');
begin
  perform set_config('t.r1', v_id::text, true);
  if (select origin || '/' || unread_for from public.tax_office_requests where tax_office_requests.id = v_id) <> 'office/company' then raise exception 'FAIL [office start unread company]'; end if;
end;
$$;
select public._t_raises63($q$select public.office_answer_tax_request(current_setting('t.r1')::uuid, '답')$q$, 'NOT_FOUND', 'office answers own');
reset role;
select public._t_as63('a6300000-0000-0000-0000-000000000001');
set local role authenticated;
do $$
begin
  if public.mark_tax_requests_seen('c6300000-0000-0000-0000-00000000000a') <> 1 then raise exception 'FAIL [company seen 1]'; end if;
  perform public.answer_tax_office_request(current_setting('t.r1')::uuid, '올렸어요');
  if (select status || '/' || unread_for from public.tax_office_requests where id = current_setting('t.r1')::uuid) <> 'answered/office' then raise exception 'FAIL [company answered unread office]'; end if;
end;
$$;
-- ② 회사 시작: 달 전체 + 영수증(결재 화면 메모와 같은 길)
do $$
declare m uuid; it uuid;
begin
  m := public.create_company_tax_request('2026-09', null, '9월 법인카드 개인 사용 처리 맞나요?');
  perform set_config('t.r2', m::text, true);
  it := public.create_company_tax_request('2026-09', 'c6330000-0000-0000-0000-000000000002', '회의비로 봐야 하나요?');
  perform set_config('t.r3', it::text, true);
  if (select tax_review_request from public.expense_items where id = 'c6330000-0000-0000-0000-000000000002') <> '회의비로 봐야 하나요?' then raise exception 'FAIL [item column synced]'; end if;
  if (select count(*) from public.tax_office_requests where origin = 'company' and unread_for = 'office') <> 2 then raise exception 'FAIL [company starts unread office]'; end if;
  if (select item_label from public.tax_office_requests where id = it) <> '2026-09-12 · 회의카페 · 30,000원' then raise exception 'FAIL [label]'; end if;
  -- 결재 화면 메모(기존 함수)도 같은 표로: 김밥집
  perform public.request_item_tax_review('c6330000-0000-0000-0000-000000000001', '식대 맞나요?');
  if not exists (select 1 from public.tax_office_requests where item_id = 'c6330000-0000-0000-0000-000000000001' and origin = 'company' and status = 'open') then raise exception 'FAIL [legacy memo → request]'; end if;
  perform public.request_item_tax_review('c6330000-0000-0000-0000-000000000001', null);
  if exists (select 1 from public.tax_office_requests where item_id = 'c6330000-0000-0000-0000-000000000001' and origin = 'company') then raise exception 'FAIL [memo cleared → request removed]'; end if;
end;
$$;
select public._t_raises63($q$select public.company_set_tax_request_status((select id from public.tax_office_requests where company_id = 'c6300000-0000-0000-0000-00000000000b' limit 1), true)$q$, 'NOT_FOUND', 'nothing in B');
reset role;
select public._t_as63('a6300000-0000-0000-0000-000000000003');
set local role authenticated;
select public._t_raises63($q$select public.company_set_tax_request_status(current_setting('t.r2')::uuid, true)$q$, 'NOT_FOUND', 'B cannot close A');
select public._t_raises63($q$select public.mark_tax_requests_seen('c6300000-0000-0000-0000-00000000000a')$q$, 'NOT_FOUND', 'B cannot mark A');
reset role;

-- ③ 사무소: 안 읽음 수 → 회사 영수증 요청에 답 → [확인함] → 영수증도 처리됨
select public._t_as63('a6300000-0000-0000-0000-000000000004');
set local role authenticated;
do $$
begin
  if (public.tax_office_client_status('2026-09')->0->>'unread')::int <> 3 then raise exception 'FAIL [office unread 3] %', public.tax_office_client_status('2026-09'); end if;
  perform public.office_answer_tax_request(current_setting('t.r3')::uuid, '회의비(819)로 바꿀게요');
  if (select status || '/' || unread_for from public.tax_office_requests where id = current_setting('t.r3')::uuid) <> 'answered/company' then raise exception 'FAIL [office answered]'; end if;
  perform public.set_tax_office_request_status(current_setting('t.r3')::uuid, true);
  if public._t_item_resolved63('c6330000-0000-0000-0000-000000000002') is null then raise exception 'FAIL [resolved → item resolved]'; end if;
  perform public.set_tax_office_request_status(current_setting('t.r3')::uuid, false);
  if public._t_item_resolved63('c6330000-0000-0000-0000-000000000002') is not null then raise exception 'FAIL [reopen → item open]'; end if;
  perform public.mark_tax_requests_seen('c6300000-0000-0000-0000-00000000000a');
  if (public.tax_office_client_status('2026-09')->0->>'unread')::int <> 0 then raise exception 'FAIL [office seen]'; end if;
end;
$$;
reset role;

-- ④ 회사 [확인함] → 사무소 안 읽음
select public._t_as63('a6300000-0000-0000-0000-000000000001');
set local role authenticated;
do $$
begin
  perform public.company_set_tax_request_status(current_setting('t.r2')::uuid, true);
  if (select status || '/' || unread_for from public.tax_office_requests where id = current_setting('t.r2')::uuid) <> 'resolved/office' then raise exception 'FAIL [company resolved]'; end if;
end;
$$;
reset role;

select 'tax_requests_unified ok';
rollback;
