-- =============================================================================
-- 083_business_verify_enforce.sql — 사업자등록번호 국세청 확인 켜기 (D-155, D-057 운영 전환)
-- 사용자 지시(2026-10-29): 이제 진짜 사업자등록번호로만 회사·세무사무소를 등록. 지금까지 가짜로 등록된 것은 테스트용 예외.
-- - business_verify_mode = 'enforce': 번호 형식(검증 숫자)이 틀리면 INVALID_BUSINESS_NUMBER, 국세청 조회가 폐업·미등록이면 막음.
--   조회 자체가 안 될 때(키 없음·장애)는 막지 않고 '확인 대기'(unverified)로 받는다(D-057 그대로).
-- - 지금 등록된 회사·세무사무소 중 확인되지 않은 번호는 예외 목록(business_verify_bypass_numbers)에 넣고 상태를 'bypass'(테스트 예외)로 표시.
--   번호를 이 파일에 적지 않고 DB에서 읽어 넣는다.
-- =============================================================================

do $$
declare
  v_existing text[] := array_remove(string_to_array(replace(private.setting('business_verify_bypass_numbers', ''), ' ', ''), ','), '');
  v_add text[];
begin
  select coalesce(array_agg(distinct b), '{}') into v_add
    from (
      select business_number as b from public.companies where business_status in ('skipped', 'unverified', 'bypass')
      union
      select business_number from public.tax_offices where business_status in ('skipped', 'unverified', 'bypass')
    ) x
   where b ~ '^[0-9]{10}$';
  update private.app_settings
     set value = array_to_string(array(select distinct unnest(v_existing || v_add) order by 1), ','), updated_at = now()
   where key = 'business_verify_bypass_numbers';
  update public.companies set business_status = 'bypass' where business_status in ('skipped', 'unverified') and business_number = any(v_add);
  update public.tax_offices set business_status = 'bypass' where business_status in ('skipped', 'unverified') and business_number = any(v_add);
  update private.app_settings set value = 'enforce', updated_at = now() where key = 'business_verify_mode';
end;
$$;
