import { describe, expect, it } from "vitest";
import type { ReconcileResult } from "./reconcile";
import { issuesFromResult, majorityMonth, reconcileStatus, STATUS_OPTIONS } from "./saved";

const row = (o: Partial<ReconcileResult["missing"][number]> = {}) => ({ line: 1, date: "2026-09-03", merchant: "주유소", amount: 50000, last4: "7890", cancelled: false, ...o });
const item = (id: string) => ({ id, claimId: "c", claimTitle: "9월", claimStatus: "submitted", memberName: "최직원", date: "2026-09-07", amount: 8000, merchant: "카페", paymentMethod: "personal_card" as const, last4: null });

describe("카드 대조 저장 (D-154)", () => {
  it("맞지 않는 건 → 지문(같은 건이 여러 번이면 순번)", () => {
    const r: ReconcileResult = { matched: [], personal: [{ row: row({ amount: 8000 }), item: item("i1") }], missing: [row(), row(), row({ merchant: "마 트", amount: 12000 })], extra: [item("i2")], cancelled: 0 };
    const out = issuesFromResult(r);
    expect(out.map((x) => x.kind)).toEqual(["missing", "missing", "missing", "personal", "extra"]);
    expect(out[0].fingerprint).toBe("m|2026-09-03|50000|7890|주유소");
    expect(out[1].fingerprint).toBe("m|2026-09-03|50000|7890|주유소#2");
    expect(out[2].fingerprint).toBe("m|2026-09-03|12000|7890|마트");
    expect(out[3]).toMatchObject({ fingerprint: "p|i1", item_id: "i1", claim_title: "9월", member_name: "최직원" });
    expect(out[4].fingerprint).toBe("e|i2");
  });
  it("가장 많은 달", () => {
    expect(majorityMonth(["2026-08-31", "2026-09-01", "2026-09-02"])).toBe("2026-09");
    expect(majorityMonth([])).toBeNull();
  });
  it("상태 요약", () => {
    expect(reconcileStatus(null)).toEqual({ kind: "none" });
    const base = { updated_at: "t", issues: [{ status: "open" }, { status: "tax_review" }] } as never;
    expect(reconcileStatus(base)).toMatchObject({ kind: "open", open: 1, total: 2 });
    expect(reconcileStatus({ updated_at: "t", issues: [] } as never)).toMatchObject({ kind: "done", total: 0 });
  });
  it("구분별 처리 선택지", () => {
    expect(STATUS_OPTIONS.missing).toContain("claim_requested");
    expect(STATUS_OPTIONS.personal).not.toContain("personal_use");
  });
});
