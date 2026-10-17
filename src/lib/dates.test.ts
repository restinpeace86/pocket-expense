import { describe, expect, it } from "vitest";
import { currentMonthKst, monthRange, todayKst } from "./dates";

describe("dates (한국 시간)", () => {
  it("UTC 밤 = 한국 다음 날", () => {
    expect(todayKst(new Date("2026-10-31T16:30:00Z"))).toBe("2026-11-01");
    expect(currentMonthKst(new Date("2026-10-31T16:30:00Z"))).toBe("2026-11");
  });
  it("월 범위 (끝은 포함하지 않음, 12월 → 다음 해)", () => {
    expect(monthRange("2026-10")).toEqual({ start: "2026-10-01", end: "2026-11-01" });
    expect(monthRange("2026-12")).toEqual({ start: "2026-12-01", end: "2027-01-01" });
  });
  it("잘못된 월은 오류", () => {
    expect(() => monthRange("2026-13")).toThrow();
    expect(() => monthRange("26-1")).toThrow();
  });
});
