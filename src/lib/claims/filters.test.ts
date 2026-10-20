import { describe, expect, it } from "vitest";
import { filterQuery, parseClaimFilters } from "./filters";

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
