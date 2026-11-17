// 결재 문서의 표 칸(줄 추가, 9-33e7) — 예: 구매요청서 품목 표(품목·규격·수량·단가·금액 + 빈 줄 여러 개)
// 관리자는 표의 첫 빈 칸(머리글 바로 아래 왼쪽) 하나만 '표'로 정하면, 머리글 줄과 아래 빈 줄을 읽어 열·줄 수를 알아낸다.
// 직원은 줄을 더해 쓰고, 회사 양식의 줄보다 많으면 문서(PDF·엑셀)에 줄을 더 넣는다(양식 아래 칸은 그대로 밀려 내려감).
import { anchorOf, type Merge, type Sheet } from "@/lib/doc-convert/model";

export type TableColType = "text" | "number" | "money";
export type TableCol = { label: string; c: number; type: TableColType };
export const MAX_TABLE_COLS = 8;
export const MAX_TABLE_ROWS = 50; // 양식에 있는 빈 줄 수
export const MAX_TABLE_INPUT_ROWS = 100; // 직원이 쓸 수 있는 줄 수
export const TABLE_COL_LABEL: Record<TableColType, string> = { text: "글", number: "숫자", money: "금액" };

const covered = (sheet: Sheet, r: number, c: number) => {
  const a = anchorOf(sheet, r, c);
  return a.r !== r || a.c !== c;
};
const text = (sheet: Sheet, r: number, c: number) => (sheet.cells[r]?.[c]?.t ?? "").trim();
const SUM_ROW = /^(합\s*계|소\s*계|총\s*계|계|total)$/i;

export function guessColType(label: string): TableColType {
  const t = label.replace(/\s+/g, "");
  if (/(금액|단가|가격|비용|합계|원\)?$)/.test(t)) return "money";
  if (/(수량|개수|인원|매수|수$)/.test(t)) return "number";
  return "text";
}

// (r, c) = 표 첫 빈 칸. 머리글 = 바로 위 줄. 열 = 오른쪽으로 머리글 글자가 있는 칸까지(합친 칸은 한 열),
// 줄 = 아래로 그 열들이 모두 비어 있는 줄까지('합계' 줄·글자 있는 줄에서 멈춤)
export function detectTable(sheet: Sheet, r: number, c: number): { cols: TableCol[]; rows: number } | null {
  if (r < 1 || !sheet.cells[r]?.[c] || text(sheet, r, c)) return null;
  const head = r - 1;
  const cols: TableCol[] = [];
  for (let x = c; x < sheet.cols.length && cols.length < MAX_TABLE_COLS; x++) {
    if (covered(sheet, r, x)) continue; // 합친 칸 안쪽
    const ha = anchorOf(sheet, head, x);
    const label = text(sheet, ha.r, ha.c);
    if (!label || text(sheet, r, x)) break;
    if (cols.some((k) => anchorOf(sheet, head, k.c).c === ha.c)) continue; // 머리글이 합쳐져 같은 열
    cols.push({ label: label.slice(0, 20), c: x, type: guessColType(label) });
  }
  if (!cols.length) return null;
  let rows = 0;
  for (let y = r; y < sheet.cells.length && rows < MAX_TABLE_ROWS; y++) {
    if (cols.some((k) => text(sheet, y, k.c)) || SUM_ROW.test(text(sheet, y, cols[0].c - 1 >= 0 ? cols[0].c - 1 : 0).replace(/\s/g, ""))) break;
    if (cols.some((k) => covered(sheet, y, k.c))) break;
    rows++;
  }
  return rows ? { cols, rows } : null;
}

// 표 칸이 차지하는 칸들(다른 칸 지울 때)
export function tableCells(r: number, cols: TableCol[], rows: number): { r: number; c: number }[] {
  const out: { r: number; c: number }[] = [];
  for (let y = r; y < r + rows; y++) for (const k of cols) out.push({ r: y, c: k.c });
  return out;
}

const num = (v: string) => Number((v ?? "").replace(/[^0-9.-]/g, ""));
export function tableCellText(type: TableColType, v: string): string {
  const s = (v ?? "").trim();
  if (!s) return "";
  if (type === "money") return Number.isFinite(num(s)) ? num(s).toLocaleString("ko-KR") : s;
  if (type === "number") return Number.isFinite(num(s)) ? String(num(s)) : s;
  return s;
}
// 빈 줄은 빼고(모든 칸이 빈 줄)
export const cleanRows = (rows: string[][]) => rows.filter((row) => row.some((v) => (v ?? "").trim()));
// 마지막 금액 열의 합계(목록·결재 화면의 금액)
export function tableTotal(cols: TableCol[], rows: string[][]): number | null {
  const i = cols.map((k) => k.type).lastIndexOf("money");
  if (i < 0) return null;
  const vals = cleanRows(rows).map((row) => num(row[i] ?? "")).filter((n) => Number.isFinite(n));
  return vals.length ? vals.reduce((a, b) => a + b, 0) : null;
}

// 표를 시트에 채움: 양식 줄 수만큼 그대로, 넘치면 마지막 표 줄 아래에 줄을 더 넣는다(그 줄의 가로 합친 칸도 따라 만든다)
export function fillTable(sheet: Sheet, r: number, cols: TableCol[], formRows: number, rows: string[][]): Sheet {
  const data = cleanRows(rows);
  const s: Sheet = { ...sheet, cells: sheet.cells.map((row) => row.map((cell) => ({ ...cell }))), heights: [...sheet.heights], merges: sheet.merges.map((g) => ({ ...g })) };
  const extra = Math.max(0, data.length - formRows);
  if (extra) {
    const last = r + formRows - 1;
    const rowMerges = s.merges.filter((g) => g.r === last && g.rs === 1);
    for (let i = 0; i < extra; i++) {
      const at = last + 1 + i;
      s.cells.splice(at, 0, s.cells[last].map((cell) => ({ ...cell, t: "" })));
      s.heights.splice(at, 0, s.heights[last] ?? 1);
      s.merges = s.merges.map((g) => (g.r >= at ? { ...g, r: g.r + 1 } : g.r + g.rs > at ? { ...g, rs: g.rs + 1 } : g));
      s.merges.push(...rowMerges.map((g): Merge => ({ ...g, r: at })));
    }
  }
  const total = formRows + extra;
  for (let y = 0; y < total; y++) {
    const row = data[y];
    for (let i = 0; i < cols.length; i++) {
      const cell = s.cells[r + y]?.[cols[i].c];
      if (cell) cell.t = row ? tableCellText(cols[i].type, row[i] ?? "") : "";
    }
  }
  return s;
}
