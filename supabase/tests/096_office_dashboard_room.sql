-- 096_office_dashboard_room.sql — 세무사무소 현황판·세무 알림방(9-18·9-19, migration 157)
-- 현황판 새 칸(영수증 없는 지출·승인 대기·홈택스·마지막 올림·사무소 확인) / 사무소 확인 = 사무소만 / 회사 [확인했어요] /
-- 세무 알림방: 관리자만(직원 없음)·개인 [알림]방과 따로·카드에 요청 상태 / 사무소 공지(여러 곳, 맡은 곳만) / 다른 회사 막힘
begin;

update private.app_settings set value = 'off' where key = 'business_verify_mode';

create function public._t_raises96(p_sql text, p_code text, p_label text)
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
grant execute on function public._t_raises96(text, text, text) to authenticated;
create function public._t_as96(p_uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
end;
$$;

insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at) values
  ('a9600000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sa96@test.local', now()),
  ('a9600000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sb96@test.local', now()),
  ('a9600000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'emp96@test.local', now()),
  ('a9600000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'office96@test.local', now()),
  ('a9600000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sc96@test.local', now());
insert into public.companies (id, name, invite_code, business_number) values
  ('c9600000-0000-0000-0000-00000000000a', '현판A', 'RMAAAAAA', '1000000961'),
  ('c9600000-0000-0000-0000-00000000000b', '현판B', 'RMBBBBBB', '1000000962'),
  ('c9600000-0000-0000-0000-00000000000c', '현판C', 'RMCCCCCC', '1000000963');
insert into public.members (id, auth_user_id, company_id, name, phone, role, status, privacy_agreed_at) values
  ('a9610000-0000-0000-0000-000000000001', 'a9600000-0000-0000-0000-000000000001', 'c9600000-0000-0000-0000-00000000000a', 'A대표', '01099601001', 'super_admin', 'approved', now()),
  ('a9610000-0000-0000-0000-000000000002', 'a9600000-0000-0000-0000-000000000002', 'c9600000-0000-0000-0000-00000000000b', 'B대표', '01099601002', 'super_admin', 'approved', now()),
  ('a9610000-0000-0000-0000-000000000003', 'a9600000-0000-0000-0000-000000000003', 'c9600000-0000-0000-0000-00000000000a', 'A직원', '01099601003', 'employee', 'approved', now()),
  ('a9610000-0000-0000-0000-000000000006', 'a9600000-0000-0000-0000-000000000006', 'c9600000-0000-0000-0000-00000000000c', 'C대표', '01099601006', 'super_admin', 'approved', now());
insert into public.company_features (company_id, feature, enabled) values
  ('c9600000-0000-0000-0000-00000000000a', 'messenger', true), ('c9600000-0000-0000-0000-00000000000b', 'messenger', true)
on conflict (company_id, feature) do update set enabled = true;

select public._t_as96('a9600000-0000-0000-0000-000000000004');
set local role authenticated;
select public.register_tax_office('현판세무', '2000000961', '현대표', null, true, true);
reset role;
select public._t_as96('a9600000-0000-0000-0000-000000000001');
set local role authenticated;
select public.set_company_tax_office('현판세무', 'office96@test.local', null, null, null);
reset role;
select public._t_as96('a9600000-0000-0000-0000-000000000002');
set local role authenticated;
select public.set_company_tax_office('현판세무', 'office96@test.local', null, null, null);
reset role;
do $$ begin perform set_config('t.office', (select id::text from public.tax_offices where contact_email = 'office96@test.local'), true); end; $$;

-- A: 10월 승인 지출 2개(영수증 없음 1 · 자차 1), 결재 대기 1 / 홈택스는 B만
insert into public.expense_claims (id, company_id, member_id, title, status, submitted_at) values
  ('e9600000-0000-0000-0000-000000000001', 'c9600000-0000-0000-0000-00000000000a', 'a9610000-0000-0000-0000-000000000003', '승인', 'approved', '2026-10-20 01:00+00'),
  ('e9600000-0000-0000-0000-000000000002', 'c9600000-0000-0000-0000-00000000000a', 'a9610000-0000-0000-0000-000000000003', '대기', 'submitted', '2026-11-02 01:00+00');
insert into public.expense_items (claim_id, company_id, sort_order, category, trip_type, payment_method, expense_date, amount, company_supported_amount, personal_burden_amount, headcount) values
  ('e9600000-0000-0000-0000-000000000001', 'c9600000-0000-0000-0000-00000000000a', 1, 'meal', null, 'corporate_card', '2026-10-05', 10000, 10000, 0, 1),
  ('e9600000-0000-0000-0000-000000000001', 'c9600000-0000-0000-0000-00000000000a', 2, 'trip', 'own_car', 'personal_card', '2026-10-06', 20000, 20000, 0, 1),
  ('e9600000-0000-0000-0000-000000000002', 'c9600000-0000-0000-0000-00000000000a', 1, 'meal', null, 'corporate_card', '2026-10-30', 9000, 9000, 0, 1);
insert into public.hometax_uploads (company_id, month, kind, file_path, file_name, file_size) values
  ('c9600000-0000-0000-0000-00000000000b', '2026-10', 'tax_invoice', 'c9600000-0000-0000-0000-00000000000b/h.xlsx', 'h.xlsx', 100);

-- ① 현황판 + 사무소 확인
select public._t_as96('a9600000-0000-0000-0000-000000000004');
set local role authenticated;
do $$
declare j jsonb; a jsonb; b jsonb;
begin
  perform public.office_set_client_check('c9600000-0000-0000-0000-00000000000b', '2026-10', true);
  j := public.tax_office_client_status('2026-10');
  select e into a from jsonb_array_elements(j) e where e->>'company_id' = 'c9600000-0000-0000-0000-00000000000a';
  select e into b from jsonb_array_elements(j) e where e->>'company_id' = 'c9600000-0000-0000-0000-00000000000b';
  if (a->>'missing_receipts')::int <> 1 or (a->>'pending_claims')::int <> 1 or not (a->>'hometax_missing')::boolean or a->>'last_upload_at' is null or a->>'office_checked_at' is not null then raise exception 'FAIL [A row %]', a; end if;
  if (b->>'hometax_missing')::boolean or b->>'office_checked_at' is null or b->>'office_checked_by' <> '현대표' then raise exception 'FAIL [B row %]', b; end if;
  perform public.office_set_client_check('c9600000-0000-0000-0000-00000000000b', '2026-10', false);
  if (select e->>'office_checked_at' from jsonb_array_elements(public.tax_office_client_status('2026-10')) e where e->>'company_id' = 'c9600000-0000-0000-0000-00000000000b') is not null then raise exception 'FAIL [uncheck]'; end if;
  perform public._t_raises96($q$select public.office_set_client_check('c9600000-0000-0000-0000-00000000000c', '2026-10', true)$q$, 'NOT_FOUND', 'not client check');
  -- 자료 요청(A, B) + 공지(A, B)
  perform set_config('t.req', public.create_tax_office_request('c9600000-0000-0000-0000-00000000000a', '2026-10', null, '10월 영수증 올려 주세요')::text, true);
  if public.tax_office_send_notice(array['c9600000-0000-0000-0000-00000000000a', 'c9600000-0000-0000-0000-00000000000b']::uuid[], '부가세 신고 자료는 1/20까지 올려 주세요') <> 2 then raise exception 'FAIL [notice 2]'; end if;
  perform public._t_raises96($q$select public.tax_office_send_notice(array['c9600000-0000-0000-0000-00000000000c']::uuid[], 'x')$q$, 'NOT_FOUND', 'notice not client');
  if jsonb_array_length(public.tax_office_notice_list('c9600000-0000-0000-0000-00000000000a')) <> 1 then raise exception 'FAIL [notice list]'; end if;
end;
$$;
reset role;

-- ② 서버가 요청 카드를 사무소 알림방에(관리자만). 개인 [알림]방과 다른 방
do $$
declare n integer;
begin
  n := public.office_room_post('c9600000-0000-0000-0000-00000000000a', current_setting('t.office')::uuid, E'현판세무 자료 요청\n10월 영수증 올려 주세요', '/x', current_setting('t.req')::uuid);
  if n <> 1 then raise exception 'FAIL [post to 1 admin: %]', n; end if;
  if (select count(*) from public.chat_rooms where company_id = 'c9600000-0000-0000-0000-00000000000a' and office_id is not null) <> 1 then raise exception 'FAIL [one office room]'; end if;
  if (select title from public.chat_rooms where company_id = 'c9600000-0000-0000-0000-00000000000a' and office_id is not null) <> '현판세무 알림' then raise exception 'FAIL [room title]'; end if;
  if (select count(*) from public.chat_messages m join public.chat_rooms r on r.id = m.room_id where r.office_id is not null and r.company_id = 'c9600000-0000-0000-0000-00000000000a') <> 2 then raise exception 'FAIL [notice + request in office room]'; end if;
  -- 개인 [알림]방은 따로 만들어짐(사무소 방과 안 섞임)
  perform private.chat_notice_room('c9600000-0000-0000-0000-00000000000a', 'a9610000-0000-0000-0000-000000000001');
  if (select count(*) from public.chat_rooms where company_id = 'c9600000-0000-0000-0000-00000000000a' and notice_member_id = 'a9610000-0000-0000-0000-000000000001') <> 2 then raise exception 'FAIL [personal room separate]'; end if;
  if exists (select 1 from public.chat_members cm join public.chat_rooms r on r.id = cm.room_id where r.office_id is not null and cm.member_id = 'a9610000-0000-0000-0000-000000000003') then raise exception 'FAIL [employee not in office room]'; end if;
end;
$$;

-- ③ 회사 대표: 카드에 요청 상태 → [확인했어요] → 현황판 확인함 1 / 직원·다른 회사 막힘
select public._t_as96('a9600000-0000-0000-0000-000000000001');
set local role authenticated;
do $$
declare r uuid; m jsonb;
begin
  select id into r from public.chat_rooms where office_id is not null;
  if (select detail->>'office_id' from (select public.chat_room_detail(r) as detail) x) is null then raise exception 'FAIL [detail office_id]'; end if;
  select e into m from jsonb_array_elements(public.chat_messages_page(r, null, null, 50)) e where e->'office_request' is not null and e->'office_request' <> 'null'::jsonb;
  if m->'office_request'->>'status' <> 'open' then raise exception 'FAIL [card request status %]', m; end if;
  perform public.company_ack_tax_request(current_setting('t.req')::uuid);
end;
$$;
reset role;
select public._t_as96('a9600000-0000-0000-0000-000000000003');
set local role authenticated;
select public._t_raises96(format($q$select public.company_ack_tax_request('%s')$q$, current_setting('t.req')), 'NOT_ALLOWED', 'employee ack');
reset role;
select public._t_as96('a9600000-0000-0000-0000-000000000002');
set local role authenticated;
select public._t_raises96(format($q$select public.company_ack_tax_request('%s')$q$, current_setting('t.req')), 'NOT_FOUND', 'other company ack');
reset role;
select public._t_as96('a9600000-0000-0000-0000-000000000004');
set local role authenticated;
do $$
begin
  if (select (e->>'requests_acked')::int from jsonb_array_elements(public.tax_office_client_status('2026-10')) e where e->>'company_id' = 'c9600000-0000-0000-0000-00000000000a') <> 1 then raise exception 'FAIL [acked 1]'; end if;
end;
$$;
reset role;
-- 사무소 확인 표·공지 표는 직접 못 읽음
select public._t_as96('a9600000-0000-0000-0000-000000000001');
set local role authenticated;
select public._t_raises96('select count(*) from public.office_client_checks', '42501', 'checks hidden');
select public._t_raises96('select count(*) from public.tax_office_notices', '42501', 'notices hidden');
reset role;

select 'ok' as office_dashboard_room_096;
rollback;
