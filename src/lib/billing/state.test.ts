import { describe, expect, it } from "vitest";
import { addDays, isSubscribed, pastDueSchedule } from "./state";

describe("정기결제 상태(D-298)", () => {
  it("날짜 더하기는 달·해를 넘긴다", () => {
    expect(addDays("2026-11-29", 3)).toBe("2026-12-02");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
  it("실패 일정 = 3·7·8·30일", () => {
    expect(pastDueSchedule("2026-11-20")).toEqual({ retryUntil: "2026-11-23", graceUntil: "2026-11-27", blockFrom: "2026-11-28", cancelOn: "2026-12-20" });
  });
  it("결제 중 = 예약·사용 중·미납", () => {
    expect(isSubscribed(null)).toBe(false);
    for (const status of ["scheduled", "active", "past_due"] as const) expect(isSubscribed({ status } as never)).toBe(true);
    for (const status of ["pending", "canceled"] as const) expect(isSubscribed({ status } as never)).toBe(false);
  });
});
