import { describe, expect, it } from "vitest";
import { claimStatusBadge } from "./status";

describe("claimStatusBadge", () => {
  it("상태별 표시명 (ui-rules §4)", () => {
    expect(claimStatusBadge("draft").label).toBe("📝 임시저장");
    expect(claimStatusBadge("approved").label).toBe("✅ 승인 완료 (정산 대기)");
    expect(claimStatusBadge("paid", true).label).toBe("💰 정산 지급 완료");
    expect(claimStatusBadge("paid", false).label).toBe("✅ 승인 완료 (정산 없음)");
  });
});

describe("month/filter helpers", () => {
  it("월 파싱·이동", async () => {
    const { parseMonth, shiftMonth, parseFilter, filterStatuses } = await import("./status");
    expect(parseMonth("2026-10")).toBe("2026-10");
    expect(parseMonth("2026-13", "2026-01")).toBe("2026-01");
    expect(parseMonth("x' or 1=1", "2026-01")).toBe("2026-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(parseFilter("nope")).toBe("all");
    expect(filterStatuses("done")).toEqual(["approved", "paid"]);
    expect(filterStatuses("all")).toBeNull();
  });
});
