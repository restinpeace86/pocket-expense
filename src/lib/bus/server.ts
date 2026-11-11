import "server-only";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isStale, parseStationByUid, type BusRoute } from "./arrivals";
import { parseTagoArrivals, parseTagoKey, parseTagoNearby, tagoResultCode } from "./tago";

// 주변 버스(D-243): 카카오 주소 → 좌표, 서울시 getStationByUid 가져오기(하루 호출 수 지킴) · 우리 DB에 저장
type Admin = NonNullable<ReturnType<typeof createAdminClient>>;
export type Nearby = {
  address: string;
  found_address: string | null;
  jibun_address?: string | null; // D-251: 우편번호 검색으로 고른 지번·우편번호(이전 저장분은 없음)
  zonecode?: string | null;
  lat: number;
  lng: number;
  region: string;
  seoul: boolean;
  bus?: boolean; // D-254: 주변 버스를 보여 줄 수 있음(서울 또는 TAGO 정류장 있음)
  company_id?: string;
  tago_at?: string | null;
  updated_by_name: string | null;
  updated_at: string;
  stops: NearStop[];
  fallback: boolean;
} | null;
// D-251: 지도용 좌표(144부터). 이전 응답 호환을 위해 선택
export type NearStop = { ars_id: string; name: string; meters: number; lat?: number; lng?: number; no?: string | null }; // no = 화면에 보이는 정류장 번호(TAGO)
export type StationData = { ars_id: string; station_name: string | null; routes: BusRoute[]; fetched_at: string | null; error: string | null };

export const getCompanyNearby = cache(async (): Promise<Nearby> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("bus_company_nearby");
  if (error) return null;
  const n = (data as unknown as Nearby) ?? null;
  // 서울 밖(D-254): TAGO 근처 정류장을 받은 적 없거나 7일 지났으면 새로 받아 저장하고 다시 읽는다
  if (n && !n.seoul && n.company_id && (!n.tago_at || Date.now() - new Date(n.tago_at).getTime() > TAGO_REFRESH_MS)) {
    const admin = createAdminClient();
    if (admin && (await refreshTagoStops(admin, n.company_id, n.lat, n.lng))) {
      const again = await supabase.rpc("bus_company_nearby");
      if (!again.error) return (again.data as unknown as Nearby) ?? n;
    }
  }
  return n;
});

const TAGO_REFRESH_MS = 7 * 86_400_000;
const TAGO = "https://apis.data.go.kr/1613000";

// TAGO 좌표 근처 정류장(반경 500m) → 회사 위치에 저장. 서버 키로만
export async function refreshTagoStops(admin: Admin, companyId: string, lat: number, lng: number): Promise<boolean> {
  const key = process.env.DATA_GO_KR_API_KEY;
  if (!key) return false;
  const { data: allowed } = await admin.rpc("bus_api_take", { p_n: 1 });
  if (allowed === false) return false;
  const r = await fetch(`${TAGO}/BusSttnInfoInqireService/getCrdntPrxmtSttnList?serviceKey=${encodeURIComponent(key)}&gpsLati=${lat}&gpsLong=${lng}&numOfRows=50&pageNo=1&_type=json`, {
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  }).catch(() => null);
  if (!r?.ok) return false;
  const j = await r.json().catch(() => null);
  if (!j || tagoResultCode(j) !== "00") return false;
  const stops = parseTagoNearby(j, lat, lng).slice(0, 50);
  const { error } = await admin.from("company_locations").update({ tago_stops: stops, tago_at: new Date().toISOString() }).eq("company_id", companyId);
  return !error;
}

type KakaoDoc = { address_name: string; x: string; y: string; road_address?: { address_name: string; region_1depth_name: string } | null; address?: { region_1depth_name: string } | null };

