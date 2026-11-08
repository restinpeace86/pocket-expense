import { describe, expect, it } from "vitest";
import { buildDay, filterRows, type DayAdminData } from "./today";

const base: DayAdminData = {
  date: "2026-11-09",
  today: "2026-11-09",
  now: "2026-11-09T06:12:00Z", // 15:12 KST
  work_start: "09:00",
  work_end: "18:00",
  workday: true,
  holiday_name: null,
  enabled_since: "2026-11-01",
  members: [
    { id: "a", name: "근무", role: "employee", department: "영업팀", since: "2026-11-01" },
    { id: "b", name: "퇴근", role: "employee", department: null, since: "2026-11-01" },
    { id: "c", name: "휴가", role: "employee", department: null, since: "2026-11-01" },
    { id: "d", name: "출근전", role: "employee", department: null, since: "2026-11-01" },
    { id: "e", name: "시간휴가", role: "employee", department: null, since: "2026-11-01" },
    { id: "f", name: "신입", role: "employee", department: null, since: "2026-11-10" },
  ],
  days: [
    { member_id: "a", in_at: "2026-11-08T23:41:00Z", out_at: null, out_method: null, holiday: false, holiday_approved: false, in_terminal: "1층", out_terminal: null },
    { member_id: "b", in_at: "2026-11-09T00:03:00Z", out_at: "2026-11-09T06:10:00Z", out_method: "qr", holiday: false, holiday_approved: false, in_terminal: "1층", out_terminal: "1층" },
    { member_id: "e", in_at: "2026-11-08T23:58:00Z", out_at: null, out_method: null, holiday: false, holiday_approved: false, in_terminal: "2층", out_terminal: null },
  ],
  leaves: [
    { member_id: "c", type_name: "연차", unit: "day", start_time: null, hours: null },
    { member_id: "e", type_name: "연차", unit: "hour", start_time: "14:00", hours: 4 },
  ],
};

describe("오늘 출근 현황(D-242)", () => {
  const { rows, summary } = buildDay(base);
  const st = Object.fromEntries(rows.map((r) => [r.name, r.status]));
  it("상태 분류 — 지각 판단 없이 찍힌 시각만", () => {
    expect(st).toEqual({ 근무: "working", 퇴근: "out", 휴가: "leave", 출근전: "before", 시간휴가: "working", 신입: "not_yet" });
    expect(rows.find((r) => r.name === "근무")).toMatchObject({ inTime: "08:41", memo: "6시간 31분째" });
    expect(rows.find((r) => r.name === "퇴근")).toMatchObject({ inTime: "09:03", outTime: "15:10", memo: "6시간 7분" });
    expect(rows.find((r) => r.name === "시간휴가")?.label).toBe("근무 중 · 시간 휴가");
    expect(rows.find((r) => r.name === "휴가")?.memo).toBe("연차(종일)");
  });
  it("요약과 걸러 보기", () => {
    expect(summary).toEqual({ total: 6, working: 2, out: 1, before: 1, leave: 1 });
    expect(filterRows(rows, "before").map((r) => r.name)).toEqual(["출근전"]);
  });
  it("지난 날: 기록 없음 · 쉬는 날", () => {
    const past = buildDay({ ...base, today: "2026-11-10" });
    expect(past.rows.find((r) => r.name === "출근전")?.status).toBe("none");
    expect(past.rows.find((r) => r.name === "근무")?.status).toBe("none");
    const off = buildDay({ ...base, workday: false, holiday_name: "테스트휴일", days: [] , leaves: [] });
    expect(off.rows.every((r) => r.status === "off")).toBe(true);
    expect(off.summary.before).toBe(0);
  });
});
