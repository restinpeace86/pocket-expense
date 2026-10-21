// 자차 유류비 경로·거리·금액 표시 (trip-expense.md §4.2, D-069, D-085)
// 금액 계산의 원본은 DB(private.recompute_claim: 거리 × 회사 km당 단가, 원 단위 반올림)다. 여기서는 같은 식으로 미리 보여 주기만 한다.
import { formatWon } from "@/lib/format";

export type RouteItem = {
  start_location: string | null;
  end_location: string | null;
  is_round_trip: boolean | null;
  route_one_way_km: number | null;
  distance_km: number | null;
  distance_source: "api" | "manual" | null;
  route_evidence: unknown;
  amount: number | null;
  applied_fuel_rate_per_km: number | null;
};

export type RouteCard = {
  startName: string;
  startAddress: string | null;
  endName: string;
  endAddress: string | null;
  roundTrip: boolean;
  oneWayKm: number;
  totalKm: number;
  rate: number;
  amount: number;
  source: "api" | "manual";
  computedAt: string | null; // 길찾기 계산 시각(api) 또는 직접 입력 시각(manual)
};

const km = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1)}km`;

export function fuelAmount(totalKm: number, rate: number): number {
  return Math.round(totalKm * rate);
}

// "왕복 · 377km × 2 = 754km × 200원 = 150,800원" / "편도 · 128.4km × 200원 = 25,680원"
export function routeFormula(c: Pick<RouteCard, "roundTrip" | "oneWayKm" | "totalKm" | "rate" | "amount">): string {
  const dist = c.roundTrip ? `왕복 · ${km(c.oneWayKm)} × 2 = ${km(c.totalKm)}` : `편도 · ${km(c.totalKm)}`;
  return `${dist} × ${formatWon(c.rate)} = ${formatWon(c.amount)}`;
}

// 거리까지 정해진 자차 항목 → 증빙 카드 내용. 아직 덜 정해졌으면 null
export function routeCardFrom(item: RouteItem, fallbackRate: number): RouteCard | null {
  if (!item.start_location || !item.end_location || item.route_one_way_km == null || item.distance_km == null || !item.distance_source) return null;
  const ev = (item.route_evidence && typeof item.route_evidence === "object" ? item.route_evidence : {}) as Record<string, unknown>;
  const rate = item.applied_fuel_rate_per_km ?? fallbackRate;
  const totalKm = Number(item.distance_km);
  const str = (v: unknown) => (typeof v === "string" && v ? v : null);
  return {
    startName: item.start_location,
    startAddress: str(ev.start_address),
    endName: item.end_location,
    endAddress: str(ev.end_address),
    roundTrip: item.is_round_trip !== false,
    oneWayKm: Number(item.route_one_way_km),
    totalKm,
    rate,
    amount: item.amount ?? fuelAmount(totalKm, rate),
    source: item.distance_source,
    computedAt: str(ev.computed_at) ?? str(ev.entered_at),
  };
}
