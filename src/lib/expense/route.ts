// 자차 유류비 경로·거리·금액 표시 (trip-expense.md §4.2, D-085, D-089)
// 계산 순서: 편도 거리 × km당 단가 = 편도 금액(원 단위 반올림) → 왕복이면 편도 금액 × 2.
// 금액 계산의 원본은 DB(private.recompute_claim)다. 여기서는 같은 식으로 미리 보여 주기만 한다.
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

export function fuelAmount(oneWayKm: number, rate: number, roundTrip: boolean): number {
  return Math.round(oneWayKm * rate) * (roundTrip ? 2 : 1);
}

// "편도 377km × 200원 = 75,400원" / 왕복: "편도 377km × 200원 = 75,400원 × 2(왕복) = 150,800원"
export function routeFormula(c: Pick<RouteCard, "roundTrip" | "oneWayKm" | "rate">): string {
  const oneWay = fuelAmount(c.oneWayKm, c.rate, false);
  const base = `편도 ${km(c.oneWayKm)} × ${formatWon(c.rate)} = ${formatWon(oneWay)}`;
  return c.roundTrip ? `${base} × 2(왕복) = ${formatWon(oneWay * 2)}` : base;
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
    roundTrip: item.is_round_trip === true,
    oneWayKm: Number(item.route_one_way_km),
    totalKm,
    rate,
    amount: item.amount ?? fuelAmount(Number(item.route_one_way_km), rate, item.is_round_trip === true),
    source: item.distance_source,
    computedAt: str(ev.computed_at) ?? str(ev.entered_at),
  };
}
