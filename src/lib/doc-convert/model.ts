// 서류 → 엑셀 변환의 표 모델 (8-104 A, spec/features/company-forms.md §A-3)
// AI는 쪽마다 HTML 표처럼 "행 → 칸(합친 칸 col_span/row_span)"을 준다 → 여기서 꽉 찬 격자(rows × cols) + 합친 칸 목록으로 바꾼다.
// 같은 모델로 앱 화면·엑셀·PDF를 만든다. 앱에서 고칠 수 있는 것: 글자, 행 추가/삭제(2026-11-11 범위). 나머지는 [엑셀 받기] 뒤 엑셀에서.

export type Align = "l" | "c" | "r";
export type Cell = { t: string; b?: boolean; al?: Align; bg?: boolean };
export type Merge = { r: number; c: number; rs: number; cs: number };
export type Sheet = { name: string; cols: number[]; heights: number[]; cells: Cell[][]; merges: Merge[] };
export type DocModel = { v: 1; sheets: Sheet[] };

export const MAX_PAGES = 5;
export const MAX_ROWS = 200;
export const MAX_COLS = 30;
export const MAX_CELL = 500;
export const DRAFT_DAYS = 30;
export const CONVERT_MIMES = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;

export function isConvertible(mime: string | null | undefined): boolean {
  return !!mime && (CONVERT_MIMES as readonly string[]).includes(mime);
}

// AI 응답(쪽마다)
export type AiCell = { text?: string | null; col_span?: number | null; row_span?: number | null; bold?: boolean | null; align?: string | null; shaded?: boolean | null };
export type AiPage = { title?: string | null; col_widths?: number[] | null; rows?: { height?: number | null; cells?: AiCell[] | null }[] | null };

const int = (n: unknown, min: number, max: number) => Math.min(max, Math.max(min, Math.round(Number(n) || min)));
const text = (s: unknown) => (typeof s === "string" ? s.replace(/\r/g, "").replace(/[ \t]+\n/g, "\n").trim().slice(0, MAX_CELL) : "");

// HTML 표 배치와 같은 방식: 이미 위에서 내려온 합친 칸 자리는 건너뛰며 왼쪽부터 채운다
// onCell: 회사 양식 읽기(8-104 B)가 값 칸 표시(slot)를 받아 가는 자리 — 칸이 놓인 격자 위치와 AI 칸
export function sheetFromAi(page: AiPage, name: string, onCell?: (r: number, c: number, ac: AiCell) => void): Sheet | null {
  const rows = (page.rows ?? []).slice(0, MAX_ROWS);
  if (!rows.length) return null;
  const taken: boolean[][] = [];
  const placed: { r: number; c: number; rs: number; cs: number; cell: Cell }[] = [];
  let cols = 0;
  rows.forEach((row, r) => {
    taken[r] ??= [];
    let c = 0;
    for (const ac of row.cells ?? []) {
      while (taken[r][c]) c++;
      if (c >= MAX_COLS) break;
      const cs = int(ac.col_span ?? 1, 1, MAX_COLS - c);
      const rs = int(ac.row_span ?? 1, 1, rows.length - r);
      for (let i = r; i < r + rs; i++) {
        taken[i] ??= [];
        for (let j = c; j < c + cs; j++) taken[i][j] = true;
      }
      const al = ac.align === "center" ? "c" : ac.align === "right" ? "r" : undefined;
      onCell?.(r, c, ac);
      placed.push({ r, c, rs, cs, cell: { t: text(ac.text), ...(ac.bold ? { b: true } : {}), ...(al ? { al } : {}), ...(ac.shaded ? { bg: true } : {}) } });
      c += cs;
      cols = Math.max(cols, c);
    }
  });
  if (!cols || !placed.some((p) => p.cell.t)) return null;
  const R = rows.length;
  const cells: Cell[][] = Array.from({ length: R }, () => Array.from({ length: cols }, () => ({ t: "" })));
  const merges: Merge[] = [];
  for (const p of placed) {
    cells[p.r][p.c] = p.cell;
    if (p.rs > 1 || p.cs > 1) merges.push({ r: p.r, c: p.c, rs: p.rs, cs: p.cs });
  }
  const w = page.col_widths ?? [];
  const widths = Array.from({ length: cols }, (_, i) => (Number(w[i]) > 0 ? Number(w[i]) : 1));
  const sum = widths.reduce((a, b) => a + b, 0);
  return {
    name,
    cols: widths.map((x) => Math.max(4, Math.round((x / sum) * 100))), // 열 너비 = 전체 100 기준 비율
    heights: rows.map((row) => int(row.height ?? 1, 1, 6)), // 행 높이 = 보통 줄 1 ~ 6배
    cells,
    merges,
  };
}

export function docFromAi(pages: AiPage[]): DocModel | null {
  const sheets = pages
    .slice(0, MAX_PAGES)
    .map((p, i) => sheetFromAi(p, `${i + 1}쪽`))
    .filter((s): s is Sheet => !!s);
  return sheets.length ? { v: 1, sheets } : null;
}

// 합친 칸에 덮인 칸(왼쪽 위 칸이 아닌 자리) → 그 합친 칸
export function coverMap(sheet: Sheet): Map<string, Merge> {
  const m = new Map<string, Merge>();
  for (const g of sheet.merges) for (let r = g.r; r < g.r + g.rs; r++) for (let c = g.c; c < g.c + g.cs; c++) if (r !== g.r || c !== g.c) m.set(`${r}:${c}`, g);
  return m;
}
export function mergeAt(sheet: Sheet, r: number, c: number): Merge | undefined {
  return sheet.merges.find((g) => g.r === r && g.c === c);
}
// 덮인 칸을 고르면 그 합친 칸의 왼쪽 위로
export function anchorOf(sheet: Sheet, r: number, c: number): { r: number; c: number } {
  const g = sheet.merges.find((x) => r >= x.r && r < x.r + x.rs && c >= x.c && c < x.c + x.cs);
  return g ? { r: g.r, c: g.c } : { r, c };
}

