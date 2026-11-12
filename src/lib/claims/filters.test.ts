import { describe, expect, it } from "vitest";
import { filterDateRange, filterQuery, parseClaimFilters, quickMonths } from "./filters";

describe("parseClaimFilters", () => {
  it("올바른 값만 받는다", () => {
    const f = parseClaimFilters({ month: "2026-10", department: "11111111-1111-1111-1111-111111111111", member: "bad", category: "meal", q: ' 김밥 "천국", (강남) ' });
    expect(f).toEqual({ month: "2026-10", department: "11111111-1111-1111-1111-111111111111", member: null, category: "meal", q: "김밥  천국    강남" });
    expect(parseClaimFilters({ month: "2026-13", category: "travel", q: "%%" })).toEqual({ month: null, department: null, member: null, category: null, q: null });
  });
  it("링크에 이어 붙일 쿼리", () => {
    expect(filterQuery({ month: "2026-10", department: null, member: null, category: "meal", q: null })).toBe("month=2026-10&category=meal");
  });
});

describe("9-14c 빠른 기간", () => {
  it("최근 3개월 = 이번 달 포함 세 달(해 넘김 포함), 월은 그 달만", () => {
    expect(parseClaimFilters({ month: "recent3" }).month).toBe("recent3");
    expect(filterDateRange("recent3", "2026-11")).toEqual({ start: "2026-09-01", end: "2026-12-01" });
    expect(filterDateRange("recent3", "2026-01")).toEqual({ start: "2025-11-01", end: "2026-02-01" });
    expect(filterDateRange("2026-10", "2026-11")).toEqual({ start: "2026-10-01", end: "2026-11-01" });
  });
  it("[이번 달]·[지난달]·[최근 3개월]", () => {
    expect(quickMonths("2026-01").map((q) => q.value)).toEqual(["2026-01", "2025-12", "recent3"]);
  });
});
