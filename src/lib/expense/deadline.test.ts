import { describe, expect, it } from "vitest";
import { deadlineDate, isOverdue, kstDate } from "./deadline";

describe("청구 기한", () => {
  it("결제한 다음 달 N일까지", () => {
    expect(deadlineDate("2026-10-16", { type: "next_month_day", days: 5 })).toBe("2026-11-05");
    expect(deadlineDate("2026-12-31", { type: "next_month_day", days: 5 })).toBe("2027-01-05");
    expect(deadlineDate("2026-01-31", { type: "next_month_day", days: 28 })).toBe("2026-02-28");
  });
  it("결제한 달 말일까지 / 결제일로부터 N일", () => {
    expect(deadlineDate("2026-02-10", { type: "end_of_month", days: null })).toBe("2026-02-28");
    expect(deadlineDate("2026-10-25", { type: "days_after", days: 10 })).toBe("2026-11-04");
  });
  it("기한 없음·날짜 없음이면 판정하지 않음", () => {
    expect(deadlineDate("2026-10-16", { type: "none", days: null })).toBeNull();
    expect(deadlineDate(null, { type: "end_of_month", days: null })).toBeNull();
  });
  it("기준일이 기한보다 늦으면 초과(기한 당일은 초과 아님)", () => {
    const p = { type: "next_month_day" as const, days: 5 };
    expect(isOverdue("2026-09-20", p, "2026-10-05")).toBe(false);
    expect(isOverdue("2026-09-20", p, "2026-10-06")).toBe(true);
  });
  it("상신 시각은 한국 날짜로", () => {
    expect(kstDate("2026-10-05T16:30:00Z")).toBe("2026-10-06");
  });
});
