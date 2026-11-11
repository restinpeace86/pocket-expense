-- 149: 서울 밖 주변 버스(D-254) — 국토교통부 TAGO
-- 회사 위치가 서울이 아니면 서버가 TAGO '좌표 근처 정류장'(반경 500m)을 받아 회사 위치에 저장(tago_stops, 7일마다 새로).
-- 주변 정류장 = 200m 안 가까운 순 5곳, 없으면 500m 안 3곳(서울과 같은 규칙). 정류장 키 = "t{도시코드}-{정류장ID}"
alter table public.company_locations
  add column tago_stops jsonb check (tago_stops is null or (jsonb_typeof(tago_stops) = 'array' and jsonb_array_length(tago_stops) <= 50)),
  add column tago_at timestamptz;

-- 저장된 TAGO 정류장 → 주변 정류장 목록
create or replace function private.tago_nearby(p_stops jsonb)
returns jsonb
language sql immutable
set search_path = ''
as $$
  with s as (
    select e ->> 'key' as ars_id, e ->> 'no' as no, e ->> 'name' as name, (e ->> 'meters')::numeric as m, (e ->> 'lat')::double precision as lat, (e ->> 'lng')::double precision as lng
    from jsonb_array_elements(coalesce(p_stops, '[]'::jsonb)) e
  ), near as (
    select * from s where m <= 200 order by m limit 5
  ), far as (
    select * from s where m <= 500 order by m limit 3
  )
  select case when exists (select 1 from near)
    then jsonb_build_object('stops', (select jsonb_agg(jsonb_build_object('ars_id', ars_id, 'no', no, 'name', name, 'meters', round(m), 'lat', lat, 'lng', lng) order by m) from near), 'fallback', false)
    else jsonb_build_object('stops', coalesce((select jsonb_agg(jsonb_build_object('ars_id', ars_id, 'no', no, 'name', name, 'meters', round(m), 'lat', lat, 'lng', lng) order by m) from far), '[]'::jsonb), 'fallback', true)
  end
$$;

-- 회사 위치 + 주변 정류장(회사 멤버). bus = 주변 버스를 보여 줄 수 있는지(서울 또는 TAGO 정류장이 있음)
create or replace function public.bus_company_nearby()
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_company uuid := private.current_company_id();
  l public.company_locations;
  v jsonb;
begin
  if v_company is null or private.current_member_id() is null then raise exception 'NOT_ALLOWED' using errcode = '42501'; end if;
  select * into l from public.company_locations where company_id = v_company;
  if not found then return null; end if;
  v := case when l.region = '서울' then private.bus_nearby(l.lat, l.lng) else private.tago_nearby(l.tago_stops) end;
  return jsonb_build_object('address', l.address, 'found_address', l.found_address, 'lat', l.lat, 'lng', l.lng, 'region', l.region,
    'jibun_address', l.jibun_address, 'zonecode', l.zonecode, 'company_id', l.company_id, 'tago_at', l.tago_at,
    'seoul', l.region = '서울', 'bus', l.region = '서울' or jsonb_array_length(v -> 'stops') > 0,
    'updated_by_name', l.updated_by_name, 'updated_at', l.updated_at) || v;
end;
$$;

-- 알림을 켤 수 있는 정류장: 회사 주변 정류장만(서울·TAGO)
create or replace function private.bus_stop_allowed(p_company uuid, p_ars text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.company_locations l,
      jsonb_array_elements((case when l.region = '서울' then private.bus_nearby(l.lat, l.lng) else private.tago_nearby(l.tago_stops) end) -> 'stops') e
    where l.company_id = p_company and e ->> 'ars_id' = p_ars)
$$;

-- 위치를 바꾸면 TAGO 정류장은 다시 받는다(서버가 저장 직후 채움)
create or replace function private.company_location_tago_reset()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.lat, new.lng) is distinct from (old.lat, old.lng) then
    new.tago_stops := null;
    new.tago_at := null;
  end if;
  return new;
end;
$$;
create trigger company_location_tago_reset before update on public.company_locations
  for each row execute function private.company_location_tago_reset();
