import ExcelJS from "exceljs";
import { describe, expect, it, vi } from "vitest";
import type { ExportRow } from "./export-rows";
import { buildTaxWorkbook } from "./workbook";

vi.mock("server-only", () => ({}));

// 세무 마감 엑셀 정합성(7차 개선사항 5): 지출내역 합계 줄 = 행 합계, 요약의 부서별(현장·프로젝트) 묶음
const row = (o: Partial<ExportRow>): ExportRow =>
  ({
    seq: 1, kind: "current", claim_id: "c1", claim_title: "t", claim_description: "d", exception_memo: null, is_trip: false,
    trip_destination: null, trip_start: null, trip_end: null, trip_purpose: null, claim_status: "approved", self_approved: false,
    submitted_at: null, approved_at: null, paid_at: null, approvers: null, header_custom: {}, item_id: "i1", expense_date: "2026-10-15",
    merchant_name: "가게", merchant_business_number: null, evidence_type: "card_slip", supply_amount: null, vat_amount: null, amount: 10000,
    payment_method: "corporate_card", card_nickname: null, card_last4: null, account_title_name: "복리후생비", account_title_code: null,
    category: "meal", trip_type: null, purchase_type: null, department: "영업팀", member_name: "김직원", position: null, employee_number: null,
    vehicle_number: null, purpose: null, headcount: 1, attendees: null, client_name: null, lodging_in: null, lodging_out: null,
    start_location: null, end_location: null, is_round_trip: null, route_one_way_km: null, distance_km: null, distance_source: null,
    applied_meal_limit_per_person: null, applied_fuel_rate_per_km: null, company_supported_amount: 0, personal_burden_amount: 0,
    receipt_path: "co/m/c1/i1.jpg", route_card_path: null, item_custom: {},
    ...o,
  }) as ExportRow;

describe("세무 마감 엑셀", () => {
  it("지출내역 맨 아래 합계 줄과 요약의 부서별 합계", async () => {
    const rows = [
      row({ seq: 1, item_id: "a", expense_date: "2026-10-01", amount: 12000 }),
      row({ seq: 2, item_id: "b", expense_date: "2026-10-03", amount: 30000, department: "개발팀" }),
      row({ seq: 3, item_id: "c", expense_date: "2026-10-09", amount: 8000, department: null, member_name: "김대표" }),
      row({ seq: 4, item_id: "d", expense_date: "2026-10-20", amount: 5000, payment_method: "personal_card" }),
    ];
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await buildTaxWorkbook({ month: "2026-10", companyName: "포켓", rows, preview: false }));

    const sheet1 = wb.getWorksheet("지출내역")!;
    const header = (sheet1.getRow(1).values as unknown[]).map(String);
    const amountCol = header.indexOf("합계금액");
    const last = sheet1.getRow(sheet1.rowCount);
    expect(last.getCell(1).value).toBe("합계");
    expect(last.getCell(amountCol).value).toBe(55000);
    expect(sheet1.rowCount).toBe(1 + rows.length + 1);

    // 세무 업로드: 법인카드 / 개인(사비) 시트가 따로, 사비 시트엔 카드 끝 4자리 칸 없음, 거래처코드 칸 있음
    const corp = wb.getWorksheet("세무 업로드(법인카드)")!;
    const own = wb.getWorksheet("세무 업로드(개인 사비)")!;
    expect(corp.rowCount).toBe(1 + 3);
    expect(own.rowCount).toBe(1 + 1);
    const corpHead = (corp.getRow(1).values as unknown[]).map(String);
    const ownHead = (own.getRow(1).values as unknown[]).map(String);
    expect(corpHead).toContain("카드 끝 4자리");
    expect(ownHead).not.toContain("카드 끝 4자리");
    expect(corpHead.indexOf("거래처코드")).toBe(corpHead.indexOf("거래처명") - 1);
    expect(wb.getWorksheet("세무 업로드(초안)")).toBeUndefined();

    const summary = wb.getWorksheet("요약")!;
    const lines: [unknown, unknown, unknown][] = [];
    summary.eachRow((r) => lines.push([r.getCell(1).value, r.getCell(2).value, r.getCell(3).value]));
    const at = lines.findIndex((l) => l[0] === "부서별");
    expect(at).toBeGreaterThan(0);
    expect(lines.slice(at + 1, at + 4)).toEqual([
      ["개발팀", 1, 30000],
      ["영업팀", 2, 17000],
      ["부서 없음", 1, 8000],
    ]);
  });
});
