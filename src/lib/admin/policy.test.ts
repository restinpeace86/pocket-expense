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
    ).toEqual(["식대 1인 10,000원", "자차 km당 200원", "청구 기한 결제한 다음 달 5일까지"]);
  });

  it("사용 안 함과 기한 없음", () => {
    expect(
      describePolicy({
        meal_limit_enabled: false,
        meal_limit_per_person: 10000,
        fuel_enabled: false,
        fuel_rate_per_km: 200,
        claim_deadline_type: "none",
        claim_deadline_days: null,
      }),
    ).toEqual(["식대 한도 없이 전액 지원", "자차 유류비 사용 안 함", "청구 기한 없음"]);
  });

  it("기한 방식별 문구", () => {
    expect(describeDeadline("days_after", 30)).toBe("결제일로부터 30일 이내");
    expect(describeDeadline("end_of_month", null)).toBe("결제한 달 말일까지");
  });
});
