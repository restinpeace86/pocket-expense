-- 142: 회사 위치 = 우편번호 검색으로 고른 주소 (D-251 ⑥, todo_improvement 개선사항 2)
-- 도로명(address) + 지번 + 우편번호를 함께 저장. 좌표는 지금처럼 서버가 카카오로 찾아 넣는다(위치 기반 기능 대비)
alter table public.company_locations
  add column jibun_address text check (jibun_address is null or char_length(jibun_address) <= 200),
  add column zonecode text check (zonecode is null or zonecode ~ '^[0-9]{5}$');

drop function public.company_location_save(text, text, double precision, double precision, text);
create function public.company_location_save(p_address text, p_found text, p_lat double precision, p_lng double precision, p_region text,
  p_jibun text default null, p_zonecode text default null)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_me public.members := private.require_admin();
  v_old text;
begin
  if char_length(btrim(coalesce(p_address, ''))) not between 2 and 200 or p_lat is null or p_lng is null or p_lat not between 33 and 39 or p_lng not between 124 and 132
     or char_length(coalesce(p_jibun, '')) > 200 or (p_zonecode is not null and p_zonecode !~ '^[0-9]{5}$') then
    raise exception 'INVALID';
  end if;
  select address into v_old from public.company_locations where company_id = v_me.company_id;
  insert into public.company_locations (company_id, address, found_address, lat, lng, region, jibun_address, zonecode, updated_by, updated_by_name, updated_at)
  values (v_me.company_id, btrim(p_address), p_found, p_lat, p_lng, coalesce(p_region, ''), nullif(btrim(coalesce(p_jibun, '')), ''), p_zonecode, v_me.id, v_me.name, now())
  on conflict (company_id) do update set address = excluded.address, found_address = excluded.found_address, lat = excluded.lat, lng = excluded.lng,
    region = excluded.region, jibun_address = excluded.jibun_address, zonecode = excluded.zonecode,
    updated_by = excluded.updated_by, updated_by_name = excluded.updated_by_name, updated_at = now();
  if v_old is distinct from btrim(p_address) then
    insert into public.company_location_history (company_id, member_name, from_address, to_address) values (v_me.company_id, v_me.name, v_old, btrim(p_address));
  end if;
  return private.bus_nearby(p_lat, p_lng);
end;
$$;
revoke all on function public.company_location_save(text, text, double precision, double precision, text, text, text) from public, anon;
grant execute on function public.company_location_save(text, text, double precision, double precision, text, text, text) to authenticated;

-- 회사 위치 + 주변 정류장: 지번·우편번호도 돌려준다
create or replace function public.bus_company_nearby()
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_company uuid := private.current_company_id();
  l public.company_locations;
begin
  if v_company is null or private.current_member_id() is null then raise exception 'NOT_ALLOWED' using errcode = '42501'; end if;
  select * into l from public.company_locations where company_id = v_company;
  if not found then return null; end if;
  return jsonb_build_object('address', l.address, 'found_address', l.found_address, 'lat', l.lat, 'lng', l.lng, 'region', l.region,
    'jibun_address', l.jibun_address, 'zonecode', l.zonecode,
    'seoul', l.region = '서울', 'updated_by_name', l.updated_by_name, 'updated_at', l.updated_at)
    || case when l.region = '서울' then private.bus_nearby(l.lat, l.lng) else jsonb_build_object('stops', '[]'::jsonb, 'fallback', false) end;
end;
$$;
