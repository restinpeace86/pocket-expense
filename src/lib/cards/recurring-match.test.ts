import { describe, expect, it } from "vitest";
import { matchRecurring, recurringReport, type RecurringRef } from "./reconcile";

const cad: RecurringRef = { id: "r1", serviceName: "캐드 구독료", keyword: "AUTODESK", amount: 55000, cycle: "monthly", billingDay: 10, billingMonth: null, assignee: "이경리", claimedPeriods: [] };
const row = (line: number, date: string, merchant: string, amount: number) => ({ line, date, merchant, amount, last4: "7890", cancelled: false });

describe("정기 결제 ↔ 카드 내역 (D-171)", () => {
  it("가맹점 키워드 + 금액 ±10%", () => {
    expect(matchRecurring(row(1, "2026-09-10", "AUTODESK *ACAD", 57000), [cad])?.id).toBe("r1");
    expect(matchRecurring(row(1, "2026-09-10", "AUTODESK *ACAD", 70000), [cad])).toBeNull();
    expect(matchRecurring(row(1, "2026-09-10", "김밥천국", 55000), [cad])).toBeNull();
  });
  it("키워드가 없으면 서비스명으로", () => {
    expect(matchRecurring(row(1, "2026-09-10", "노션 구독", 12000), [{ ...cad, keyword: null, serviceName: "노션", amount: 12000 }])?.id).toBe("r1");
  });
  it("결의서 없는 결제와 맞음 / 내역 기간 안 결제일인데 못 찾음 / 이미 결의서 있음", () => {
    const rows = [row(1, "2026-09-10", "AUTODESK", 55000), row(2, "2026-09-30", "식당", 9000)];
    const rep = recurringReport(rows, [rows[0]], [cad, { ...cad, id: "r2", serviceName: "슬랙", keyword: "SLACK", amount: 9000, billingDay: 15 }]);
    expect(rep.matches).toEqual([{ line: 1, recurringId: "r1", serviceName: "캐드 구독료", assignee: "이경리", claimed: false }]);
    expect(rep.notFound).toEqual([{ recurringId: "r2", serviceName: "슬랙", amount: 9000, due: "2026-09-15" }]);
    const claimed = recurringReport(rows, [rows[0]], [{ ...cad, claimedPeriods: ["2026-09"] }]);
    expect(claimed.matches[0].claimed).toBe(true);
    expect(claimed.notFound).toEqual([]);
  });
});
