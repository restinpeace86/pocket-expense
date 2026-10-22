-- =============================================================================
-- 053_trip_company_car_enum.sql — 회사차량으로 간 출장 (D-106). enum 값 추가만(사용은 054).
--   trip_transport: company_car (회사차량)
--   trip_type: car_fuel (회사차량 주유), car_toll (회사차량 통행료·주차) — 기본 계정과목 차량유지비
-- =============================================================================
alter type public.trip_transport add value if not exists 'company_car';
alter type public.trip_type add value if not exists 'car_fuel';
alter type public.trip_type add value if not exists 'car_toll';
