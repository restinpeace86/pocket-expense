import { describe, expect, it } from "vitest";
import { buildRequests, type ClaimRow, type FixRow, type LeaveRow } from "./requests";

const now = new Date("2026-11-11T03:00:00Z");
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000).toISOString();
const leave = (o: Partial<LeaveRow>): LeaveRow => ({ id: "l", type_name: "연차", start_date: "2026-11-14", end_date: "2026-11-14", unit: "day", hours: null, status: "pending", decided_at: null, created_at: daysAgo(1), cancel_status: null, cancel_requested_at: null, ...o });
const fix = (o: Partial<FixRow>): FixRow => ({ id: "f", work_date: "2026-11-10", kind: "correction", status: "pending", decided_at: null, created_at: daysAgo(1), ...o });
const claim = (o: Partial<ClaimRow>): ClaimRow => ({ id: "c", title: "식대", total_amount: 48000, status: "submitted", submitted_at: daysAgo(1), approved_at: null, rejected_at: null, paid_at: null, ...o });

describe("나의 신청함", () => {
  it("대기·최근 7일 승인·반려만, 오래된 승인은 빠짐", () => {
    const r = buildRequests("/w", {
      leaves: [leave({ id: "1" }), leave({ id: "2", status: "approved", decided_at: daysAgo(2) }), leave({ id: "3", status: "approved", decided_at: daysAgo(10) }), leave({ id: "4", status: "rejected", decided_at: daysAgo(20) })],
      fixes: [fix({ id: "5", status: "rejected", decided_at: daysAgo(1) })],
      claims: [claim({ id: "6" }), claim({ id: "7", status: "rejected", rejected_at: daysAgo(30) }), claim({ id: "8", status: "approved", approved_at: daysAgo(3) })],
    }, now);
    expect(r.map((x) => x.key).sort()).toEqual(["claim-6", "claim-7", "claim-8", "fix-5", "leave-1", "leave-2"]);
  });
  it("지출결의서 반려는 오래돼도 남음(다시 내기 전까지), 반려 → 대기 → 승인 순", () => {
    const r = buildRequests("/w", { leaves: [leave({ id: "1", status: "approved", decided_at: daysAgo(1) })], fixes: [], claims: [claim({ id: "2" }), claim({ id: "3", status: "rejected", rejected_at: daysAgo(40) })] }, now);
    expect(r.map((x) => x.status)).toEqual(["bad", "wait", "ok"]);
    expect(r[0].href).toBe("/w/employee/claims/3");
  });
  it("휴가 취소 신청 대기는 대기, 이름·링크", () => {
    const [x] = buildRequests("/w", { leaves: [leave({ status: "approved", decided_at: daysAgo(30), cancel_status: "pending", cancel_requested_at: daysAgo(1), start_date: "2026-11-14", end_date: "2026-11-15" })], fixes: [], claims: [] }, now);
    expect(x).toMatchObject({ status: "wait", label: "취소 승인 대기", title: "11/14~11/15 연차", href: "/w/employee/vacation" });
    const [f] = buildRequests("/w", { leaves: [], fixes: [fix({ kind: "holiday" })], claims: [] }, now);
    expect(f).toMatchObject({ title: "11/10 휴일 근무", href: "/w/employee/attendance?month=2026-11" });
    const [c] = buildRequests("/w", { leaves: [], fixes: [], claims: [claim({ status: "paid", approved_at: daysAgo(3), paid_at: daysAgo(1) })] }, now);
    expect(c).toMatchObject({ status: "ok", label: "지급 완료", title: "식대 48,000원" });
  });
});
