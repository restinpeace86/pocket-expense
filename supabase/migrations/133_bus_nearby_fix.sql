-- =============================================================================
-- 133_bus_nearby_fix.sql — 주변 정류장 함수 고침(D-243): 가까운 순 자르기를 안쪽에서 한 뒤 묶는다
-- =============================================================================
create or replace function private.bus_nearby(p_lat double precision, p_lng double precision)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare v jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object('ars_id', y.ars_id, 'name', y.name, 'meters', round(y.m::numeric)) order by y.m), '[]'::jsonb) into v
  from (select x.* from (select s.ars_id, s.name, private.meters_between(p_lat, p_lng, s.lat, s.lng) m from public.bus_stops s
          where s.lat between p_lat - 0.0025 and p_lat + 0.0025 and s.lng between p_lng - 0.003 and p_lng + 0.003) x
        where x.m <= 200 order by x.m limit 5) y;
  if jsonb_array_length(v) > 0 then return jsonb_build_object('stops', v, 'fallback', false); end if;
  select coalesce(jsonb_agg(jsonb_build_object('ars_id', y.ars_id, 'name', y.name, 'meters', round(y.m::numeric)) order by y.m), '[]'::jsonb) into v
  from (select x.* from (select s.ars_id, s.name, private.meters_between(p_lat, p_lng, s.lat, s.lng) m from public.bus_stops s
          where s.lat between p_lat - 0.006 and p_lat + 0.006 and s.lng between p_lng - 0.007 and p_lng + 0.007) x
        where x.m <= 500 order by x.m limit 3) y;
  return jsonb_build_object('stops', v, 'fallback', true);
end;
$$;
revoke all on function private.bus_nearby(double precision, double precision) from public, anon, authenticated;
