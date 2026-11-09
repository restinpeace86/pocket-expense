-- =============================================================================
-- 132_bus.sql — 회사 주변 버스 도착 정보 (D-243, spec/features/bus.md)
-- - bus_stops: 서울 정류장 위치(서울 열린데이터 busStopLocationXyInfo, 서버가 주 1회 새로 받음). ars_id = 정류소 번호(getStationByUid의 arsId)
-- - company_locations: 관리자가 넣은 회사 주소 → 카카오 좌표(서버가 찾음). 바꾸면 이력
-- - bus_arrivals: 정류장마다 마지막으로 가져온 전 노선 도착 값(getStationByUid). 화면·알림은 이 값을 본다
-- - bus_api_calls: 하루 호출 수(한도 10,000 — 9,000에서 멈춤)
-- - bus_alerts: 직원당 1개, 켠 뒤 30분. 도착 10분 전·5분 전 [알림]방 + 휴대폰, 놓치면 다음 같은 번호(차량이 바뀌면 다시)
-- =============================================================================

create table public.bus_stops (
  ars_id text primary key check (ars_id ~ '^\d{5}$'),
  st_id text,
  name text not null,
  lat double precision not null,
  lng double precision not null,
  region text not null default 'seoul',
  updated_at timestamptz not null default now()
);
create index bus_stops_lat_lng on public.bus_stops (lat, lng);
alter table public.bus_stops enable row level security;
alter table public.bus_stops force row level security;
revoke all on public.bus_stops from anon, authenticated;
grant select on public.bus_stops to authenticated;
create policy bus_stops_select on public.bus_stops for select to authenticated using (true);

create table public.company_locations (
  company_id uuid primary key references public.companies (id) on delete cascade,
  address text not null check (char_length(address) between 2 and 200),
  found_address text,
  lat double precision not null,
  lng double precision not null,
  region text not null, -- '서울' 등 시·도(카카오 region_1depth_name)
  updated_by uuid,
  updated_by_name text,
  updated_at timestamptz not null default now()
);
alter table public.company_locations enable row level security;
alter table public.company_locations force row level security;
revoke all on public.company_locations from anon, authenticated;
grant select on public.company_locations to authenticated;
create policy company_locations_select on public.company_locations for select to authenticated
  using (company_id = (select private.current_company_id()));

create table public.company_location_history (
  id bigint generated always as identity primary key,
  company_id uuid not null references public.companies (id) on delete cascade,
  member_name text,
  from_address text,
  to_address text not null,
  at timestamptz not null default now()
);
alter table public.company_location_history enable row level security;
alter table public.company_location_history force row level security;
revoke all on public.company_location_history from anon, authenticated;
grant select on public.company_location_history to authenticated;
create policy company_location_history_select on public.company_location_history for select to authenticated
  using (company_id = (select private.current_company_id()) and (select private.is_admin()));

create table public.bus_arrivals (
  ars_id text primary key,
  routes jsonb not null, -- [{route_id, route_no, route_type, direction, next_stop, arr1_sec, arr1_msg, arr2_sec, arr2_msg, veh1, veh2, is_last1, congestion, term}]
  station_name text,
  fetched_at timestamptz not null default now()
);
alter table public.bus_arrivals enable row level security;
alter table public.bus_arrivals force row level security;
revoke all on public.bus_arrivals from anon, authenticated; -- 화면은 서버(service role)가 읽어 넘긴다

create table public.bus_api_calls (
  day date primary key,
  count integer not null default 0
);
alter table public.bus_api_calls enable row level security;
alter table public.bus_api_calls force row level security;
revoke all on public.bus_api_calls from anon, authenticated;

create table public.bus_alerts (
  member_id uuid primary key,
  company_id uuid not null references public.companies (id) on delete cascade,
  ars_id text not null,
  station_name text not null,
  route_id text not null,
  route_no text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_veh text, -- 지금 따라가는 차량(바뀌면 10분·5분 표시를 새로)
  sent10 boolean not null default false,
  sent5 boolean not null default false,
  foreign key (member_id, company_id) references public.members (id, company_id) on delete cascade
);
create index bus_alerts_active on public.bus_alerts (expires_at);
alter table public.bus_alerts enable row level security;
alter table public.bus_alerts force row level security;
revoke all on public.bus_alerts from anon, authenticated;
grant select on public.bus_alerts to authenticated;
create policy bus_alerts_select on public.bus_alerts for select to authenticated
  using (member_id = (select private.current_member_id()));

-- ── 거리(미터) ──────────────────────────────────────────────────────────────
create or replace function private.meters_between(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
returns double precision
language sql immutable
set search_path = ''
as $$
  select 2 * 6371000 * asin(sqrt(power(sin(radians(lat2 - lat1) / 2), 2) + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)))
$$;

