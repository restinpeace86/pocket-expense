import { describe, expect, it } from "vitest";
import type { ExportRow } from "@/lib/tax/export-rows";
import { autoMap, cellValue, guessField, PRESETS, rowsForTarget, validColumns, type TemplateColumn } from "./template-fields";

const row = (o: Partial<ExportRow> = {}): ExportRow =>
  ({
    seq: 3, kind: "current", claim_id: "c1", claim_title: "10월 식대", claim_description: "팀 점심", exception_memo: null, is_trip: false,
    trip_destination: null, trip_start: null, trip_end: null, trip_purpose: null, claim_status: "approved", self_approved: false,
    submitted_at: null, approved_at: null, paid_at: null, approvers: null, header_custom: null, item_id: "i1", expense_date: "2026-10-05",
    merchant_name: "김밥천국", merchant_business_number: "1234567890", evidence_type: "card_slip", supply_amount: 9091, vat_amount: 909,
    amount: 10000, payment_method: "corporate_card", card_nickname: "대표카드", card_last4: "7890", account_title_name: "복리후생비",
    account_title_code: "811", category: "meal", trip_type: null, purchase_type: null, department: "영업팀", member_name: "최직원",
    position: null, employee_number: null, vehicle_number: null, purpose: "점심", headcount: 1, attendees: null, client_name: null,
    lodging_in: null, lodging_out: null, start_location: null, end_location: null, is_round_trip: null, route_one_way_km: null,
    ...o,
  }) as ExportRow;
const ctx = { month: "2026-10", total: 5 };

describe("guessField (D-150)", () => {
  it("흔한 회계 프로그램 머리글을 알아본다", () => {
    expect(guessField("거래일자")).toBe("date");
    expect(guessField(" 거래처 명 ")).toBe("merchant");
    expect(guessField("사업자등록번호")).toBe("biz_no");
    expect(guessField("계정과목코드")).toBe("account_code");
    expect(guessField("세액")).toBe("vat");
    expect(guessField("합계금액")).toBe("amount");
    expect(guessField("월")).toBe("month");
    expect(guessField("일")).toBe("day");
    expect(guessField("일련번호")).toBe("seq");
    expect(guessField("알수없는칸")).toBe("empty");
    expect(guessField("")).toBe("empty");
  });
  it("같은 항목을 두 칸에 넣지 않는다", () => {
    const cols = autoMap([
      { index: 1, header: "금액" },
      { index: 2, header: "합계" },
    ]);
    expect(cols.map((c) => c.field)).toEqual(["amount", "empty"]);
  });
});

describe("cellValue", () => {
  const col = (field: TemplateColumn["field"], fixed?: string): TemplateColumn => ({ index: 1, header: "x", field, fixed });
  it("값 규칙", () => {
    expect(cellValue(col("date"), row(), ctx)).toEqual(new Date("2026-10-05T00:00:00Z"));
    expect(cellValue(col("date8"), row(), ctx)).toBe("20261005");
    expect(cellValue(col("month"), row(), ctx)).toBe(10);
    expect(cellValue(col("day"), row(), ctx)).toBe(5);
    expect(cellValue(col("biz_no"), row(), ctx)).toBe("123-45-67890");
    expect(cellValue(col("biz_no_digits"), row(), ctx)).toBe("1234567890");
    expect(cellValue(col("supply"), row({ supply_amount: null, vat_amount: null }), ctx)).toBe(10000);
    expect(cellValue(col("vat"), row({ supply_amount: null, vat_amount: null }), ctx)).toBe(0);
    expect(cellValue(col("card_last4"), row({ payment_method: "personal_card" }), ctx)).toBe("");
    expect(cellValue(col("client_code"), row(), ctx)).toBe("");
    expect(cellValue(col("fixed", "출금"), row(), ctx)).toBe("출금");
    expect(cellValue(col("empty"), row(), ctx)).toBeNull();
    expect(cellValue(col("evidence_file"), row({ receipt_path: "c/x/r.jpg" } as Partial<ExportRow>), ctx)).toMatch(/^2026-10-003_20261005_김밥천국_10000.jpg$/);
    expect(cellValue(col("evidence_file"), row(), ctx)).toBe("");
  });
  it("대상별로 행을 고른다", () => {
    const rows = [row(), row({ item_id: "i2", payment_method: "personal_card" })];
    expect(rowsForTarget(rows, "corporate_card")).toHaveLength(1);
    expect(rowsForTarget(rows, "personal")[0].item_id).toBe("i2");
    expect(rowsForTarget(rows, "all")).toHaveLength(2);
  });
});

describe("validColumns·초안 양식", () => {
  it("검사", () => {
    expect(validColumns([{ index: 1, header: "거래일자", field: "date" }])).toBe(true);
    expect(validColumns([])).toBe(false);
    expect(validColumns([{ index: 1, header: "a", field: "date" }, { index: 1, header: "b", field: "amount" }])).toBe(false);
    expect(validColumns([{ index: 1, header: "a", field: "nope" as never }])).toBe(false);
  });
  it("초안 양식은 모두 올바른 칸", () => {
    for (const p of PRESETS) expect(validColumns(p.columns.map((c, i) => ({ ...c, index: i + 1 })))).toBe(true);
  });
});
