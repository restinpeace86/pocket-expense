-- =============================================================================
-- 009_receipt_thumbnails.sql — 영수증 썸네일 열람 격리 테스트 (D-073, migration 021)
-- 회사 A(대표 a_sup, 직원 a_e1 — 소명서 작성자, 직원 a_e2 — 남), 회사 B(대표 b_sup)
-- 보관본·썸네일 모두: 자기 회사 + 그 소명서를 볼 수 있는 사람만, 항목에 등록되지 않은 파일은 아무도 못 봄
-- =============================================================================
begin;

insert into auth.users (id, instance_id, aud, role, email)
select u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u::text || '@test.local'
from unnest(array['a4000000-0000-0000-0000-000000000001', 'a4000000-0000-0000-0000-000000000002', 'a4000000-0000-0000-0000-000000000003', 'b4000000-0000-0000-0000-000000000001']::uuid[]) u;
insert into public.companies (id, name, invite_code, business_number) values
  ('c4000000-0000-0000-0000-00000000000a', '썸네일회사A', 'THUMBAAA', '1000000061'),
  ('c4000000-0000-0000-0000-00000000000b', '썸네일회사B', 'THUMBBBB', '1000000062');
insert into public.members (id, auth_user_id, company_id, name, phone, role, status, privacy_agreed_at) values
  ('a3000000-0000-0000-0000-000000000001', 'a4000000-0000-0000-0000-000000000001', 'c4000000-0000-0000-0000-00000000000a', 'A대표', '01091001000', 'super_admin', 'approved', now()),
  ('a3000000-0000-0000-0000-000000000002', 'a4000000-0000-0000-0000-000000000002', 'c4000000-0000-0000-0000-00000000000a', 'A직원1', '01091001001', 'employee', 'approved', now()),
  ('a3000000-0000-0000-0000-000000000003', 'a4000000-0000-0000-0000-000000000003', 'c4000000-0000-0000-0000-00000000000a', 'A직원2', '01091001002', 'employee', 'approved', now()),
  ('b3000000-0000-0000-0000-000000000001', 'b4000000-0000-0000-0000-000000000001', 'c4000000-0000-0000-0000-00000000000b', 'B대표', '01092001000', 'super_admin', 'approved', now());
insert into public.expense_claims (id, company_id, member_id, title) values
  ('a2000000-0000-0000-0000-000000000001', 'c4000000-0000-0000-0000-00000000000a', 'a3000000-0000-0000-0000-000000000002', 'A직원1 소명서');
insert into public.expense_items (id, claim_id, company_id, category, amount, expense_date, receipt_path, receipt_thumb_path) values
  ('a1000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000001', 'c4000000-0000-0000-0000-00000000000a', 'meal', 10000, current_date,
   'c4000000-0000-0000-0000-00000000000a/a3000000-0000-0000-0000-000000000002/a2000000-0000-0000-0000-000000000001/a1000000-0000-0000-0000-000000000001.jpg',
   'c4000000-0000-0000-0000-00000000000a/a3000000-0000-0000-0000-000000000002/a2000000-0000-0000-0000-000000000001/a1000000-0000-0000-0000-000000000001_thumb.webp');
insert into storage.objects (bucket_id, name) values
  ('receipts', 'c4000000-0000-0000-0000-00000000000a/a3000000-0000-0000-0000-000000000002/a2000000-0000-0000-0000-000000000001/a1000000-0000-0000-0000-000000000001.jpg'),
  ('receipts', 'c4000000-0000-0000-0000-00000000000a/a3000000-0000-0000-0000-000000000002/a2000000-0000-0000-0000-000000000001/a1000000-0000-0000-0000-000000000001_thumb.webp'),
  ('receipts', 'c4000000-0000-0000-0000-00000000000a/a3000000-0000-0000-0000-000000000002/a2000000-0000-0000-0000-000000000001/stray_thumb.webp');

-- 썸네일 경로는 자기 회사 폴더여야 한다
do $$
declare v_ok boolean;
begin
  begin
    update public.expense_items set receipt_thumb_path = 'c4000000-0000-0000-0000-00000000000b/x_thumb.webp' where id = 'a1000000-0000-0000-0000-000000000001';
    v_ok := false;
  exception when check_violation then v_ok := true; end;
  if not v_ok then raise exception 'FAIL [SCHEMA] thumb path outside company folder accepted'; end if;
end $$;

-- 보이는 영수증 파일 수: 작성자·대표 = 보관본+썸네일 2개, 같은 회사 다른 직원 = 0, 다른 회사 = 0 (등록 안 된 파일은 누구도 0)
create function public._t_visible(p_uid text) returns integer language plpgsql as $$
declare n integer;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from storage.objects where bucket_id = 'receipts' and name like 'c4000000-0000-0000-0000-00000000000a/%';
  execute 'reset role';
  return n;
end $$;

do $$
begin
  if public._t_visible('a4000000-0000-0000-0000-000000000002') <> 2 then raise exception 'FAIL [A_E1] author should see receipt + thumbnail'; end if;
  if public._t_visible('a4000000-0000-0000-0000-000000000001') <> 2 then raise exception 'FAIL [A_SUP] admin should see receipt + thumbnail'; end if;
  if public._t_visible('a4000000-0000-0000-0000-000000000003') <> 0 then raise exception 'FAIL [A_E2] other employee sees receipt/thumbnail'; end if;
  if public._t_visible('b4000000-0000-0000-0000-000000000001') <> 0 then raise exception 'FAIL [B_SUP] other company sees receipt/thumbnail'; end if;
end $$;

select 'RECEIPT_THUMBNAIL_OK' as result;
rollback;
