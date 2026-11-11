// 서울 밖 주변 버스(D-254): 국토교통부 TAGO — 버스정류소정보(좌표 근처 정류장) + 버스도착정보(정류장별 도착 예정). 순수 함수
// 정류장 키 = "t{도시코드}-{정류장ID}"(서울 정류장 번호 5자리와 겹치지 않음). 화면에 보이는 번호는 nodeno
import type { BusRoute, StationArrivals } from "./arrivals";

export type TagoStop = { key: string; city: string; node: string; no: string | null; name: string; lat: number; lng: number; meters: number };

const KEY = /^t(\d{1,6})-([A-Za-z0-9]{4,24})$/;
export const isTagoKey = (k: string) => KEY.test(k);
export function tagoKey(city: string | number, node: string): string {
  return `t${city}-${node}`;
}
export function parseTagoKey(k: string): { city: string; node: string } | null {
  const m = KEY.exec(k);
  return m ? { city: m[1], node: m[2] } : null;
}

type Raw = Record<string, string | number | null | undefined>;
function items(json: unknown): Raw[] {
  const it = (json as { response?: { body?: { items?: { item?: Raw[] | Raw } | "" } } })?.response?.body?.items;
  const raw = it && typeof it === "object" ? it.item : undefined;
  return Array.isArray(raw) ? raw : raw ? [raw] : [];
}
export function tagoResultCode(json: unknown): string | null {
  return (json as { response?: { header?: { resultCode?: string } } })?.response?.header?.resultCode ?? null;
}

function meters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const a = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lng2 - lng1) / 2) ** 2;
  return Math.round(2 * 6371000 * Math.asin(Math.sqrt(a)));
}

// getCrdntPrxmtSttnList → 가까운 순(반경 500m, TAGO가 정함). 같은 정류장 ID가 두 번 오면 하나만
export function parseTagoNearby(json: unknown, lat: number, lng: number): TagoStop[] {
  const seen = new Set<string>();
  const out: TagoStop[] = [];
  for (const i of items(json)) {
    const city = String(i.citycode ?? "").trim();
    const node = String(i.nodeid ?? "").trim();
    const la = Number(i.gpslati);
    const lo = Number(i.gpslong);
    if (!city || !node || !Number.isFinite(la) || !Number.isFinite(lo)) continue;
    const key = tagoKey(city, node);
    if (!isTagoKey(key) || seen.has(key)) continue;
    seen.add(key);
    out.push({ key, city, node, no: i.nodeno == null || i.nodeno === "" ? null : String(i.nodeno), name: String(i.nodenm ?? "").trim() || "정류장", lat: la, lng: lo, meters: meters(lat, lng, la, lo) });
  }
  return out.sort((a, b) => a.meters - b.meters);
}

// getSttnAcctoArvlPrearngeInfoList → 노선마다 첫 번째·두 번째 버스. arrtime = 도착까지 남은 초, arrprevstationcnt = 남은 정류장 수
// 차량 번호가 없어 알림은 노선 ID로 따라간다(그 노선의 첫 버스 기준 10분·5분 전 한 번씩)
export function parseTagoArrivals(json: unknown): StationArrivals {
  const by = new Map<string, Raw[]>();
  let station: string | null = null;
  for (const i of items(json)) {
    const id = String(i.routeid ?? "").trim();
    if (!id) continue;
    station ??= i.nodenm ? String(i.nodenm) : null;
    by.set(id, [...(by.get(id) ?? []), i]);
  }
  const routes: BusRoute[] = [];
  for (const [id, list] of by) {
    const sorted = list.map((x) => ({ x, sec: Number(x.arrtime) })).filter((v) => Number.isFinite(v.sec)).sort((a, b) => a.sec - b.sec);
    const first = sorted[0];
    const second = sorted[1];
    const away = (v: { x: Raw } | undefined) => (v && v.x.arrprevstationcnt != null ? `[${v.x.arrprevstationcnt}번째 전]` : "");
    routes.push({
      route_id: id,
      route_no: String(list[0].routeno ?? ""),
      route_type: `tago:${String(list[0].routetp ?? "")}`,
      direction: null,
      next_stop: null,
      arr1_sec: first ? first.sec : null,
      arr1_msg: first ? away(first) : "도착 정보 없음",
      arr2_sec: second ? second.sec : null,
      arr2_msg: second ? away(second) : "도착 정보 없음",
      veh1: first ? id : null,
      veh2: null,
      is_last1: false,
      congestion: null,
      term: null,
    });
  }
  routes.sort((a, b) => (a.arr1_sec ?? 1e9) - (b.arr1_sec ?? 1e9) || a.route_no.localeCompare(b.route_no, "ko", { numeric: true }));
  return { station_name: station, routes };
}

// 서울 밖 노선 종류 색(TAGO routetp 글자)
export const TAGO_ROUTE_TYPE: Record<string, { label: string; cls: string }> = {
  간선버스: { label: "간선", cls: "bg-blue-700" },
  지선버스: { label: "지선", cls: "bg-green-700" },
  마을버스: { label: "마을", cls: "bg-lime-700" },
  일반버스: { label: "일반", cls: "bg-teal-700" },
  좌석버스: { label: "좌석", cls: "bg-sky-700" },
  직행좌석버스: { label: "직행", cls: "bg-red-700" },
  광역버스: { label: "광역", cls: "bg-red-700" },
  급행버스: { label: "급행", cls: "bg-red-700" },
  공항버스: { label: "공항", cls: "bg-sky-700" },
  순환버스: { label: "순환", cls: "bg-amber-700" },
  농어촌버스: { label: "농어촌", cls: "bg-emerald-700" },
};
