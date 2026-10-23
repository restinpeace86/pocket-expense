// 자차 유류비 경로·거리·금액 표시 (trip-expense.md §4.2, D-085, D-089)
// 계산 순서(고정 단가): 편도 거리 × km당 단가 = 편도 금액(원 단위 반올림) → 왕복이면 편도 금액 × 2.
// 계산 순서(전국 평균 유가, D-117): 올림( 출장 당일 유가 ÷ 12km/L × 총 주행 거리 ).
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
  applied_fuel_mode?: "fixed" | "opinet" | string | null;
  applied_fuel_price?: number | string | null;
  applied_fuel_type?: string | null;
};

export type FuelType = "gasoline" | "diesel" | "lpg";
export const FUEL_TYPE_LABEL: Record<FuelType, string> = { gasoline: "휘발유", diesel: "경유", lpg: "LPG" };
export const STANDARD_KM_PER_L = 12; // 회사 표준 연비(D-117)

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
  fuel?: { price: number; type: FuelType } | null; // 전국 평균 유가로 계산했으면 그 유가(D-117)
};

const km = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1)}km`;

export function fuelAmount(oneWayKm: number, rate: number, roundTrip: boolean): number {
  return Math.round(oneWayKm * rate) * (roundTrip ? 2 : 1);
}

// 전국 평균 유가 기준(D-117): 올림(유가 ÷ 12 × 총 거리) — DB private.recompute_claim과 같은 식
export function fuelAmountByPrice(oneWayKm: number, price: number, roundTrip: boolean): number {
  return Math.ceil((price * oneWayKm * (roundTrip ? 2 : 1)) / STANDARD_KM_PER_L - 1e-9);
}

// 카드의 금액(왕복 바꾸기 미리 보기용) — 유가 기준이면 유가 식, 아니면 고정 단가 식
export function cardAmount(c: Pick<RouteCard, "oneWayKm" | "rate" | "fuel">, roundTrip: boolean): number {
  return c.fuel ? fuelAmountByPrice(c.oneWayKm, c.fuel.price, roundTrip) : fuelAmount(c.oneWayKm, c.rate, roundTrip);
}

const won2 = (n: number) => `${n.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}원`;

// "편도 377km × 200원 = 75,400원" / 왕복: "편도 377km × 200원 = 75,400원 × 2(왕복) = 150,800원"
export function routeFormula(c: Pick<RouteCard, "roundTrip" | "oneWayKm" | "rate"> & { fuel?: RouteCard["fuel"] }): string {
  // 유가 기준: "(경유 1,540.5원 ÷ 12km/L) × 200km(왕복) = 25,675원"
  if (c.fuel) {
    const total = c.oneWayKm * (c.roundTrip ? 2 : 1);
    return `(${FUEL_TYPE_LABEL[c.fuel.type]} ${won2(c.fuel.price)} ÷ ${STANDARD_KM_PER_L}km/L) × ${km(total)}${c.roundTrip ? "(왕복)" : ""} = ${formatWon(fuelAmountByPrice(c.oneWayKm, c.fuel.price, c.roundTrip))}`;
  }
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
    fuel: fuelOf(item),
  };
}

export function fuelOf(item: Pick<RouteItem, "applied_fuel_mode" | "applied_fuel_price" | "applied_fuel_type">): RouteCard["fuel"] {
  const price = Number(item.applied_fuel_price);
  const type = item.applied_fuel_type;
  return item.applied_fuel_mode === "opinet" && Number.isFinite(price) && price > 0 && (type === "gasoline" || type === "diesel" || type === "lpg") ? { price, type } : null;
}
