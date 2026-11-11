import "server-only";
import ExcelJS from "exceljs";
import type { DocModel } from "./model";

// 표 모델 → 엑셀(쪽마다 시트). 열 너비·행 높이·합친 칸·테두리·굵게·맞춤·회색 라벨 칸을 옮긴다(8-104 A-4)
const BORDER = { style: "thin" as const, color: { argb: "FF3F3F46" } };
export async function buildDocWorkbook(doc: DocModel): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Moa-on";
  const used = new Set<string>();
  for (const s of doc.sheets) {
    let name = (s.name || "시트").replace(/[\\/?*[\]:]/g, " ").slice(0, 28);
    while (used.has(name)) name += "_";
    used.add(name);
    const ws = wb.addWorksheet(name, { pageSetup: { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0, horizontalCentered: true } });
    const total = s.cols.reduce((a, b) => a + b, 0) || 1;
    ws.columns = s.cols.map((w) => ({ width: Math.max(4, Math.round((w / total) * 95)) }));
    s.cells.forEach((row, r) => {
      const xr = ws.getRow(r + 1);
      xr.height = 20 * (s.heights[r] ?? 1);
      row.forEach((c, ci) => {
        const x = xr.getCell(ci + 1);
        x.value = c.t;
        x.border = { top: BORDER, left: BORDER, bottom: BORDER, right: BORDER };
        x.alignment = { vertical: "middle", horizontal: c.al === "c" ? "center" : c.al === "r" ? "right" : "left", wrapText: true };
        x.font = { name: "맑은 고딕", size: 10, bold: !!c.b };
        if (c.bg) x.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF4F4F5" } };
      });
    });
    for (const g of s.merges) ws.mergeCells(g.r + 1, g.c + 1, g.r + g.rs, g.c + g.cs);
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}
