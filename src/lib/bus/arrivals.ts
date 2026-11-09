// 주변 버스(D-243, spec/features/bus.md) — 서울시 getStationByUid 응답 다루기. 순수 함수
// traTime1/2 = 도착까지 남은 초(가져온 시각 기준). 화면은 지난 시간만큼 빼서 보여 주고 3분마다 새로 가져온다
export type BusRoute = {
  route_id: string;
  route_no: string;
  route_type: string; // 1 공항 2 마을 3 간선 4 지선 5 순환 6 광역 7 인천 8 경기 9 폐지 0 공용 14 한강
  direction: string | null;
  next_stop: string | null;
  arr1_sec: number | null; // null = 운행 안 함(운행종료·출발대기 등)
  arr1_msg: string;
  arr2_sec: number | null;
  arr2_msg: string;
  veh1: string | null;
  veh2: string | null;
  is_last1: boolean;
  congestion: number | null; // 3 여유 4 보통 5 혼잡
  term: number | null; // 배차 간격(분)
};
export type StationArrivals = { station_name: string | null; routes: BusRoute[] };

export const STALE_SEC = 180; // 3분
export const NOT_RUNNING = /운행종료|출발대기|회차대기|운행대기|도착정보 없음/;

type RawItem = Record<string, string | null | undefined>;
const num = (v: string | null | undefined) => {
  const n = Number(String(v ?? "").trim());
  return Number.isFinite(n) ? n : null;
};

export function parseStationByUid(json: unknown): StationArrivals {
  const body = (json as { msgBody?: { itemList?: RawItem[] | RawItem | null } })?.msgBody;
  const raw = body?.itemList;
  const items: RawItem[] = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const routes = items.map((i): BusRoute => {
    const m1 = String(i.arrmsg1 ?? "").trim();
    const m2 = String(i.arrmsg2 ?? "").trim();
    const run1 = m1 !== "" && !NOT_RUNNING.test(m1);
    const run2 = m2 !== "" && !NOT_RUNNING.test(m2);
    return {
      route_id: String(i.busRouteId ?? ""),
      route_no: String(i.rtNm ?? i.busRouteAbrv ?? "").trim(),
      route_type: String(i.routeType ?? "").trim(),
      direction: (i.adirection ?? "").trim() || null,
      next_stop: (i.nxtStn ?? "").trim() || null,
      arr1_sec: run1 ? num(i.traTime1) : null,
      arr1_msg: m1 || "도착 정보 없음",
      arr2_sec: run2 ? num(i.traTime2) : null,
      arr2_msg: m2 || "도착 정보 없음",
      veh1: (i.vehId1 ?? "").trim() && i.vehId1 !== "0" ? String(i.vehId1).trim() : null,
      veh2: (i.vehId2 ?? "").trim() && i.vehId2 !== "0" ? String(i.vehId2).trim() : null,
      is_last1: String(i.isLast1 ?? "") === "1",
      congestion: num(i.congestion1) || null,
      term: num(i.term),
    };
  });
  routes.sort((a, b) => (a.arr1_sec ?? 1e9) - (b.arr1_sec ?? 1e9) || a.route_no.localeCompare(b.route_no, "ko"));
  return { station_name: String(items[0]?.stNm ?? "").trim() || null, routes };
}

// 가져온 뒤 지난 시간만큼 뺀 남은 초
export function remainingSec(sec: number | null, fetchedAt: string, now: Date = new Date()): number | null {
  if (sec === null) return null;
  return Math.max(0, sec - Math.floor((now.getTime() - new Date(fetchedAt).getTime()) / 1000));
}
// "곧 도착" · "약 4분 후" · 운행 안 하면 원래 문구
export function arrivalLabel(sec: number | null, msg: string): string {
  if (sec === null) return msg.replace(/\[.*$/, "").trim() || "도착 정보 없음";
  if (sec <= 60) return "곧 도착";
  return `약 ${Math.ceil(sec / 60)}분 후`;
}
// "[2번째 전]" → "2번째 전"(가져온 시각 기준)
export function stopsAway(msg: string): string | null {
  const m = /\[(\d+)번째 전\]/.exec(msg);
  return m ? `${m[1]}번째 전` : null;
}
export function isStale(fetchedAt: string | null, now: Date = new Date(), maxSec = STALE_SEC): boolean {
  return !fetchedAt || now.getTime() - new Date(fetchedAt).getTime() >= maxSec * 1000;
}

export const ROUTE_TYPE: Record<string, { label: string; cls: string }> = {
  "1": { label: "공항", cls: "bg-sky-700" },
  "2": { label: "마을", cls: "bg-lime-700" },
  "3": { label: "간선", cls: "bg-blue-700" },
  "4": { label: "지선", cls: "bg-green-700" },
  "5": { label: "순환", cls: "bg-amber-700" },
  "6": { label: "광역", cls: "bg-red-700" },
  "7": { label: "인천", cls: "bg-cyan-700" },
  "8": { label: "경기", cls: "bg-teal-700" },
  "0": { label: "공용", cls: "bg-zinc-700" },
  "14": { label: "한강", cls: "bg-indigo-700" },
};
export const CONGESTION: Record<number, string> = { 3: "여유", 4: "보통", 5: "혼잡" };

// 알림 판단(직원당 1개, 도착 10분 전·5분 전). 첫 번째 버스 기준, 차량이 바뀌면 그 차량으로 다시
export type AlertState = { last_veh: string | null; sent10: boolean; sent5: boolean };
export function alertDecision(route: BusRoute | undefined, fetchedAt: string, a: AlertState, now: Date = new Date()): { kind: "10" | "5"; veh: string; sec: number } | null {
  if (!route || route.arr1_sec === null || !route.veh1) return null;
  const sec = remainingSec(route.arr1_sec, fetchedAt, now)!;
  const fresh = a.last_veh !== route.veh1; // 새 차량이면 표시 초기화
  const sent10 = fresh ? false : a.sent10;
  const sent5 = fresh ? false : a.sent5;
  if (sec <= 300 && !sent5) return { kind: "5", veh: route.veh1, sec };
  if (sec <= 600 && sec > 300 && !sent10) return { kind: "10", veh: route.veh1, sec };
  return null;
}
// 알림 정류장은 버스가 12분 안이면 1분마다, 아니면 3분마다 다시 가져온다
export function alertNeedsFetch(route: BusRoute | undefined, fetchedAt: string | null, now: Date = new Date()): boolean {
  if (!fetchedAt) return true;
  const age = (now.getTime() - new Date(fetchedAt).getTime()) / 1000;
  if (age >= STALE_SEC) return true;
  const sec = route ? remainingSec(route.arr1_sec, fetchedAt, now) : null;
  return age >= 60 && sec !== null && sec <= 720;
}
export function alertMessage(routeNo: string, sec: number, stationName: string, arsId: string, direction: string | null, msg: string): string {
  const mins = Math.max(1, Math.round(sec / 60));
  const away = stopsAway(msg);
  return [
    `${routeNo}번 버스 약 ${mins}분 후 도착`,
    `정류장: ${stationName}(${arsId})${direction ? ` · ${direction} 방면` : ""}${away ? ` · ${away}` : ""}`,
    "참고용이에요. 실제와 1~3분 차이가 날 수 있어요.",
  ].join("\n");
}
