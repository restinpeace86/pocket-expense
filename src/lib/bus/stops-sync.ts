import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";

// 서울 버스 정류장 위치 새로 받기(D-243, 주 1회 새벽 작업): 서울 열린데이터 busStopLocationXyInfo → bus_stops
// NODE_ID = 정류소 번호(arsId), STOPS_NO = 정류소 ID. 5자리 번호가 없는 것(선착장 등)은 뺀다. scripts/import-bus-stops.mjs와 같은 일
type Row = { NODE_ID?: string; STOPS_NO?: string; STOPS_NM?: string; XCRD?: string; YCRD?: string };

export async function syncSeoulBusStops(admin: NonNullable<ReturnType<typeof createAdminClient>>): Promise<{ ok: boolean; stops: number }> {
  const key = process.env.SEOUL_OPEN_DATA_KEY;
  if (!key) return { ok: false, stops: 0 };
  const byArs = new Map<string, { ars_id: string; st_id: string | null; name: string; lat: number; lng: number; region: string; updated_at: string }>();
  for (let start = 1; start < 30000; start += 1000) {
    const r = await fetch(`http://openapi.seoul.go.kr:8088/${key}/json/busStopLocationXyInfo/${start}/${start + 999}/`, { signal: AbortSignal.timeout(20000), cache: "no-store" }).catch(() => null);
    const j = r ? ((await r.json().catch(() => null)) as { busStopLocationXyInfo?: { row?: Row[] } } | null) : null;
    const list = j?.busStopLocationXyInfo?.row ?? [];
    for (const s of list) {
      if (!/^\d{5}$/.test(s.NODE_ID ?? "")) continue;
      const lat = Number(s.YCRD);
      const lng = Number(s.XCRD);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      byArs.set(s.NODE_ID!, { ars_id: s.NODE_ID!, st_id: s.STOPS_NO ?? null, name: s.STOPS_NM ?? "", lat, lng, region: "seoul", updated_at: new Date().toISOString() });
    }
    if (list.length < 1000) break;
  }
  if (byArs.size < 5000) return { ok: false, stops: byArs.size }; // 받다 끊긴 것 같으면 덮어쓰지 않는다
  const all = [...byArs.values()];
  for (let i = 0; i < all.length; i += 1000) {
    const { error } = await admin.from("bus_stops").upsert(all.slice(i, i + 1000), { onConflict: "ars_id" });
    if (error) return { ok: false, stops: i };
  }
  return { ok: true, stops: all.length };
}
