import { describe, expect, it } from "vitest";
import { describeDeadline, describePolicy } from "./policy";

describe("describePolicy", () => {
  it("새 회사 기본값을 한 줄씩 보여 준다", () => {
    expect(
      describePolicy({
        meal_limit_enabled: true,
        meal_limit_per_person: 10000,
        fuel_enabled: true,
        fuel_rate_per_km: 200,
        claim_deadline_type: "next_month_day",
        claim_deadline_days: 5,
      }),
    ).toEqual(["식대 1인 10,000원", "자차 km당 200원", "청구 마감 사용한 다음 달 2일까지(쉬는 날이면 앞 영업일)"]);
  });

  it("사용 안 함 — 청구 마감은 회사 설정과 관계없이 고정(D-161)", () => {
    expect(
      describePolicy({
        meal_limit_enabled: false,
        meal_limit_per_person: 10000,
        fuel_enabled: false,
        fuel_rate_per_km: 200,
        claim_deadline_type: "none",
        claim_deadline_days: null,
      }),
    ).toEqual(["식대 한도 없이 전액 지원", "자차 유류비 사용 안 함", "청구 마감 사용한 다음 달 2일까지(쉬는 날이면 앞 영업일)"]);
  });

  it("청구 마감 문구", () => {
    expect(describeDeadline()).toBe("사용한 다음 달 2일까지(쉬는 날이면 앞 영업일)");
  });
});