export function colName(c: number): string {
  let s = "";
  let n = c + 1;
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}
export const cellAddress = (r: number, c: number) => `${colName(c)}${r + 1}`;

const cloneSheet = (s: Sheet): Sheet => ({ ...s, cols: [...s.cols], heights: [...s.heights], cells: s.cells.map((row) => row.map((c) => ({ ...c }))), merges: s.merges.map((g) => ({ ...g })) });

export function setCellText(sheet: Sheet, r: number, c: number, t: string): Sheet {
  const s = cloneSheet(sheet);
  if (!s.cells[r]?.[c]) return sheet;
  s.cells[r][c].t = t.slice(0, MAX_CELL);
  return s;
}

// r 행 아래에 빈 행 넣기. r 행을 지나 아래로 이어지는 합친 칸은 한 행 늘어난다
export function addRowBelow(sheet: Sheet, r: number): Sheet {
  if (sheet.cells.length >= MAX_ROWS) return sheet;
  const s = cloneSheet(sheet);
  const at = r + 1;
  s.cells.splice(at, 0, Array.from({ length: s.cols.length }, () => ({ t: "" })));
  s.heights.splice(at, 0, 1);
  s.merges = s.merges.map((g) => (g.r >= at ? { ...g, r: g.r + 1 } : g.r + g.rs > at ? { ...g, rs: g.rs + 1 } : g));
  return s;
}

// r 행 지우기(마지막 한 행은 못 지움). 그 행을 지나는 합친 칸은 한 행 줄고, 그 행에서 시작하던 합친 칸은 글자를 다음 행으로 옮긴다
export function deleteRow(sheet: Sheet, r: number): Sheet {
  if (sheet.cells.length <= 1 || !sheet.cells[r]) return sheet;
  const s = cloneSheet(sheet);
  for (const g of s.merges) if (g.r === r && g.rs > 1) s.cells[r + 1][g.c] = s.cells[r][g.c];
  s.cells.splice(r, 1);
  s.heights.splice(r, 1);
  s.merges = s.merges
    .map((g) => (g.r > r ? { ...g, r: g.r - 1 } : g.r + g.rs > r ? { ...g, rs: g.rs - 1 } : g))
    .filter((g) => g.rs >= 1 && (g.rs > 1 || g.cs > 1));
  return s;
}

// 저장 전 모양 확인(서버 액션에서 — 이상한 값이 DB로 가지 않게)
export function validDoc(x: unknown): x is DocModel {
  if (!x || typeof x !== "object") return false;
  const d = x as DocModel;
  if (d.v !== 1 || !Array.isArray(d.sheets) || d.sheets.length < 1 || d.sheets.length > MAX_PAGES) return false;
  return d.sheets.every((s) => {
    const C = Array.isArray(s.cols) ? s.cols.length : 0;
    if (!C || C > MAX_COLS || !Array.isArray(s.cells) || !s.cells.length || s.cells.length > MAX_ROWS) return false;
    if (!Array.isArray(s.heights) || s.heights.length !== s.cells.length || !Array.isArray(s.merges) || typeof s.name !== "string") return false;
    if (!s.cells.every((row) => Array.isArray(row) && row.length === C && row.every((c) => c && typeof c.t === "string" && c.t.length <= MAX_CELL))) return false;
    return s.merges.every((g) => g.r >= 0 && g.c >= 0 && g.rs >= 1 && g.cs >= 1 && g.r + g.rs <= s.cells.length && g.c + g.cs <= C);
  });
}

// 초안 삭제까지 남은 날(KST 기준 대략)
export function draftDaysLeft(createdAt: string, now = Date.now()): number {
  const left = DRAFT_DAYS - Math.floor((now - new Date(createdAt).getTime()) / 86_400_000);
  return Math.max(0, left);
}

export function convertErrorMessage(message: string): string {
  if (message.includes("NO_CREDITS")) return "지금은 변환할 수 없어요. 관리자에게 문의해 주세요.";
  if (message.includes("TOO_MANY_PAGES")) return `한 번에 ${MAX_PAGES}쪽까지 변환할 수 있어요. 필요한 쪽만 나눠서 올려 주세요.`;
  if (message.includes("NOT_CONVERTIBLE")) return "사진(JPG·PNG)이나 PDF만 엑셀로 바꿀 수 있어요.";
  if (message.includes("EXPIRED")) return "보관 기간이 지났거나 지워진 파일이에요.";
  if (message.includes("TOO_LARGE")) return "20MB보다 작은 파일만 바꿀 수 있어요.";
  if (message.includes("NO_TABLE")) return "표를 찾지 못했어요. 표가 잘 보이게 다시 찍어 주세요.";
  if (message.includes("FEATURE_DISABLED")) return "회사에서 채팅을 쓰지 않고 있어요.";
  if (message.includes("NOT_ALLOWED")) return "이 변환은 만든 사람만 바꿀 수 있어요.";
  if (message.includes("NOT_FOUND")) return "변환을 찾을 수 없어요.";
  return "잠시 후 다시 시도해 주세요.";
}

// 받기 파일 이름: 원본 이름에서 확장자 빼고
export function baseName(name: string): string {
  return (name.replace(/\.[a-z0-9]{2,5}$/i, "").replace(/[\\/:*?"<>|]+/g, " ").trim() || "변환").slice(0, 80);
}
