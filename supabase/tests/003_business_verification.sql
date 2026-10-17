-- =============================================================================
-- 003_business_verification.sql — 사업자등록번호 검증 모드·통과 구멍·격리 테스트 (D-057)
-- 1248100998 = 체크섬이 맞는 번호, 1234567890 = 체크섬이 틀린 번호
-- =============================================================================
begin;

insert into auth.users (id, instance_id, aud, role, email)
select ('d1000000-0000-0000-0000-00000000000' || g)::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'biz' || g || '@test.local'
from generate_series(1, 7) g;

-- 서버(service role)가 기록한 조회 결과: 사용자별로 따로 저장된다
set local role service_role;
insert into public.business_verifications (b_no, auth_user_id, status, status_label) values
  ('1248100998', 'd1000000-0000-0000-0000-000000000001', 'active', '계속사업자'),
  ('1248100998', 'd1000000-0000-0000-0000-000000000002', 'closed', '폐업자'),
  ('1248100998', 'd1000000-0000-0000-0000-000000000003', 'not_registered', null),
  ('1248100998', 'd1000000-0000-0000-0000-000000000007', 'closed', '폐업자');
reset role;

update private.app_settings set value = 'enforce' where key = 'business_verify_mode';
update private.app_settings set value = '1234567890, 2222222222' where key = 'business_verify_bypass_numbers';

-- 앱 사용자는 조회 결과 테이블을 읽거나 쓸 수 없다
select set_config('request.jwt.claims', '{"sub":"d1000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
do $$
declare v_ok boolean;
begin
  if public.business_verify_mode() <> 'enforce' then raise exception 'FAIL [MODE] mode not readable'; end if;
  begin
    perform count(*) from public.business_verifications;
    v_ok := false;
  exception when insufficient_privilege then v_ok := true;
  end;
  if not v_ok then raise exception 'FAIL [TABLE] authenticated read business_verifications'; end if;
  begin
    insert into public.business_verifications (b_no, auth_user_id, status) values ('1248100998', 'd1000000-0000-0000-0000-000000000002', 'active');
    v_ok := false;
  exception when insufficient_privilege then v_ok := true;
  end;
  if not v_ok then raise exception 'FAIL [TABLE] authenticated forged a verification'; end if;

  -- 계속사업자 → 통과, 상태 active
  perform public.create_company('검증회사1', '124-81-00998', array['팀'], '대표1', '01010000001', '팀', null, true, true);
  if (select business_status from public.companies) <> 'active' then raise exception 'FAIL [ENFORCE] active not recorded'; end if;
end $$;
reset role;

-- 폐업 → 거부
select set_config('request.jwt.claims', '{"sub":"d1000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
do $$
declare v_ok boolean;
begin
  begin
    perform public.create_company('검증회사2', '1248100998', array['팀'], '대표2', '01010000002', '팀', null, true, true);
    v_ok := false;
  exception when others then v_ok := sqlerrm = 'BUSINESS_CLOSED';
  end;
  if not v_ok then raise exception 'FAIL [ENFORCE] closed business accepted'; end if;
end $$;
reset role;

-- 미등록 → 거부
select set_config('request.jwt.claims', '{"sub":"d1000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
do $$
declare v_ok boolean;
begin
  begin
    perform public.create_company('검증회사3', '1248100998', array['팀'], '대표3', '01010000003', '팀', null, true, true);
    v_ok := false;
  exception when others then v_ok := sqlerrm = 'BUSINESS_NOT_REGISTERED';
  end;
  if not v_ok then raise exception 'FAIL [ENFORCE] unregistered business accepted'; end if;
end $$;
reset role;

-- 내 조회 기록이 없음(다른 사람의 'active' 기록을 빌려 쓸 수 없음) → 확인 대기로 통과
select set_config('request.jwt.claims', '{"sub":"d1000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  perform public.create_company('검증회사4', '1248100998', array['팀'], '대표4', '01010000004', '팀', null, true, true);
  if (select business_status from public.companies) <> 'unverified' then raise exception 'FAIL [ENFORCE] borrowed another user''s verification'; end if;
end $$;
reset role;

-- 통과 구멍: 허용 목록 번호는 체크섬이 틀려도 통과
select set_config('request.jwt.claims', '{"sub":"d1000000-0000-0000-0000-000000000005","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  perform public.create_company('테스트회사', '123-45-67890', array['팀'], '대표5', '01010000005', '팀', null, true, true);
  if (select business_status from public.companies) <> 'bypass' then raise exception 'FAIL [BYPASS] bypass not applied'; end if;
end $$;
reset role;

-- 허용 목록에 없는 체크섬 오류 번호 → 거부
select set_config('request.jwt.claims', '{"sub":"d1000000-0000-0000-0000-000000000006","role":"authenticated"}', true);
set local role authenticated;
do $$
declare v_ok boolean;
begin
  begin
    perform public.create_company('오타회사', '1248100990', array['팀'], '대표6', '01010000006', '팀', null, true, true);
    v_ok := false;
  exception when others then v_ok := sqlerrm = 'INVALID_BUSINESS_NUMBER';
  end;
  if not v_ok then raise exception 'FAIL [CHECKSUM] invalid checksum accepted'; end if;
end $$;
reset role;

-- warn 모드: 폐업 기록이 있어도 통과, 상태는 확인 대기
update private.app_settings set value = 'warn' where key = 'business_verify_mode';
select set_config('request.jwt.claims', '{"sub":"d1000000-0000-0000-0000-000000000007","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  perform public.create_company('경고회사', '1248100998', array['팀'], '대표7', '01010000007', '팀', null, true, true);
  if (select business_status from public.companies) <> 'unverified' then raise exception 'FAIL [WARN] warn mode status'; end if;
end $$;
reset role;

select 'BUSINESS_VERIFICATION_OK' as result;
rollback;
