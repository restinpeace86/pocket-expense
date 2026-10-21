import { describe, expect, it } from "vitest";
import { fuelAmount, routeCardFrom, routeFormula } from "./route";

const base = {
  start_location: "판교역",
  end_location: "부산역",
  is_round_trip: true,
  route_one_way_km: 377,
  distance_km: 754,
  distance_source: "api" as const,
  route_evidence: { start_address: "경기 성남시 분당구 판교역로 160", end_address: "부산 동구 중앙대로 206", computed_at: "2026-10-21T10:00:00Z" },
  amount: 150800,
  applied_fuel_rate_per_km: 200,
};

describe("자차 유류비 표시", () => {
  it("금액 = 거리 × 단가, 원 단위 반올림 (DB와 같은 식)", () => {
    expect(fuelAmount(256.8, 200)).toBe(51360);
    expect(fuelAmount(128.45, 180)).toBe(23121);
  });
  it("왕복·편도 계산식 문구", () => {
    expect(routeFormula({ roundTrip: true, oneWayKm: 377, totalKm: 754, rate: 200, amount: 150800 })).toBe("왕복 · 377km × 2 = 754km × 200원 = 150,800원");
    expect(routeFormula({ roundTrip: false, oneWayKm: 128.4, totalKm: 128.4, rate: 200, amount: 25680 })).toBe("편도 · 128.4km × 200원 = 25,680원");
  });
  it("증빙 카드: 거리까지 정해진 항목만", () => {
    expect(routeCardFrom(base, 200)).toMatchObject({ startName: "판교역", endAddress: "부산 동구 중앙대로 206", roundTrip: true, totalKm: 754, amount: 150800, source: "api" });
    expect(routeCardFrom({ ...base, distance_km: null, route_one_way_km: null, distance_source: null }, 200)).toBeNull();
    expect(routeCardFrom({ ...base, end_location: null }, 200)).toBeNull();
  });
});
