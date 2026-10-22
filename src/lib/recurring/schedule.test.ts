import { describe, expect, it } from "vitest";
import { nextBillingDate, scheduleLabel } from "./schedule";

describe("nextBillingDate — DB recurring_due_period와 같은 규칙 (D-110)", () => {
  const monthly = { cycle: "monthly" as const, billingDay: 5, billingMonth: null, startsOn: "2026-09-01" };
  it("매월: 이번 달 결제일이 안 지났으면 이번 달, 지났으면 다음 달", () => {
    expect(nextBillingDate(monthly, "2026-10-04")).toBe("2026-10-05");
    expect(nextBillingDate(monthly, "2026-10-05")).toBe("2026-10-05");
    expect(nextBillingDate(monthly, "2026-10-23")).toBe("2026-11-05");
    expect(nextBillingDate(monthly, "2026-12-23")).toBe("2027-01-05");
  });
  it("짧은 달은 말일, 등록일 이전 결제일은 건너뜀", () => {
    expect(nextBillingDate({ ...monthly, billingDay: 31 }, "2026-11-02")).toBe("2026-11-30");
    expect(nextBillingDate({ ...monthly, billingDay: 31 }, "2027-02-01")).toBe("2027-02-28");
    expect(nextBillingDate({ ...monthly, startsOn: "2026-10-20" }, "2026-10-10")).toBe("2026-11-05");
  });
  it("매년", () => {
    const yearly = { cycle: "yearly" as const, billingDay: 10, billingMonth: 3, startsOn: "2026-01-01" };
    expect(nextBillingDate(yearly, "2026-10-23")).toBe("2027-03-10");
    expect(nextBillingDate(yearly, "2026-02-01")).toBe("2026-03-10");
  });
  it("표시", () => {
    expect(scheduleLabel({ cycle: "monthly", billingDay: 5, billingMonth: null })).toBe("매월 5일");
    expect(scheduleLabel({ cycle: "monthly", billingDay: 31, billingMonth: null })).toBe("매월 말일");
    expect(scheduleLabel({ cycle: "yearly", billingDay: 10, billingMonth: 3 })).toBe("매년 3월 10일");
  });
});
