"use server";

import { refresh } from "next/cache";
import { getCompanyNearby, getStation, type StationData } from "@/lib/bus/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// 버스 알림(D-243): 직원당 1개, 켠 뒤 30분. 주변 정류장인지·메신저를 쓰는지는 DB 함수가 확인
export async function setBusAlertAction(arsId: string, routeId: string, routeNo: string, stationName: string): Promise<{ ok: true; replaced: string | null; expiresAt: string } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("bus_alert_set", { p_ars: arsId, p_route_id: routeId, p_route_no: routeNo, p_station_name: stationName });
  if (error) {
    const m = error.message;
    return {
      ok: false,
      error: m.includes("NO_MESSENGER")
        ? "회사에서 채팅을 쓰지 않아 알림을 보낼 곳이 없어요. 관리자에게 채팅을 켜 달라고 해 주세요."
        : m.includes("STOP_NOT_NEARBY")
          ? "회사 주변 정류장이 아니에요."
          : "알림을 켜지 못했어요. 잠시 뒤 다시 해 주세요.",
    };
  }
  const d = data as unknown as { replaced: string | null; expires_at: string };
  refresh();
  return { ok: true, replaced: d.replaced, expiresAt: d.expires_at };
}

export async function offBusAlertAction(): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("bus_alert_off");
  refresh();
  return { ok: !error };
}

// 주변 버스 아코디언(D-251 개선사항 4): 펼칠 때만 그 정류장 도착 정보. 우리 회사 주변 정류장만(아무 번호나 조회 못 하게)
export async function stationArrivalsAction(arsId: string): Promise<StationData | null> {
  const nearby = await getCompanyNearby();
  if (!nearby?.bus || !nearby.stops.some((s) => s.ars_id === arsId)) return null;
  const admin = createAdminClient();
  if (!admin) return null;
  return getStation(admin, arsId);
}
