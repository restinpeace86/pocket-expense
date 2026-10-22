// 카드사 내역 파일 → 셀 표 (브라우저 전용, D-111). xlsx / CSV(UTF-8·EUC-KR) / 표로 된 .xls(HTML). 예전 바이너리 .xls는 다시 저장을 안내.
import type { Cell } from "./statement";

export async function readStatementFile(file: File): Promise<{ table: Cell[][] } | { error: string }> {
  const buf = new Uint8Array(await file.arrayBuffer());
  if (buf.length === 0) return { error: "빈 파일이에요." };
  if (buf[0] === 0xd0 && buf[1] === 0xcf) return { error: "예전 엑셀(.xls) 파일이라 읽을 수 없어요. 엑셀에서 열어 [다른 이름으로 저장] → .xlsx 또는 .csv로 저장한 뒤 올려 주세요." };
  if (buf[0] === 0x50 && buf[1] === 0x4b) return readXlsx(buf);
  const text = decode(buf);
  if (/<table/i.test(text)) return readHtml(text);
  return { table: parseCsv(text) };
}

async function readXlsx(buf: Uint8Array): Promise<{ table: Cell[][] } | { error: string }> {
  try {
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer);
    // 줄이 가장 많은 시트
    const ws = [...wb.worksheets].sort((a, b) => b.rowCount - a.rowCount)[0];
    if (!ws) return { error: "시트를 찾지 못했어요." };
    const table: Cell[][] = [];
    ws.eachRow({ includeEmpty: true }, (row, n) => {
      const cells: Cell[] = [];
      row.eachCell({ includeEmpty: true }, (cell, c) => {
        cells[c - 1] = cellValue(cell.value);
      });
      table[n - 1] = cells;
    });
    return { table: Array.from(table, (r) => r ?? []) };
  } catch {
    return { error: "엑셀 파일을 읽지 못했어요. .csv로 저장해 올려 보세요." };
  }
}

function cellValue(v: unknown): Cell {
  if (v == null) return null;
  if (v instanceof Date || typeof v === "number" || typeof v === "string") return v;
  if (typeof v === "object") {
    const o = v as { result?: unknown; text?: unknown; richText?: { text: string }[] };
    if (o.richText) return o.richText.map((t) => t.text).join("");
    if (o.result !== undefined) return cellValue(o.result);
    if (o.text !== undefined) return String(o.text);
  }
  return String(v);
}

function decode(buf: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buf).replace(/^﻿/, "");
  } catch {
    return new TextDecoder("euc-kr").decode(buf); // 국내 카드사 CSV는 EUC-KR이 많다
  }
}

function readHtml(text: string): { table: Cell[][] } {
  const doc = new DOMParser().parseFromString(text, "text/html");
  const tables = [...doc.querySelectorAll("table")].sort((a, b) => b.rows.length - a.rows.length);
  const t = tables[0];
  return { table: t ? [...t.rows].map((r) => [...r.cells].map((c) => c.textContent?.trim() ?? "")) : [] };
}

export function parseCsv(text: string): Cell[][] {
  const delim = (text.split("\n")[0].match(/\t/g)?.length ?? 0) > (text.split("\n")[0].match(/,/g)?.length ?? 0) ? "\t" : ",";
  const rows: Cell[][] = [];
  let row: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === delim) {
      row.push(cur);
      cur = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cur);
      rows.push(row);
      row = [];
      cur = "";
    } else cur += ch;
  }
  if (cur !== "" || row.length) {
    row.push(cur);
    rows.push(row);
  }
  return rows;
}
