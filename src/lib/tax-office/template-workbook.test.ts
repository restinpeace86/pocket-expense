import ExcelJS from "exceljs";
import { describe, expect, it, vi } from "vitest";
import type { ExportRow } from "@/lib/tax/export-rows";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => null }));
const { buildTemplateWorkbook, parseTemplateXlsx } = await import("./template-workbook");

const row = (o: Partial<ExportRow>): ExportRow =>
  ({ seq: 1, kind: "current", claim_id: "c", claim_title: "t", claim_description: null, item_id: "i", expense_date: "2026-09-15", merchant_name: "김밥", merchant_business_number: "1234567890",
     evidence_type: "card_slip", supply_amount: 9091, vat_amount: 909, amount: 10000, payment_method: "corporate_card", card_last4: "7890", card_nickname: null,
     account_title_name: "복리후생비", account_title_code: "811", category: "meal", trip_type: null, purchase_type: null, member_name: "최직원", purpose: "점심", ...o }) as ExportRow;

async function sampleFile(): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("카드매입");
  ws.getCell("A1").value = "OO세무 카드 매입 업로드 양식";
  ws.getRow(3).values = ["거래일자", "거래처명", "사업자등록번호", "공급가액", "세액", "합계", "구분코드"];
  ws.getRow(4).values = ["2020-01-01", "예시", "000-00-00000", 1, 1, 2, "x"]; // 예시 줄(지워져야 함)
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}

describe("세무사무소 결산 양식 엑셀 (D-150)", () => {
  it("머리글 줄을 찾고 칸을 추정한다", async () => {
    const p = await parseTemplateXlsx(await sampleFile());
    expect(p?.sheetName).toBe("카드매입");
    expect(p?.headerRow).toBe(3);
    expect(p?.columns.map((c) => c.field)).toEqual(["date", "merchant", "biz_no", "supply", "vat", "amount", "empty"]);
  });
  it("엑셀이 아니면 null", async () => {
    expect(await parseTemplateXlsx(new TextEncoder().encode("hello").buffer as ArrayBuffer)).toBeNull();
  });
  it("양식 파일에 채운다: 제목 줄 유지, 예시 줄 지움, 법인카드만", async () => {
    const file = await sampleFile();
    const p = (await parseTemplateXlsx(file))!;
    p.columns[6] = { ...p.columns[6], field: "fixed", fixed: "57" };
    const out = await buildTemplateWorkbook({
      file, sheetName: p.sheetName, headerRow: p.headerRow, columns: p.columns, target: "corporate_card", month: "2026-09",
      rows: [row({}), row({ item_id: "j", payment_method: "personal_card", merchant_name: "사비식당" })],
    });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(out);
    const ws = wb.getWorksheet("카드매입")!;
    expect(ws.getCell("A1").value).toBe("OO세무 카드 매입 업로드 양식");
    expect(ws.getRow(4).getCell(2).value).toBe("김밥");
    expect(ws.getRow(4).getCell(3).value).toBe("123-45-67890");
    expect(ws.getRow(4).getCell(6).value).toBe(10000);
    expect(ws.getRow(4).getCell(7).value).toBe("57");
    expect((ws.getRow(4).getCell(1).value as Date).toISOString().slice(0, 10)).toBe("2026-09-15");
    expect(ws.getRow(5).getCell(2).value ?? null).toBeNull(); // 사비 줄·예시 줄 없음
  });
  it("양식 파일이 없으면(초안) 머리글 + 행", async () => {
    const out = await buildTemplateWorkbook({
      file: null, sheetName: null, headerRow: 1, target: "all", month: "2026-09", rows: [row({})],
      columns: [{ index: 1, header: "월", field: "month" }, { index: 2, header: "금액", field: "amount" }],
    });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(out);
    const ws = wb.worksheets[0];
    expect(ws.getRow(1).getCell(1).value).toBe("월");
    expect(ws.getRow(2).getCell(1).value).toBe(9);
    expect(ws.getRow(2).getCell(2).value).toBe(10000);
  });
});
