-- =============================================================================
-- 088_doc_conversions.sql — 서류 → 엑셀 변환 (8-104 A, migration 139)
-- 채팅 파일 확인: 방 참여자·사진/PDF·지워지지 않음 / 시작: 쪽 수만큼 차감·모자라면 NO_CREDITS·내 폴더만 /
-- 실패: 돌려줌 + 줄 지움 / 공개: 초안·나만 보기 = 만든 사람만, 회사 공유 = 회사 전체 / 저장·확정은 만든 사람만 /
-- 지우기: 만든 사람·회사 공유는 관리자 / 관리자 크레딧 사용 내역(직원 막힘) / 회사 격리 / 서버 전용 함수 막힘 / 30일 초안 정리
-- =============================================================================
begin;

create function public._t_raises88(p_sql text, p_code text, p_label text)
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
grant execute on function public._t_raises88(text, text, text) to authenticated;
create function public._t_as88(p_uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
end;
$$;

insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at) values
  ('a8800000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'boss88@test.local', now()),
  ('a8800000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'emp88@test.local', now()),
  ('a8800000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'emp288@test.local', now()),
  ('a8800000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bboss88@test.local', now());
insert into public.companies (id, name, invite_code, business_number) values
  ('c8800000-0000-0000-0000-00000000000a', '변환A', 'DCAAAAAA', '1000000881'),
  ('c8800000-0000-0000-0000-00000000000b', '변환B', 'DCBBBBBB', '1000000882');
update public.companies set receipt_credits_granted = 3, receipt_credits_used = 0 where id in ('c8800000-0000-0000-0000-00000000000a', 'c8800000-0000-0000-0000-00000000000b');
insert into public.members (id, auth_user_id, company_id, name, phone, role, status, privacy_agreed_at, approved_at) values
  ('a8810000-0000-0000-0000-000000000001', 'a8800000-0000-0000-0000-000000000001', 'c8800000-0000-0000-0000-00000000000a', 'A대표', '01098801001', 'super_admin', 'approved', now(), now()),
  ('a8810000-0000-0000-0000-000000000002', 'a8800000-0000-0000-0000-000000000002', 'c8800000-0000-0000-0000-00000000000a', 'A직원', '01098801002', 'employee', 'approved', now(), now()),
  ('a8810000-0000-0000-0000-000000000003', 'a8800000-0000-0000-0000-000000000003', 'c8800000-0000-0000-0000-00000000000a', 'A직원2', '01098801003', 'employee', 'approved', now(), now()),
  ('a8810000-0000-0000-0000-000000000004', 'a8800000-0000-0000-0000-000000000004', 'c8800000-0000-0000-0000-00000000000b', 'B대표', '01098801004', 'super_admin', 'approved', now(), now());
insert into public.company_features (company_id, feature, enabled) values
  ('c8800000-0000-0000-0000-00000000000a', 'messenger', true), ('c8800000-0000-0000-0000-00000000000b', 'messenger', true)
on conflict (company_id, feature) do update set enabled = true;
insert into public.chat_rooms (id, company_id, kind, title, created_by_member_id) values
  ('c8820000-0000-0000-0000-000000000001', 'c8800000-0000-0000-0000-00000000000a', 'group', '총무', 'a8810000-0000-0000-0000-000000000001');
insert into public.chat_members (room_id, company_id, member_id) values
  ('c8820000-0000-0000-0000-000000000001', 'c8800000-0000-0000-0000-00000000000a', 'a8810000-0000-0000-0000-000000000001'),
  ('c8820000-0000-0000-0000-000000000001', 'c8800000-0000-0000-0000-00000000000a', 'a8810000-0000-0000-0000-000000000002');
insert into public.chat_messages (id, room_id, company_id, sender_member_id, kind, body, attachment_path, attachment_name, attachment_size, attachment_mime, deleted_at) values
  ('c8830000-0000-0000-0000-000000000001', 'c8820000-0000-0000-0000-000000000001', 'c8800000-0000-0000-0000-00000000000a', 'a8810000-0000-0000-0000-000000000001', 'image', null, 'c8800000-0000-0000-0000-00000000000a/c8820000-0000-0000-0000-000000000001/m1.jpg', '휴가신청서.jpg', 300000, 'image/jpeg', null),
  ('c8830000-0000-0000-0000-000000000002', 'c8820000-0000-0000-0000-000000000001', 'c8800000-0000-0000-0000-00000000000a', 'a8810000-0000-0000-0000-000000000001', 'file', null, 'c8800000-0000-0000-0000-00000000000a/c8820000-0000-0000-0000-000000000001/m2.zip', '묶음.zip', 1000, 'application/zip', null),
  ('c8830000-0000-0000-0000-000000000003', 'c8820000-0000-0000-0000-000000000001', 'c8800000-0000-0000-0000-00000000000a', 'a8810000-0000-0000-0000-000000000001', 'file', null, 'c8800000-0000-0000-0000-00000000000a/c8820000-0000-0000-0000-000000000001/m3.pdf', '지운.pdf', 1000, 'application/pdf', now());

-- ① 채팅 파일 확인
select public._t_as88('a8800000-0000-0000-0000-000000000002');
set local role authenticated;
do $$
declare v jsonb;
begin
  v := public.doc_convert_check('c8830000-0000-0000-0000-000000000001');
  if v ->> 'path' not like '%/m1.jpg' or v ->> 'member_id' <> 'a8810000-0000-0000-0000-000000000002' or v ->> 'mime' <> 'image/jpeg' then raise exception 'FAIL [check %]', v; end if;
  perform public._t_raises88($q$select public.doc_convert_check('c8830000-0000-0000-0000-000000000002')$q$, 'NOT_CONVERTIBLE', 'zip');
  perform public._t_raises88($q$select public.doc_convert_check('c8830000-0000-0000-0000-000000000003')$q$, 'EXPIRED', 'deleted');
  perform public._t_raises88($q$select public.doc_convert_begin(gen_random_uuid(), 'a8810000-0000-0000-0000-000000000002', 'x', 'image/jpeg', 'x', 1, null)$q$, '42501', 'begin blocked');
  perform public._t_raises88($q$select public.doc_convert_fail(gen_random_uuid())$q$, '42501', 'fail blocked');
  perform public._t_raises88($q$select public.doc_convert_due()$q$, '42501', 'due blocked');
  perform public._t_raises88($q$select public.credit_usage('2026-11')$q$, '42501', 'employee usage');
end;
$$;
reset role;
select public._t_as88('a8800000-0000-0000-0000-000000000003');
set local role authenticated;
select public._t_raises88($q$select public.doc_convert_check('c8830000-0000-0000-0000-000000000001')$q$, 'NOT_FOUND', 'not room member');
reset role;
select public._t_as88('a8800000-0000-0000-0000-000000000004');
set local role authenticated;
select public._t_raises88($q$select public.doc_convert_check('c8830000-0000-0000-0000-000000000001')$q$, 'NOT_FOUND', 'other company');
reset role;

-- ② 시작(서버): 2쪽 차감 → 남은 1, 다음 2쪽은 NO_CREDITS, 남의 폴더 막힘, 6쪽 막힘
do $$
begin
  perform public.doc_convert_begin('d8800000-0000-0000-0000-000000000001', 'a8810000-0000-0000-0000-000000000002', '휴가신청서.jpg', 'application/pdf',
    'c8800000-0000-0000-0000-00000000000a/a8810000-0000-0000-0000-000000000002/d1.pdf', 2, 'c8830000-0000-0000-0000-000000000001');
  if (select receipt_credits_used from public.companies where id = 'c8800000-0000-0000-0000-00000000000a') <> 2 then raise exception 'FAIL [charged 2]'; end if;
  if (select note from public.credit_ledger where reason = 'doc_convert' and company_id = 'c8800000-0000-0000-0000-00000000000a') <> '휴가신청서.jpg (2쪽)' then raise exception 'FAIL [note]'; end if;
  perform public._t_raises88($q$select public.doc_convert_begin(gen_random_uuid(), 'a8810000-0000-0000-0000-000000000002', 'b', 'image/png', 'c8800000-0000-0000-0000-00000000000a/a8810000-0000-0000-0000-000000000002/d2.png', 2, null)$q$, 'NO_CREDITS', 'no credits');
  perform public._t_raises88($q$select public.doc_convert_begin(gen_random_uuid(), 'a8810000-0000-0000-0000-000000000002', 'b', 'image/png', 'c8800000-0000-0000-0000-00000000000a/a8810000-0000-0000-0000-000000000003/d2.png', 1, null)$q$, 'INVALID_FILE', 'other folder');
  perform public._t_raises88($q$select public.doc_convert_begin(gen_random_uuid(), 'a8810000-0000-0000-0000-000000000002', 'b', 'image/png', 'c8800000-0000-0000-0000-00000000000a/a8810000-0000-0000-0000-000000000002/d3.png', 6, null)$q$, 'TOO_MANY_PAGES', '6 pages');
  -- 실패 → 돌려줌 + 줄 지움
  perform public.doc_convert_begin('d8800000-0000-0000-0000-000000000009', 'a8810000-0000-0000-0000-000000000002', '메모.jpg', 'image/jpeg',
    'c8800000-0000-0000-0000-00000000000a/a8810000-0000-0000-0000-000000000002/d9.jpg', 1, null);
  if public.doc_convert_fail('d8800000-0000-0000-0000-000000000009') not like '%/d9.jpg' then raise exception 'FAIL [fail path]'; end if;
  if (select receipt_credits_used from public.companies where id = 'c8800000-0000-0000-0000-00000000000a') <> 2 then raise exception 'FAIL [refund]'; end if;
  if exists (select 1 from public.doc_conversions where id = 'd8800000-0000-0000-0000-000000000009') then raise exception 'FAIL [fail deletes]'; end if;
  perform public.doc_convert_ready('d8800000-0000-0000-0000-000000000001', '{"v":1,"sheets":[{"name":"1쪽"}]}');
end;
$$;

-- ③ 공개 범위: 초안은 만든 사람만
select public._t_as88('a8800000-0000-0000-0000-000000000001');
set local role authenticated;
do $$
begin
  if (select count(*) from public.doc_conversions) <> 0 then raise exception 'FAIL [admin sees draft]'; end if;
  if private.doc_can_read('c8800000-0000-0000-0000-00000000000a/a8810000-0000-0000-0000-000000000002/d1.pdf') then raise exception 'FAIL [admin reads draft file]'; end if;
  perform public._t_raises88($q$select public.doc_convert_save('d8800000-0000-0000-0000-000000000001', '{"v":1,"sheets":[{}]}')$q$, 'NOT_FOUND', 'admin save');
  perform public._t_raises88($q$select public.doc_convert_delete('d8800000-0000-0000-0000-000000000001')$q$, 'NOT_ALLOWED', 'admin delete draft');
end;
$$;
reset role;
select public._t_as88('a8800000-0000-0000-0000-000000000002');
set local role authenticated;
do $$
begin
  if (select count(*) from public.doc_conversions) <> 1 then raise exception 'FAIL [owner sees]'; end if;
  if not private.doc_can_read('c8800000-0000-0000-0000-00000000000a/a8810000-0000-0000-0000-000000000002/d1.pdf') then raise exception 'FAIL [owner reads]'; end if;
  perform public.doc_convert_save('d8800000-0000-0000-0000-000000000001', '{"v":1,"sheets":[{"name":"고침"}]}');
  perform public._t_raises88($q$select public.doc_convert_save('d8800000-0000-0000-0000-000000000001', '{"v":1,"sheets":[]}')$q$, 'INVALID_SHEETS', 'empty');
  perform public._t_raises88($q$select public.doc_convert_confirm('d8800000-0000-0000-0000-000000000001', 'all')$q$, 'INVALID_SCOPE', 'scope');
  perform public.doc_convert_confirm('d8800000-0000-0000-0000-000000000001', 'company');
end;
$$;
reset role;
-- 회사 공유 → 같은 회사 모두, 다른 회사는 안 보임. 관리자는 회사 공유를 지울 수 있음(여기선 확인만)
select public._t_as88('a8800000-0000-0000-0000-000000000003');
set local role authenticated;
do $$
begin
  if (select sheets -> 'sheets' -> 0 ->> 'name' from public.doc_conversions) <> '고침' then raise exception 'FAIL [shared visible]'; end if;
  if not private.doc_can_read('c8800000-0000-0000-0000-00000000000a/a8810000-0000-0000-0000-000000000002/d1.pdf') then raise exception 'FAIL [shared file]'; end if;
  perform public._t_raises88($q$select public.doc_convert_delete('d8800000-0000-0000-0000-000000000001')$q$, 'NOT_ALLOWED', 'coworker delete');
  perform public._t_raises88($q$select public.doc_convert_confirm('d8800000-0000-0000-0000-000000000001', 'private')$q$, 'NOT_FOUND', 'coworker scope');
end;
$$;
reset role;
select public._t_as88('a8800000-0000-0000-0000-000000000004');
set local role authenticated;
do $$
begin
  if (select count(*) from public.doc_conversions) <> 0 then raise exception 'FAIL [other company sees]'; end if;
  if private.doc_can_read('c8800000-0000-0000-0000-00000000000a/a8810000-0000-0000-0000-000000000002/d1.pdf') then raise exception 'FAIL [other company file]'; end if;
  if (public.credit_usage('2026-11') -> 'rows')::text like '%휴가신청서%' then raise exception 'FAIL [other company usage]'; end if;
end;
$$;
reset role;

-- ④ 관리자 크레딧 사용 내역: 이번 달 변환 2(3 차감 − 1 돌려줌), 줄에 이름·내용
select public._t_as88('a8800000-0000-0000-0000-000000000001');
set local role authenticated;
do $$
declare u jsonb;
begin
  u := public.credit_usage(to_char(now() at time zone 'Asia/Seoul', 'YYYY-MM'));
  if (u ->> 'convert')::integer <> 2 or (u ->> 'remaining')::integer <> 1 or jsonb_array_length(u -> 'rows') <> 3
     or u -> 'rows' -> 0 ->> 'member_name' <> 'A직원' or u::text not like '%표를 못 찾아 돌려줌%' then raise exception 'FAIL [usage %]', u; end if;
  perform public._t_raises88($q$select public.credit_usage('2026-13')$q$, 'INVALID_MONTH', 'bad month');
  -- 관리자는 회사 공유 변환을 지울 수 있음
  if public.doc_convert_delete('d8800000-0000-0000-0000-000000000001') not like '%/d1.pdf' then raise exception 'FAIL [admin delete shared]'; end if;
end;
$$;
reset role;

-- ⑤ 새벽 정리: 30일 지난 초안 + 멈춘 변환(돌려줌)
update public.companies set receipt_credits_granted = 10 where id = 'c8800000-0000-0000-0000-00000000000a';
do $$
declare d jsonb;
begin
  perform public.doc_convert_begin('d8800000-0000-0000-0000-000000000002', 'a8810000-0000-0000-0000-000000000002', '오래된.png', 'image/png',
    'c8800000-0000-0000-0000-00000000000a/a8810000-0000-0000-0000-000000000002/old.png', 1, null);
  perform public.doc_convert_ready('d8800000-0000-0000-0000-000000000002', '{"v":1,"sheets":[{}]}');
  update public.doc_conversions set created_at = now() - interval '31 days' where id = 'd8800000-0000-0000-0000-000000000002';
  perform public.doc_convert_begin('d8800000-0000-0000-0000-000000000003', 'a8810000-0000-0000-0000-000000000002', '멈춤.png', 'image/png',
    'c8800000-0000-0000-0000-00000000000a/a8810000-0000-0000-0000-000000000002/stuck.png', 1, null);
  update public.doc_conversions set created_at = now() - interval '2 hours' where id = 'd8800000-0000-0000-0000-000000000003';
  d := public.doc_convert_due();
  if jsonb_array_length(d) <> 2 or d::text not like '%old.png%' or d::text not like '%stuck.png%' then raise exception 'FAIL [due %]', d; end if;
  if exists (select 1 from public.doc_conversions where company_id = 'c8800000-0000-0000-0000-00000000000a') then raise exception 'FAIL [due deletes]'; end if;
  if (select receipt_credits_used from public.companies where id = 'c8800000-0000-0000-0000-00000000000a') <> 3 then raise exception 'FAIL [stuck refund %]', (select receipt_credits_used from public.companies where id = 'c8800000-0000-0000-0000-00000000000a'); end if;
end;
$$;

select 'ok' as doc_conversions_088;
rollback;
