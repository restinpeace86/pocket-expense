import { describe, expect, it } from "vitest";
import { hubTiles, todayTitle } from "./employee-hub";

// 직원 홈 메뉴 칸 규칙 (worker-dashboard.md §0, D-235)
describe("hubTiles", () => {
  it("기본 = 지출결의·정산", () => {
    expect(hubTiles("/w", { inbox: null, rooms: false, today: "2026-11-09" }).map((t) => t.key)).toEqual(["claims", "settlements"]);
  });
  it("사전 검토자면 결재함(대기 배지), 회의실이 있으면 회의실(그날 예약 창)", () => {
    const t = hubTiles("/w", { inbox: { waiting: 2 }, rooms: true, today: "2026-11-09" });
    expect(t.map((x) => x.key)).toEqual(["claims", "settlements", "approvals", "rooms"]);
    expect(t[2].badge).toBe(2);
    expect(t[3].href).toBe("/w/calendar?rooms=2026-11-09");
  });
  it("근태 켠 회사는 [근태] = 월 근태 현황", () => {
    const t = hubTiles("/w", { inbox: null, rooms: false, today: "2026-11-09", attendance: true });
    expect(t.map((x) => x.key)).toEqual(["claims", "settlements", "attendance", "vacation"]);
    expect(t[3].href).toBe("/w/employee/vacation");
    // 주변 버스(D-243)는 맨 끝
    expect(hubTiles("/w", { inbox: null, rooms: true, today: "2026-11-09", attendance: true, bus: true }).map((x) => x.key).at(-1)).toBe("bus");
    expect(t[2].href).toBe("/w/employee/attendance");
  });
  it("캘린더·채팅은 하단 바에 있으므로 메뉴 칸에 없다", () => {
    const keys = hubTiles("/w", { inbox: { waiting: 0 }, rooms: true, today: "2026-11-09" }).map((t) => t.key);
    expect(keys).not.toContain("calendar");
    expect(keys).not.toContain("chat");
  });
});

describe("todayTitle", () => {
  it("M월 D일 (요일)", () => {
    expect(todayTitle("2026-11-09")).toBe("11월 9일 (월)");
    expect(todayTitle("2026-11-08")).toBe("11월 8일 (일)");
  });
});
