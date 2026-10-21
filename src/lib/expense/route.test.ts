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

describe("자차 유류비 계산 (편도 금액 먼저, 왕복은 × 2)", () => {
  it("편도 거리 × 단가를 반올림한 뒤 왕복이면 × 2 (DB와 같은 식)", () => {
    expect(fuelAmount(377, 200, false)).toBe(75400);
    expect(fuelAmount(377, 200, true)).toBe(150800);
    expect(fuelAmount(100.3, 205, true)).toBe(41124); // 20,562 × 2 (200.6km × 205 = 41,123이 아님)
  });
  it("계산식 문구", () => {
    expect(routeFormula({ roundTrip: false, oneWayKm: 377, rate: 200 })).toBe("편도 377km × 200원 = 75,400원");
    expect(routeFormula({ roundTrip: true, oneWayKm: 377, rate: 200 })).toBe("편도 377km × 200원 = 75,400원 × 2(왕복) = 150,800원");
    expect(routeFormula({ roundTrip: false, oneWayKm: 128.4, rate: 200 })).toBe("편도 128.4km × 200원 = 25,680원");
  });
  it("증빙 카드: 거리까지 정해진 항목만, 왕복 값이 없으면 편도", () => {
    expect(routeCardFrom(base, 200)).toMatchObject({ startName: "판교역", endAddress: "부산 동구 중앙대로 206", roundTrip: true, totalKm: 754, amount: 150800, source: "api" });
    expect(routeCardFrom({ ...base, is_round_trip: null, distance_km: 377, amount: null }, 200)).toMatchObject({ roundTrip: false, amount: 75400 });
    expect(routeCardFrom({ ...base, distance_km: null, route_one_way_km: null, distance_source: null }, 200)).toBeNull();
    expect(routeCardFrom({ ...base, end_location: null }, 200)).toBeNull();
  });
});
