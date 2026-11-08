import { describe, expect, it } from "vitest";
import { addMonths, annualDays, buildLeaveRows, daysLabel, leaveStatus, recommend, roundProrated, serviceLabel, type LeaveAdminData, type LeaveMember } from "./leave";

const base: LeaveAdminData = {
  year: 2026,
  today: "2026-11-08",
  enabled: true,
  enabled_since: "2026-10-01",
  settings: { basis: "calendar", under_five: false, hourly_leave: false, rounding: "day", daily_hours: 8, work_days: [1, 2, 3, 4, 5] },
  members: [],
  grants: [],
  days: [],
  holidays: [],
};
const emp = (hire: string | null, role: LeaveMember["role"] = "employee"): LeaveMember => ({ id: "m1", name: "직원", role, hire_date: hire });

describe("법 기준 연차(근로기준법 제60조)", () => {
  it("가산: 근속 3년 16일 · 5년 17일 · 7년 18일 · 21년 이상 25일", () => {
    expect([1, 2, 3, 5, 7, 21, 30].map(annualDays)).toEqual([15, 15, 16, 17, 18, 25, 25]);
  });
  it("회계연도 기준: 근속 연수는 올해 − 입사 연도", () => {
    expect(recommend(emp("2019-03-04"), base).days).toBe(18);
    expect(recommend(emp("2023-07-10"), base).days).toBe(16);
    expect(recommend(emp("2024-11-18"), base).days).toBe(15);
    const r = recommend(emp("2019-03-04"), base);
    expect(r.steps.map((s) => s.law)).toEqual(["제60조 ①", "제60조 ④"]);
    expect(r.steps[1].text).toContain("(7 − 1) ÷ 2 = 3일");
  });
  it("입사 첫해(회계연도): 지금까지 생긴 월차 + 다음 날짜", () => {
    const r = recommend(emp("2026-04-01"), base);
    expect(r.days).toBe(7);
    expect(r.nextAccrual).toBe("2026-12-01");
  });
  it("입사 다음 해(회계연도): 비례 연차 올림 + 올해 생기는 월차", () => {
    const y2025 = { ...base, year: 2025 };
    // 2024-11-18 입사: 2024년 44일 → 15×44/365 = 1.81 → 2일, 월차는 2025-01-18 ~ 2025-10-18 10일
    expect(recommend(emp("2024-11-18"), y2025).days).toBe(12);
    expect(recommend(emp("2024-11-18"), { ...y2025, settings: { ...base.settings, rounding: "half" } }).days).toBe(12);
    const hour = recommend(emp("2024-11-18"), { ...y2025, settings: { ...base.settings, rounding: "hour", hourly_leave: true } });
    expect(hour.days).toBeCloseTo(10 + 15 / 8); // 14.46시간 → 15시간
  });
  it("입사일 기준: 입사 n년 되는 날부터 1년", () => {
    const hire = { ...base, settings: { ...base.settings, basis: "hire" as const } };
    const r = recommend(emp("2019-03-04"), hire);
    expect(r).toMatchObject({ days: 18, periodStart: "2026-03-04", periodEnd: "2027-03-03" });
    const first = recommend(emp("2026-04-01"), hire);
    expect(first).toMatchObject({ days: 7, periodStart: "2026-04-01", periodEnd: "2027-03-31" });
    expect(first.steps[1].text).toContain("2027-04-01");
  });
  it("대표·5인 미만·입사일 없음·입사 전은 추천 없음", () => {
    expect(recommend(emp("2015-05-01", "super_admin"), base).why).toBe("owner");
    expect(recommend(emp("2020-01-01"), { ...base, settings: { ...base.settings, under_five: true } }).why).toBe("under_five");
    expect(recommend(emp(null), base).why).toBe("no_hire");
    expect(recommend(emp("2027-02-01"), base).why).toBe("not_yet");
  });
  it("월차 개근 참고: 근무일 중 기록 없는 날", () => {
    const data = { ...base, days: [{ member_id: "m1", work_date: "2026-10-01" }, { member_id: "m1", work_date: "2026-10-02" }] };
    const r = recommend(emp("2026-04-01"), data);
    const oct = r.months.find((m) => m.accrual === "2026-11-01")!; // 10/1 ~ 10/31
    expect(oct.state).toBe("check");
    expect(oct.workdays).toBe(22);
    expect(oct.recorded).toBe(2);
    expect(r.months.find((m) => m.accrual === "2026-05-01")!.state).toBe("noapp"); // 앱 쓰기 전
    expect(r.months.find((m) => m.accrual === "2026-12-01")!.state).toBe("future");
  });
});

describe("도우미", () => {
  it("올림 · 표시 · 날짜", () => {
    expect(roundProrated(1.81, "day", 8)).toBe(2);
    expect(roundProrated(1.3, "half", 8)).toBe(1.5);
    expect(roundProrated(2, "day", 8)).toBe(2);
    expect(daysLabel(15, 8)).toBe("15일");
    expect(daysLabel(1.5, 8)).toBe("1.5일");
    expect(daysLabel(1.875, 8)).toBe("1일 7시간");
    expect(addMonths("2024-01-31", 1)).toBe("2024-02-29");
    expect(addMonths("2024-02-29", 12)).toBe("2025-02-28");
    expect(serviceLabel("2024-11-18", "2026-11-08")).toBe("1년 11개월");
  });
  it("상태", () => {
    const rec = recommend(emp("2019-03-04"), base);
    const g = (granted: number, recommended: number | null = 18) => ({ member_id: "m1", period_start: "2026-01-01", period_end: "2026-12-31", recommended, granted, reason: null, confirmed_by_name: "대표", confirmed_at: "" });
    expect(leaveStatus(rec, undefined)).toBe("unconfirmed");
    expect(leaveStatus(rec, g(18))).toBe("confirmed");
    expect(leaveStatus(rec, g(19))).toBe("above");
    expect(leaveStatus(rec, g(16))).toBe("below");
    const monthlyRec = recommend(emp("2026-04-01"), base); // 7
    expect(leaveStatus(monthlyRec, g(6, 6))).toBe("grown");
    expect(buildLeaveRows({ ...base, members: [emp(null)] })[0].status).toBe("no_hire");
  });
});
