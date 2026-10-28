// 홈택스에서 내려받은 파일 → 머리글·미리보기 (D-158). .xlsx / 예전 .xls / CSV(UTF-8·EUC-KR) 모두 SheetJS로 읽는다.
// 원본은 그대로 보관하고, 여기서는 화면에 보여 줄 표만 만든다(대조는 실제 파일 형식을 확인한 다음 단계)
import * as XLSX from "xlsx";

export const PREVIEW_ROWS = 30;
const MAX_COLS = 30;
const MAX_CELL = 100;

export type HometaxTable = { header: string[]; preview: string[][]; rowCount: number };

function decodeText(buf: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buf).replace(/^\uFEFF/, "");
  } catch {
    return new TextDecoder("euc-kr").decode(buf); // 홈택스 CSV는 대개 EUC-KR
  }
}

const cellText = (v: unknown): string => {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, MAX_CELL);
};

// 머리글 줄: 위쪽 20줄 중 글자 칸(숫자가 아닌 칸)이 가장 많은 줄. 안내 문구·제목 줄을 건너뛴다
export function findHeaderRow(table: string[][]): number {
  let best = 0;
  let score = -1;
  for (let i = 0; i < Math.min(table.length, 20); i++) {
    const s = table[i].filter((c) => c !== "" && !/^[-+]?[\d,.]+$/.test(c)).length;
    if (s > score) {
      best = i;
      score = s;
    }
  }
  return best;
}

export function readHometaxTable(bytes: Uint8Array, fileName: string): HometaxTable | null {
  try {
    const wb = /\.csv$/i.test(fileName) ? XLSX.read(decodeText(bytes), { type: "string", raw: true }) : XLSX.read(bytes, { type: "array", cellDates: true });
    // 줄이 가장 많은 시트
    const sheets = wb.SheetNames.map((n) => XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[n], { header: 1, raw: false, defval: "" }));
    const raw = sheets.sort((a, b) => b.length - a.length)[0];
    if (!raw) return null;
    const table = raw.map((r) => (r ?? []).slice(0, MAX_COLS).map(cellText)).filter((r) => r.some((c) => c !== ""));
    if (table.length === 0) return null;
    const h = findHeaderRow(table);
    if (!table[h].some((c) => /[^\d\s,.+-]/.test(c))) return null; // 글자로 된 머리글이 없으면 표가 아님
    const body = table.slice(h + 1);
    return { header: table[h], preview: body.slice(0, PREVIEW_ROWS), rowCount: body.length };
  } catch {
    return null;
  }
}
