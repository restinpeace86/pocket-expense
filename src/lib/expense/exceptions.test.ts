import { describe, expect, it } from "vitest";
import { exceptionFlags, exceptionSummary, isLateNight, isWeekend } from "./exceptions";

describe("예외 사용 표시", () => {
  it("주말: 토·일만", () => {
    expect(isWeekend("2026-10-17")).toBe(true); // 토
    expect(isWeekend("2026-10-18")).toBe(true); // 일
    expect(isWeekend("2026-10-19")).toBe(false); // 월
    expect(isWeekend(null)).toBe(false);
  });
  it("심야: 22:00~05:59", () => {
    expect(isLateNight("22:00")).toBe(true);
    expect(isLateNight("05:59:00")).toBe(true);
    expect(isLateNight("06:00")).toBe(false);
    expect(isLateNight("21:59")).toBe(false);
    expect(isLateNight(null)).toBe(false);
  });
  it("건수와 요약 문구", () => {
    const f = exceptionFlags([
      { expense_date: "2026-10-17", paid_time: "23:10" },
      { expense_date: "2026-10-19", paid_time: "12:00" },
      { expense_date: "2026-10-18", paid_time: null },
    ]);
    expect(f).toEqual({ weekend: 2, lateNight: 1 });
    expect(exceptionSummary(f)).toBe("주말 사용 2건 · 심야(22시~06시) 사용 1건");
    expect(exceptionSummary({ weekend: 0, lateNight: 0 })).toBe("");
  });
});
