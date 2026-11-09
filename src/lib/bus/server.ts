import "server-only";
import { cache } from "react";
import type { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isStale, parseStationByUid, type BusRoute } from "./arrivals";

// 주변 버스(D-243): 카카오 주소 → 좌표, 서울시 getStationByUid 가져오기(하루 호출 수 지킴) · 우리 DB에 저장
type Admin = NonNullable<ReturnType<typeof createAdminClient>>;
export type Nearby = {
  address: string;
  found_address: string | null;
  region: string;
  seoul: boolean;
  updated_by_name: string | null;
  updated_at: string;
  stops: { ars_id: string; name: string; meters: number }[];
  fallback: boolean;
} | null;
export type StationData = { ars_id: string; station_name: string | null; routes: BusRoute[]; fetched_at: string | null; error: string | null };

export const getCompanyNearby = cache(async (): Promise<Nearby> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("bus_company_nearby");
  if (error) return null;
  return (data as unknown as Nearby) ?? null;
});

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

// 서울시 정류소정보조회 — 실패하면 이유를 돌려준다(키 문제·한도·응답 이상)
export async function fetchStation(admin: Admin, arsId: string): Promise<{ ok: true; station_name: string | null; routes: BusRoute[] } | { ok: false; error: string }> {
  const key = process.env.PUBLIC_DATA_API_KEY;
  if (!key) return { ok: false, error: "NO_KEY" };
  const { data: allowed } = await admin.rpc("bus_api_take", { p_n: 1 });
  if (allowed === false) return { ok: false, error: "DAILY_LIMIT" };
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
