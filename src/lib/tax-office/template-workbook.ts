import "server-only";
import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ExportRow } from "@/lib/tax/export-rows";
import { autoMap, cellValue, rowsForTarget, type TemplateColumn, type TemplateTarget } from "./template-fields";

// 세무사무소 월말 결산 양식 엑셀 (D-150): 올린 양식 읽기(머리글 찾기)와, 양식에 세무 마감 행을 채워 내보내기.
export const TEMPLATE_BUCKET = "tax-office-templates";
export const TEMPLATE_MAX_BYTES = 5 * 1024 * 1024;

const text = (v: ExcelJS.CellValue): string => {
  if (v == null) return "";
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return String(v).trim();
  if (v instanceof Date) return "";
  if (typeof v === "object" && "richText" in v) return v.richText.map((t) => t.text).join("").trim();
  if (typeof v === "object" && "text" in v) return String(v.text ?? "").trim();
  if (typeof v === "object" && "result" in v) return String(v.result ?? "").trim();
  return "";
};

export type ParsedTemplate = { sheetName: string; headerRow: number; columns: TemplateColumn[] };

// 첫 시트에서 20줄 안의 '글자 칸이 가장 많은 줄'을 머리글로 본다(2칸 이상). 칸마다 우리 항목을 추정해 둔다
export async function parseTemplateXlsx(buf: ArrayBuffer): Promise<ParsedTemplate | null> {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buf);
  } catch {
    return null;
  }
  const ws = wb.worksheets.find((s) => s.actualRowCount > 0);
  if (!ws) return null;
  let best: { row: number; headers: { index: number; header: string }[] } | null = null;
  for (let r = 1; r <= Math.min(20, ws.rowCount); r++) {
    const headers: { index: number; header: string }[] = [];
    ws.getRow(r).eachCell({ includeEmpty: false }, (cell, col) => {
      const t = text(cell.value);
      if (t && col <= 200 && Number.isNaN(Number(t))) headers.push({ index: col, header: t.slice(0, 100) });
    });
    if (headers.length >= 2 && (!best || headers.length > best.headers.length)) best = { row: r, headers };
  }
  if (!best) return null;
  return { sheetName: ws.name, headerRow: best.row, columns: autoMap(best.headers.slice(0, 80)) };
}

type BuildInput = {
  file: ArrayBuffer | null;
  sheetName: string | null;
  headerRow: number;
  columns: TemplateColumn[];
  target: TemplateTarget;
  rows: ExportRow[];
  month: string;
};

// 양식 파일이 있으면 그 파일 그대로(머리글 위 칸·서식 유지, 머리글 아래 예시 줄은 지우고) 채운다. 없으면(초안) 머리글 한 줄짜리 새 파일
export async function buildTemplateWorkbook(input: BuildInput): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  let ws: ExcelJS.Worksheet;
  let headerRow = input.headerRow;
  if (input.file) {
    await wb.xlsx.load(input.file);
    ws = (input.sheetName && wb.getWorksheet(input.sheetName)) || wb.worksheets[0];
    if (ws.rowCount > headerRow) ws.spliceRows(headerRow + 1, ws.rowCount - headerRow);
  } else {
    ws = wb.addWorksheet("결산자료");
    headerRow = 1;
    const head = ws.getRow(1);
    for (const c of input.columns) {
      head.getCell(c.index).value = c.header;
      ws.getColumn(c.index).width = Math.max(10, Math.min(30, c.header.length * 2 + 4));
    }
    head.font = { bold: true };
    head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEEF2FF" } };
  }
  const rows = rowsForTarget(input.rows, input.target);
  const ctx = { month: input.month, total: input.rows.length };
  rows.forEach((r, i) => {
    const row = ws.getRow(headerRow + 1 + i);
    for (const c of input.columns) {
      const v = cellValue(c, r, ctx);
      if (v === null) continue;
      const cell = row.getCell(c.index);
      cell.value = v;
      if (v instanceof Date) cell.numFmt = "yyyy-mm-dd";
      else if (typeof v === "number" && ["supply", "vat", "amount", "service_fee"].includes(c.field)) cell.numFmt = "#,##0";
    }
    row.commit();
  });
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}

export type TemplateForExport = {
  id: string;
  name: string;
  target: TemplateTarget;
  file_path: string | null;
  sheet_name: string | null;
  header_row: number;
  columns: TemplateColumn[];
  office_name: string;
};

// 권한 확인(tax_template_for_export)이 끝난 양식으로 엑셀 응답을 만든다. 양식 파일은 운영 키로만 읽는다
export async function templateResponse(tpl: TemplateForExport, rows: ExportRow[], month: string, companyName: string, preview: boolean): Promise<NextResponse> {
  let file: ArrayBuffer | null = null;
  if (tpl.file_path) {
    const admin = createAdminClient();
    const { data } = admin ? await admin.storage.from(TEMPLATE_BUCKET).download(tpl.file_path) : { data: null };
    if (!data) return new NextResponse("Template file missing", { status: 404 });
    file = await data.arrayBuffer();
  }
  const buf = await buildTemplateWorkbook({ file, sheetName: tpl.sheet_name, headerRow: tpl.header_row, columns: tpl.columns, target: tpl.target, rows, month });
  const [y, mm] = month.split("-");
  const name = `${companyName}_${y}년${Number(mm)}월_${tpl.name}${preview ? "_마감전" : ""}.xlsx`.replace(/[\\/:*?"<>|]/g, "");
  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="template.xlsx"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