-- 회사에서 가까운 정류장: 200m 안 가까운 순 5곳, 없으면 500m 안 3곳(fallback = true)
create or replace function private.bus_nearby(p_lat double precision, p_lng double precision)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare v jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object('ars_id', x.ars_id, 'name', x.name, 'meters', round(x.m)) order by x.m), '[]'::jsonb) into v
  from (select s.ars_id, s.name, private.meters_between(p_lat, p_lng, s.lat, s.lng) m from public.bus_stops s
        where s.lat between p_lat - 0.0025 and p_lat + 0.0025 and s.lng between p_lng - 0.003 and p_lng + 0.003) x
  where x.m <= 200 order by x.m limit 5;
  if jsonb_array_length(v) > 0 then return jsonb_build_object('stops', v, 'fallback', false); end if;
  select coalesce(jsonb_agg(jsonb_build_object('ars_id', x.ars_id, 'name', x.name, 'meters', round(x.m)) order by x.m), '[]'::jsonb) into v
  from (select s.ars_id, s.name, private.meters_between(p_lat, p_lng, s.lat, s.lng) m from public.bus_stops s
        where s.lat between p_lat - 0.006 and p_lat + 0.006 and s.lng between p_lng - 0.007 and p_lng + 0.007) x
  where x.m <= 500 order by x.m limit 3;
  return jsonb_build_object('stops', v, 'fallback', true);
end;
$$;

-- ── 관리자: 회사 위치 저장(좌표는 서버가 카카오로 찾아 넘김) ─────────────────
create or replace function public.company_location_save(p_address text, p_found text, p_lat double precision, p_lng double precision, p_region text)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_me public.members := private.require_admin();
  v_old text;
begin
  if char_length(btrim(coalesce(p_address, ''))) not between 2 and 200 or p_lat is null or p_lng is null or p_lat not between 33 and 39 or p_lng not between 124 and 132 then
    raise exception 'INVALID';
  end if;
  select address into v_old from public.company_locations where company_id = v_me.company_id;
  insert into public.company_locations (company_id, address, found_address, lat, lng, region, updated_by, updated_by_name, updated_at)
  values (v_me.company_id, btrim(p_address), p_found, p_lat, p_lng, coalesce(p_region, ''), v_me.id, v_me.name, now())
  on conflict (company_id) do update set address = excluded.address, found_address = excluded.found_address, lat = excluded.lat, lng = excluded.lng,
    region = excluded.region, updated_by = excluded.updated_by, updated_by_name = excluded.updated_by_name, updated_at = now();
  if v_old is distinct from btrim(p_address) then
    insert into public.company_location_history (company_id, member_name, from_address, to_address) values (v_me.company_id, v_me.name, v_old, btrim(p_address));
  end if;
  return private.bus_nearby(p_lat, p_lng);
end;
$$;

-- 회사 위치 + 주변 정류장(회사 멤버). 서울이 아니면 stops 없이
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
    'seoul', l.region = '서울', 'updated_by_name', l.updated_by_name, 'updated_at', l.updated_at)
    || case when l.region = '서울' then private.bus_nearby(l.lat, l.lng) else jsonb_build_object('stops', '[]'::jsonb, 'fallback', false) end;
end;
$$;

-- 이 정류장이 우리 회사 주변(200m 5곳 또는 500m 3곳) 안인가 — 다른 정류장 엿보기·호출 낭비 막기
create or replace function private.bus_stop_allowed(p_company uuid, p_ars text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.company_locations l, jsonb_array_elements(private.bus_nearby(l.lat, l.lng) -> 'stops') e
                 where l.company_id = p_company and l.region = '서울' and e ->> 'ars_id' = p_ars)
$$;

-- ── 직원: 버스 알림(직원당 1개, 30분) ───────────────────────────────────────
create or replace function public.bus_alert_set(p_ars text, p_route_id text, p_route_no text, p_station_name text)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_me public.members := private.require_member();
  v_old public.bus_alerts;
  a public.bus_alerts;
begin
  if not private.bus_stop_allowed(v_me.company_id, p_ars) then raise exception 'STOP_NOT_NEARBY'; end if;
  if not private.feature_enabled(v_me.company_id, 'messenger') then raise exception 'NO_MESSENGER'; end if;
  if coalesce(p_route_id, '') = '' or char_length(coalesce(p_route_no, '')) not between 1 and 30 then raise exception 'INVALID'; end if;
  select * into v_old from public.bus_alerts where member_id = v_me.id;
  insert into public.bus_alerts (member_id, company_id, ars_id, station_name, route_id, route_no, created_at, expires_at)
  values (v_me.id, v_me.company_id, p_ars, left(coalesce(p_station_name, ''), 60), p_route_id, p_route_no, now(), now() + interval '30 minutes')
  on conflict (member_id) do update set ars_id = excluded.ars_id, station_name = excluded.station_name, route_id = excluded.route_id, route_no = excluded.route_no,
    created_at = now(), expires_at = excluded.expires_at, last_veh = null, sent10 = false, sent5 = false
  returning * into a;
  return jsonb_build_object('route_no', a.route_no, 'expires_at', a.expires_at, 'replaced', case when v_old.member_id is not null and v_old.expires_at > now() then v_old.route_no end);
end;
$$;

create or replace function public.bus_alert_off()
returns void
language sql security definer
set search_path = ''
as $$ delete from public.bus_alerts where member_id = private.current_member_id() $$;

