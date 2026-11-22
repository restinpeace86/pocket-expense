import { describe, expect, it } from "vitest";
import type { LeaveAdminData } from "@/lib/attendance/leave";
import { budgetPreview, hirePreview, leaveImpact, retentionPreview } from "./apply-preview";

const leave: LeaveAdminData = {
  year: 2026,
  today: "2026-11-22",
  enabled: true,
  enabled_since: "2026-01-01",
  settings: { basis: "calendar", under_five: false, hourly_leave: false, rounding: "day", daily_hours: 8, work_days: [1, 2, 3, 4, 5] },
  members: [
    { id: "a", name: "가", role: "employee", hire_date: "2020-03-02" },
    { id: "b", name: "나", role: "employee", hire_date: "2025-07-01" },
    { id: "c", name: "다", role: "super_admin", hire_date: "2019-01-01" },
    { id: "d", name: "라", role: "employee", hire_date: null },
  ],
  grants: [{ member_id: "a", period_start: "2026-01-01", period_end: "2026-12-31", recommended: 17, granted: 17, reason: null, confirmed_by_name: "대표", confirmed_at: "2026-01-02T00:00:00Z" }],
  days: [],
  holidays: [],
};

describe("우리 회사에 적용하면(D-304)", () => {
  it("예산: % + 지금 속도로 80% 닿는 날", () => {
    expect(budgetPreview(0, null, "2026-11-22")).toEqual([]);
    expect(budgetPreview(500000, null, "2026-11-22")[0]).toMatch(/500,000원/);
    expect(budgetPreview(0, 3000000, "2026-11-22")[0]).toMatch(/아직/);
    // 20일에 1,500,000 → 하루 75,000 → 2,400,000(80%)은 32일째 → 이번 달 안엔 안 감
    expect(budgetPreview(1500000, 3000000, "2026-11-20")).toEqual(["이번 달 지금까지 쓴 돈 1,500,000원 → 예산의 50%예요.", "지금 속도면 이번 달 안에 80%까지는 안 가요."]);
    // 10일에 1,000,000 → 하루 100,000 → 24일째
    expect(budgetPreview(1000000, 3000000, "2026-11-10")[1]).toBe("지금 속도면 11월 24일쯤 80%를 넘어요.");
    expect(budgetPreview(2500000, 3000000, "2026-11-10")[1]).toBe("이미 80%를 넘었어요.");
    expect(budgetPreview(3100000, 3000000, "2026-11-10")[1]).toBe("이미 예산을 넘었어요.");
    expect(budgetPreview(100000, 3000000, "2026-11-02")).toHaveLength(1); // 월초는 내다보지 않음
  });
  it("파일 보관: 기간 + 1일째 새벽", () => {
    expect(retentionPreview("2026-11-22", 90)[0]).toBe("오늘 올린 채팅 사진·파일은 2027년 2월 21일 새벽에 지워져요.");
    expect(retentionPreview("2026-12-31", 30)[0]).toMatch(/2027년 1월 31일/);
  });
  it("연차 기준을 바꾸면 달라지는 직원 수(대표·입사일 없음은 그대로)", () => {
    expect(leaveImpact(leave, { basis: "calendar", under_five: false, daily_hours: 8 })).toBeNull();
    expect(leaveImpact(leave, { basis: "hire", under_five: false, daily_hours: 8 })).toEqual({ changed: 2, confirmed: 1 });
    expect(leaveImpact(leave, { basis: "calendar", under_five: true, daily_hours: 8 })).toEqual({ changed: 2, confirmed: 1 });
  });
  it("입사일로 미리 보기", () => {
    expect(hirePreview("2026-02-30", leave)).toBeNull();
    expect(hirePreview("", leave)).toBeNull();
    const l = hirePreview("2020-03-02", leave)!;
    expect(l[0]).toBe("2026년 지금까지: 17일 → 2027년: 18일");
    const first = hirePreview("2026-03-02", leave)!;
    expect(first[0]).toMatch(/^2026년 지금까지: 8일 → 2027년: \d+일$/);
    expect(first[1]).toMatch(/다음 1일은 12월 2일/);
    expect(hirePreview("2020-03-02", { ...leave, settings: { ...leave.settings, under_five: true } })![0]).toMatch(/5인 미만/);
    expect(hirePreview("2027-05-01", leave)![0]).toMatch(/아직 입사 전/);
  });
});