export async function geocodeAddress(address: string): Promise<{ found: string; lat: number; lng: number; region: string } | null> {
  const key = process.env.KAKAO_REST_API_KEY;
  if (!key) return null;
  const r = await fetch(`https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(address)}&size=1`, {
    headers: { Authorization: `KakaoAK ${key}` },
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  }).catch(() => null);
  if (!r?.ok) return null;
  const j = (await r.json().catch(() => null)) as { documents?: KakaoDoc[] } | null;
  const d = j?.documents?.[0];
  if (!d) return null;
  return { found: d.road_address?.address_name ?? d.address_name, lat: Number(d.y), lng: Number(d.x), region: d.road_address?.region_1depth_name ?? d.address?.region_1depth_name ?? "" };
}

// 정류장 도착 정보: 서울 = 서울시 정류소정보조회, 서울 밖 = TAGO 버스도착정보(D-254) — 실패하면 이유를 돌려준다(키 문제·한도·응답 이상)
export async function fetchStation(admin: Admin, arsId: string): Promise<{ ok: true; station_name: string | null; routes: BusRoute[] } | { ok: false; error: string }> {
  const key = process.env.DATA_GO_KR_API_KEY;
  if (!key) return { ok: false, error: "NO_KEY" };
  const { data: allowed } = await admin.rpc("bus_api_take", { p_n: 1 });
  if (allowed === false) return { ok: false, error: "DAILY_LIMIT" };
  const t = parseTagoKey(arsId);
  if (t) {
    const tr = await fetch(`${TAGO}/ArvlInfoInqireService/getSttnAcctoArvlPrearngeInfoList?serviceKey=${encodeURIComponent(key)}&cityCode=${t.city}&nodeId=${encodeURIComponent(t.node)}&numOfRows=100&pageNo=1&_type=json`, {
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    }).catch(() => null);
    if (!tr) return { ok: false, error: "NETWORK" };
    const tj = await tr.json().catch(() => null);
    if (!tj) return { ok: false, error: tr.status === 401 || tr.status === 403 ? "KEY_NOT_REGISTERED" : "BAD_RESPONSE" };
    if (tagoResultCode(tj) !== "00") return { ok: false, error: "BAD_RESPONSE" };
    const tp = parseTagoArrivals(tj);
    await admin.rpc("bus_arrivals_put", { p_ars: arsId, p_station: tp.station_name ?? "", p_routes: tp.routes });
    return { ok: true, ...tp };
  }
  const r = await fetch(`http://ws.bus.go.kr/api/rest/stationinfo/getStationByUid?serviceKey=${encodeURIComponent(key)}&arsId=${arsId}&resultType=json`, {
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  }).catch(() => null);
  if (!r) return { ok: false, error: "NETWORK" };
  if (r.status === 401) return { ok: false, error: "KEY_NOT_REGISTERED" };
  const j = (await r.json().catch(() => null)) as { msgHeader?: { headerCd?: string } } | null;
  if (!j || (j.msgHeader?.headerCd && j.msgHeader.headerCd !== "0" && j.msgHeader.headerCd !== "4")) return { ok: false, error: "BAD_RESPONSE" };
  const parsed = parseStationByUid(j);
  await admin.rpc("bus_arrivals_put", { p_ars: arsId, p_station: parsed.station_name ?? "", p_routes: parsed.routes });
  return { ok: true, ...parsed };
}

// 화면용: 저장된 값이 3분 넘었으면 그때 새로 가져온다
export async function getStation(admin: Admin, arsId: string): Promise<StationData> {
  const { data } = await admin.from("bus_arrivals").select("routes, station_name, fetched_at").eq("ars_id", arsId).maybeSingle();
  if (data && !isStale(data.fetched_at)) return { ars_id: arsId, station_name: data.station_name, routes: data.routes as unknown as BusRoute[], fetched_at: data.fetched_at, error: null };
  const f = await fetchStation(admin, arsId);
  if (f.ok) return { ars_id: arsId, station_name: f.station_name, routes: f.routes, fetched_at: new Date().toISOString(), error: null };
  // 못 가져오면 예전 값이라도(있으면) + 이유
  return { ars_id: arsId, station_name: data?.station_name ?? null, routes: (data?.routes as unknown as BusRoute[]) ?? [], fetched_at: data?.fetched_at ?? null, error: f.error };
}
