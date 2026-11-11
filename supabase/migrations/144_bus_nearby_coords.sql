-- 144: 주변 정류장에 좌표도 (D-251 ⑧, todo_improvement 개선사항 4 — 지도에 정류장 표시)
create or replace function private.bus_nearby(p_lat double precision, p_lng double precision)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare v jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object('ars_id', x.ars_id, 'name', x.name, 'meters', round(x.m), 'lat', x.lat, 'lng', x.lng) order by x.m), '[]'::jsonb) into v
  from (select s.ars_id, s.name, s.lat, s.lng, private.meters_between(p_lat, p_lng, s.lat, s.lng) m from public.bus_stops s
        where s.lat between p_lat - 0.0025 and p_lat + 0.0025 and s.lng between p_lng - 0.003 and p_lng + 0.003) x
  where x.m <= 200 order by x.m limit 5;
  if jsonb_array_length(v) > 0 then return jsonb_build_object('stops', v, 'fallback', false); end if;
  select coalesce(jsonb_agg(jsonb_build_object('ars_id', x.ars_id, 'name', x.name, 'meters', round(x.m), 'lat', x.lat, 'lng', x.lng) order by x.m), '[]'::jsonb) into v
  from (select s.ars_id, s.name, s.lat, s.lng, private.meters_between(p_lat, p_lng, s.lat, s.lng) m from public.bus_stops s
        where s.lat between p_lat - 0.006 and p_lat + 0.006 and s.lng between p_lng - 0.007 and p_lng + 0.007) x
  where x.m <= 500 order by x.m limit 3;
  return jsonb_build_object('stops', v, 'fallback', true);
end;
$$;
