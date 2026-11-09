"use server";

import { refresh } from "next/cache";
import { geocodeAddress } from "@/lib/bus/server";
import { createClient } from "@/lib/supabase/server";

// 회사 위치(D-243): 주소 → 카카오 좌표 → 저장(관리자만·이력은 DB 함수). 주변 정류장 수를 바로 돌려준다
export type LocationResult =
  | { ok: true; found: string; region: string; stops: { ars_id: string; name: string; meters: number }[]; fallback: boolean }
  | { ok: false; error: string };

export async function saveCompanyLocationAction(address: string): Promise<LocationResult> {
  const a = address.trim();
  if (a.length < 2) return { ok: false, error: "주소를 넣어 주세요." };
  const g = await geocodeAddress(a);
  if (!g) return { ok: false, error: "주소로 위치를 찾지 못했어요. 도로명 주소(예: 서울 중구 세종대로 110)로 다시 넣어 주세요." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("company_location_save", { p_address: a, p_found: g.found, p_lat: g.lat, p_lng: g.lng, p_region: g.region });
  if (error) return { ok: false, error: error.message.includes("NOT_ALLOWED") ? "관리자만 바꿀 수 있어요." : "저장하지 못했어요. 잠시 뒤 다시 해 주세요." };
  const d = data as unknown as { stops: { ars_id: string; name: string; meters: number }[]; fallback: boolean };
  refresh();
  return { ok: true, found: g.found, region: g.region, stops: g.region === "서울" ? d.stops : [], fallback: d.fallback };
}
