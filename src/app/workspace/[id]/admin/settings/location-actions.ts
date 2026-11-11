"use server";

import { refresh } from "next/cache";
import { getMembership } from "@/lib/auth/session";
import { geocodeAddress, refreshTagoStops, type Nearby, type NearStop } from "@/lib/bus/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// 회사 위치(D-243 → D-251): 우편번호 검색 창에서 고른 도로명·지번·우편번호 → 카카오 좌표 → 저장(관리자만·이력은 DB 함수)
// 주변 정류장 수를 바로 돌려준다
export type PickedAddress = { road: string; jibun: string; zonecode: string };
export type LocationResult =
  | { ok: true; found: string; region: string; lat: number; lng: number; stops: NearStop[]; fallback: boolean }
  | { ok: false; error: string };

export async function saveCompanyLocationAction(picked: PickedAddress): Promise<LocationResult> {
  const road = picked.road.trim().slice(0, 200);
  const jibun = picked.jibun.trim().slice(0, 200);
  const zonecode = /^[0-9]{5}$/.test(picked.zonecode) ? picked.zonecode : null;
  if (road.length < 2 && jibun.length < 2) return { ok: false, error: "주소 검색에서 주소를 골라 주세요." };
  // 도로명으로 먼저, 안 되면 지번으로 좌표를 찾는다
  const g = (road.length >= 2 ? await geocodeAddress(road) : null) ?? (jibun.length >= 2 ? await geocodeAddress(jibun) : null);
  if (!g) return { ok: false, error: "고른 주소의 위치(좌표)를 찾지 못했어요. 잠시 뒤 다시 골라 주세요." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("company_location_save", {
    p_address: road.length >= 2 ? road : jibun,
    p_found: g.found,
    p_lat: g.lat,
    p_lng: g.lng,
    p_region: g.region,
    p_jibun: jibun || undefined,
    p_zonecode: zonecode ?? undefined,
  });
  if (error) return { ok: false, error: error.message.includes("NOT_ALLOWED") ? "관리자만 바꿀 수 있어요." : "저장하지 못했어요. 잠시 뒤 다시 해 주세요." };
  let d = data as unknown as { stops: NearStop[]; fallback: boolean };
  // 서울 밖(D-254): TAGO 근처 정류장을 바로 받아 저장하고 다시 읽는다
  if (g.region !== "서울") {
    const m = await getMembership();
    const admin = createAdminClient();
    if (m && admin) await refreshTagoStops(admin, m.company_id, g.lat, g.lng);
    const again = await supabase.rpc("bus_company_nearby");
    const n = again.data as unknown as Nearby;
    d = { stops: n?.stops ?? [], fallback: n?.fallback ?? false };
  }
  refresh();
  return { ok: true, found: g.found, region: g.region, lat: g.lat, lng: g.lng, stops: d.stops, fallback: d.fallback };
}