-- ── 서버 전용(service role): 호출 수 · 도착 값 저장 · 알림 보내기 ────────────
-- 하루 9,000번까지 허용(한도 10,000). 허용되면 true
create or replace function public.bus_api_take(p_n integer default 1)
returns boolean
language plpgsql security definer
set search_path = ''
as $$
declare v integer;
begin
  insert into public.bus_api_calls (day, count) values ((now() at time zone 'Asia/Seoul')::date, p_n)
  on conflict (day) do update set count = public.bus_api_calls.count + p_n
  returning count into v;
  return v <= 9000;
end;
$$;

create or replace function public.bus_arrivals_put(p_ars text, p_station text, p_routes jsonb)
returns void
language sql security definer
set search_path = ''
as $$
  insert into public.bus_arrivals (ars_id, routes, station_name, fetched_at) values (p_ars, p_routes, p_station, now())
  on conflict (ars_id) do update set routes = excluded.routes, station_name = coalesce(excluded.station_name, public.bus_arrivals.station_name), fetched_at = now()
$$;

-- 알림 보내기: [알림]방 글(메신저 켠 회사만) + 보낸 표시. p_kind: '10' | '5'
create or replace function public.bus_alert_notify(p_member uuid, p_kind text, p_veh text, p_body text)
returns boolean
language plpgsql security definer
set search_path = ''
as $$
declare a public.bus_alerts; v_room uuid;
begin
  select * into a from public.bus_alerts where member_id = p_member and expires_at > now() for update;
  if not found then return false; end if;
  if a.last_veh is distinct from p_veh then
    update public.bus_alerts set last_veh = p_veh, sent10 = false, sent5 = false where member_id = p_member returning * into a;
  end if;
  if (p_kind = '10' and a.sent10) or (p_kind = '5' and a.sent5) then return false; end if;
  update public.bus_alerts set sent10 = sent10 or p_kind in ('10', '5'), sent5 = sent5 or p_kind = '5' where member_id = p_member;
  if not private.feature_enabled(a.company_id, 'messenger') then return false; end if;
  v_room := private.chat_notice_room(a.company_id, p_member);
  insert into public.chat_messages (room_id, company_id, sender_member_id, kind, body, link)
  values (v_room, a.company_id, null, 'notice', p_body, '/workspace/' || a.company_id || '/employee/bus/' || a.ars_id);
  return true;
end;
$$;

-- 따라가는 차량만 바꿈(버스가 지나가 다음 버스로 넘어갈 때)
create or replace function public.bus_alert_track(p_member uuid, p_veh text)
returns void
language sql security definer
set search_path = ''
as $$
  update public.bus_alerts set last_veh = p_veh, sent10 = false, sent5 = false
  where member_id = p_member and last_veh is distinct from p_veh
$$;

-- 끝난 알림 정리
create or replace function public.bus_alerts_cleanup()
returns integer
language sql security definer
set search_path = ''
as $$
  with d as (delete from public.bus_alerts where expires_at < now() - interval '1 minute' returning 1) select count(*)::integer from d
$$;

-- 예약 작업(1분마다): 켜진 알림이 있을 때만 서버 주소를 부른다(주소는 Vault reminder_push_url의 경로만 바꿔 씀)
create or replace function private.bus_tick()
returns void
language plpgsql security definer
set search_path = ''
as $$
declare v_url text; v_secret text;
begin
  if not exists (select 1 from public.bus_alerts where expires_at > now()) then return; end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'reminder_push_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'reminder_push_secret';
  if v_url is null or v_secret is null then return; end if;
  perform net.http_post(url := replace(v_url, '/api/cron/reminder-push', '/api/cron/bus-alerts'), body := '{}'::jsonb,
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret, 'Content-Type', 'application/json'), timeout_milliseconds := 20000);
end;
$$;

revoke all on function private.meters_between(double precision, double precision, double precision, double precision), private.bus_nearby(double precision, double precision),
  private.bus_stop_allowed(uuid, text), private.bus_tick() from public, anon, authenticated;
revoke all on function public.company_location_save(text, text, double precision, double precision, text), public.bus_company_nearby(),
  public.bus_alert_set(text, text, text, text), public.bus_alert_off() from public, anon;
grant execute on function public.company_location_save(text, text, double precision, double precision, text), public.bus_company_nearby(),
  public.bus_alert_set(text, text, text, text), public.bus_alert_off() to authenticated;
revoke all on function public.bus_api_take(integer), public.bus_arrivals_put(text, text, jsonb), public.bus_alert_notify(uuid, text, text, text),
  public.bus_alert_track(uuid, text), public.bus_alerts_cleanup() from public, anon, authenticated;
grant execute on function public.bus_api_take(integer), public.bus_arrivals_put(text, text, jsonb), public.bus_alert_notify(uuid, text, text, text),
  public.bus_alert_track(uuid, text), public.bus_alerts_cleanup() to service_role;

select cron.schedule('bus-alerts', '* * * * *', 'select private.bus_tick()');
