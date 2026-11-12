import type { RoutePlaceInput } from "./editor-types";

// 결의서 칸 "내가 전에 쓴 값"(9-12 ③④, D-258). 새 표 없이 내 지난 결의서·영수증에서 읽는다(직원은 원래 자기 것만 봄).
// 순수 함수 — 서버(claim.ts)가 최근 순 행을 넘기면 중복 없이 최근 순으로 고른다.

export type RecentRoute = { start: RoutePlaceInput; end: RoutePlaceInput; roundTrip: boolean; count: number };
export type EditorRecent = {
  clientName: string[];
  meetingPurpose: string[];
  purchasePurpose: string[];
  purchaseItems: string[];
  tripDestination: string[];
  tripPurpose: string[];
  merchants: { name: string; businessNumber: string | null }[];
  places: RoutePlaceInput[];
  routes: RecentRoute[];
  company: RoutePlaceInput | null; // 설정의 회사 위치
};

export const EMPTY_RECENT: EditorRecent = {
  clientName: [],
  meetingPurpose: [],
  purchasePurpose: [],
  purchaseItems: [],
  tripDestination: [],
  tripPurpose: [],
  merchants: [],
  places: [],
  routes: [],
  company: null,
};

const clean = (v: string | null | undefined) => (v ?? "").replace(/\s+/g, " ").trim();

// 최근 순 값 → 비지 않은 값만, 같은 글자는 한 번, 최근 순 limit개
export function recentValues(values: (string | null | undefined)[], limit = 5): string[] {
  const out: string[] = [];
  for (const v of values) {
    const c = clean(v);
    if (!c || out.includes(c)) continue;
    out.push(c);
    if (out.length >= limit) break;
  }
  return out;
}

// 치는 중: 글자가 들어 있는 최근 값(대소문자 무시, 똑같은 값은 빼고)
export function matchRecent(values: string[], q: string, limit = 5): string[] {
  const t = clean(q).toLowerCase();
  if (!t) return [];
  return values.filter((v) => v.toLowerCase().includes(t) && v.toLowerCase() !== t).slice(0, limit);
}

// 가맹점 이름 → 가장 최근에 함께 적힌 사업자번호
export function recentMerchants(rows: { merchant_name: string | null; merchant_business_number: string | null }[], limit = 30): EditorRecent["merchants"] {
  const out: EditorRecent["merchants"] = [];
  for (const r of rows) {
    const name = clean(r.merchant_name);
    if (!name) continue;
    const bn = clean(r.merchant_business_number) || null;
    const had = out.find((m) => m.name === name);
    if (had) {
      if (!had.businessNumber && bn) had.businessNumber = bn;
      continue;
    }
    if (out.length < limit) out.push({ name, businessNumber: bn });
  }
  return out;
}

type RouteRow = {
  start_location: string | null;
  start_lat: number | null;
  start_lng: number | null;
  end_location: string | null;
  end_lat: number | null;
  end_lng: number | null;
  is_round_trip: boolean | null;
  route_evidence?: unknown;
};
const place = (name: string | null, lat: number | null, lng: number | null, address: unknown): RoutePlaceInput | null => {
  const n = clean(name);
  return n && lat != null && lng != null ? { name: n, lat: Number(lat), lng: Number(lng), address: typeof address === "string" && address ? address : null } : null;
};
const ev = (r: RouteRow) => (r.route_evidence && typeof r.route_evidence === "object" ? (r.route_evidence as Record<string, unknown>) : {});

// 지난 운행의 장소(출발·도착) → 이름으로 한 번씩, 최근 순. 회사 위치와 같은 이름은 뺀다([회사] 버튼이 따로 있음)
export function recentPlaces(rows: RouteRow[], company: RoutePlaceInput | null, limit = 4): RoutePlaceInput[] {
  const out: RoutePlaceInput[] = [];
  for (const r of rows) {
    const e = ev(r);
    for (const p of [place(r.start_location, r.start_lat, r.start_lng, e.start_address), place(r.end_location, r.end_lat, r.end_lng, e.end_address)]) {
      if (!p || out.some((x) => x.name === p.name) || (company && p.name === company.name)) continue;
      out.push(p);
      if (out.length >= limit) return out;
    }
  }
  return out;
}

// 자주 다닌 길: 같은 출발 → 도착(이름) 묶어서 횟수 많은 순, 같으면 최근 순. 왕복 여부는 가장 최근 운행 그대로
export function frequentRoutes(rows: RouteRow[], limit = 3): RecentRoute[] {
  const map = new Map<string, RecentRoute & { order: number }>();
  rows.forEach((r, i) => {
    const e = ev(r);
    const s = place(r.start_location, r.start_lat, r.start_lng, e.start_address);
    const d = place(r.end_location, r.end_lat, r.end_lng, e.end_address);
    if (!s || !d) return;
    const key = `${s.name}→${d.name}`;
    const had = map.get(key);
    if (had) had.count++;
    else map.set(key, { start: s, end: d, roundTrip: r.is_round_trip === true, count: 1, order: i });
  });
  return [...map.values()]
    .sort((a, b) => b.count - a.count || a.order - b.order)
    .slice(0, limit)
    .map((r) => ({ start: r.start, end: r.end, roundTrip: r.roundTrip, count: r.count }));
}
