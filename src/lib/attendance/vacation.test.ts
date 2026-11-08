import { describe, expect, it } from "vitest";
import { leaveBadge, leaveDateLabel, preview, skippedDays, workdaysBetween, yearSummary, type VacationData } from "./vacation";

// 2026-12-24 목 · 12-25 성탄절 · 12-26 토
const data: VacationData = {
  year: 2026,
  today: "2026-11-08",
  settings: { hourly_leave: true, daily_hours: 8, shortage: "block", work_days: [1, 2, 3, 4, 5] },
  types: [
    { id: "annual", key: "annual", name: "연차", deducts: true, paid: "paid", allow_hours: true, proof: "none" },
    { id: "sick", key: "sick", name: "병가", deducts: false, paid: "unpaid", allow_hours: false, proof: "required" },
  ],
  grants: [{ period_start: "2026-01-01", period_end: "2026-12-31", granted: 18, used: 8.5, approved: 7.5 }],
  leaves: [],
  holidays: ["2026-12-25"],
};
const input = { typeId: "annual", unit: "day" as const, start: "2026-12-24", end: "2026-12-26", startTime: "", hours: 0, reason: "" };

describe("휴가 신청 미리 보기(D-241)", () => {
  it("근무일만 셈: 성탄절·토요일 제외", () => {
    expect(workdaysBetween("2026-12-24", "2026-12-26", [1, 2, 3, 4, 5], new Set(["2026-12-25"]))).toBe(1);
    expect(skippedDays("2026-12-24", "2026-12-26", [1, 2, 3, 4, 5], new Set(["2026-12-25"]))).toEqual(["2026-12-25", "2026-12-26"]);
    const p = preview(data, input, "2026-11-01");
    expect(p).toMatchObject({ workdays: 1, deduct: 1, remainingBefore: 9.5, remainingAfter: 8.5, error: null });
  });
  it("시간 단위: 4시간 = 0.5일", () => {
    const p = preview(data, { ...input, unit: "hour", start: "2026-11-20", startTime: "14:00", hours: 4 }, "2026-11-01");
    expect(p).toMatchObject({ deduct: 0.5, remainingAfter: 9, error: null });
    expect(preview(data, { ...input, unit: "hour", start: "2026-11-20", startTime: "14:00", hours: 8 }, "2026-11-01").error).toContain("1~7시간");
  });
  it("차감 없는 종류(병가)는 연차 그대로", () => {
    expect(preview(data, { ...input, typeId: "sick" }, "2026-11-01")).toMatchObject({ deduct: 0, remainingBefore: null, error: null });
  });
  it("막기: 모자라면 안내 / 당겨쓰기면 마이너스 허용", () => {
    const big = { ...input, start: "2026-11-09", end: "2026-11-27" }; // 근무일 15일
    expect(preview(data, big, "2026-11-01").error).toContain("모자라요");
    expect(preview({ ...data, settings: { ...data.settings, shortage: "borrow" } }, big, "2026-11-01")).toMatchObject({ remainingAfter: -5.5, error: null });
  });
  it("지난 달·근무일 없음·확정 전", () => {
    expect(preview(data, { ...input, start: "2026-10-30", end: "2026-10-30" }, "2026-11-01").error).toContain("이번 달까지만");
    expect(preview(data, { ...input, start: "2026-11-14", end: "2026-11-15" }, "2026-11-01").error).toContain("근무일이 없어요");
    expect(preview({ ...data, grants: [] }, input, "2026-11-01").error).toContain("확정하지 않았어요");
  });
  it("표시", () => {
    expect(leaveDateLabel({ start_date: "2026-12-24", end_date: "2026-12-26", unit: "day", start_time: null, hours: null })).toBe("12/24 (목) ~ 12/26 (토)");
    expect(leaveDateLabel({ start_date: "2026-11-20", end_date: "2026-11-20", unit: "hour", start_time: "14:00", hours: 4 })).toBe("11/20 (금) 14:00부터 4시간");
    expect(leaveBadge({ status: "pending", cancel_status: null, proof: "required", has_proof: false }).text).toBe("증빙 기다리는 중");
    expect(leaveBadge({ status: "approved", cancel_status: "pending", proof: "none", has_proof: false }).key).toBe("cancel_pending");
    expect(yearSummary(data)).toMatchObject({ remaining: 9.5, pending: 1 });
  });
});
