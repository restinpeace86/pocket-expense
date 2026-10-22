// 카드사 사용 내역(엑셀·CSV) 읽기 (D-111) — 카드사마다 모양이 달라 머리글 이름으로 열을 찾고, 못 찾으면 관리자가 고른다.
// 브라우저에서 표(셀 2차원 배열)로 바꾼 뒤 여기서 행으로 만든다. 파일은 저장하지 않는다.
export type Cell = string | number | Date | null | undefined;
export type StatementRow = { line: number; date: string; merchant: string; amount: number; last4: string | null; cancelled: boolean };
export type ColumnMap = { date: number; merchant: number; amount: number; card: number | null; status: number | null };

const KEYS = {
  date: ["이용일자", "이용일", "승인일자", "승인일", "거래일자", "거래일", "사용일자", "사용일", "매출일자", "매출일", "일자", "날짜", "일시"],
  merchant: ["가맹점명", "이용가맹점", "가맹점", "이용처", "사용처", "상호", "내용"],
  // 앞쪽일수록 우선(실제 결제 금액). 청구·결제예정 금액은 할부면 일부만이라 뒤로
  amount: ["이용금액", "승인금액", "매출금액", "사용금액", "결제금액", "거래금액", "금액", "청구금액", "결제예정금액"],
  card: ["카드번호", "이용카드", "카드"],
  status: ["취소여부", "취소", "승인구분", "상태", "구분"],
};
const NOT_AMOUNT = ["할부", "수수료", "포인트", "잔액", "원금", "개월", "이자"];

const text = (c: Cell): string => (c instanceof Date ? c.toISOString() : c == null ? "" : String(c)).replace(/\s+/g, " ").trim();
const norm = (s: string) => s.replace(/[\s()[\]_·.-]/g, "");

function findCol(headers: string[], keys: string[], exclude: string[] = [], taken: number[] = []): number | null {
  const h = headers.map(norm);
  for (const k of keys) {
    const i = h.findIndex((x, idx) => !taken.includes(idx) && x.includes(norm(k)) && !exclude.some((e) => x.includes(e)));
    if (i >= 0) return i;
  }
  return null;
}

// 머리글 줄 찾기: 앞 30줄 중 날짜·금액 머리글이 함께 있는 첫 줄
export function detectColumns(table: Cell[][]): { headerRow: number; headers: string[]; map: ColumnMap } | null {
  for (let r = 0; r < Math.min(table.length, 30); r++) {
    const headers = (table[r] ?? []).map(text);
    const date = findCol(headers, KEYS.date);
    const amount = findCol(headers, KEYS.amount, NOT_AMOUNT, date !== null ? [date] : []);
    if (date === null || amount === null) continue;
    const merchant = findCol(headers, KEYS.merchant, [], [date, amount]) ?? -1;
    const card = findCol(headers, KEYS.card, ["카드사", "카드종류"], [date, amount, merchant]);
    const status = findCol(headers, KEYS.status, [], [date, amount, merchant, ...(card !== null ? [card] : [])]);
    return { headerRow: r, headers, map: { date, merchant, amount, card, status } };
  }
  return null;
}

const pad = (n: number) => String(n).padStart(2, "0");
export function parseDate(c: Cell, fallbackYear: number): string | null {
  if (c instanceof Date && !Number.isNaN(c.getTime())) {
    const k = new Date(c.getTime() + 9 * 3600_000); // 엑셀 날짜는 KST 자정 기준이 많다
    return `${k.getUTCFullYear()}-${pad(k.getUTCMonth() + 1)}-${pad(k.getUTCDate())}`;
  }
  if (typeof c === "number" && c > 20000 && c < 80000) {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(c) * 86400_000); // 엑셀 날짜 일련번호
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  }
  const s = text(c);
  let m = s.match(/(20\d{2})\D?(\d{1,2})\D?(\d{1,2})/);
  if (m) return valid(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{2})[./-](\d{1,2})[./-](\d{1,2})/);
  if (m) return valid(2000 + +m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[./-](\d{1,2})(?!\d)/);
  if (m) return valid(fallbackYear, +m[1], +m[2]);
  return null;
}
function valid(y: number, mo: number, d: number): string | null {
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return `${y}-${pad(mo)}-${pad(d)}`;
}

export function parseAmount(c: Cell): number | null {
  if (typeof c === "number") return Number.isFinite(c) ? Math.round(c) : null;
  const s = text(c);
  if (!/\d/.test(s)) return null;
  const neg = /^-|^\(|△|▲/.test(s);
  const n = Number(s.replace(/[^0-9]/g, ""));
  return Number.isFinite(n) ? (neg ? -n : n) : null;
}

export function last4Of(c: Cell): string | null {
  const groups = text(c).match(/\d{4}/g);
  return groups?.length ? groups[groups.length - 1] : null;
}

export function toRows(table: Cell[][], headerRow: number, map: ColumnMap, fallbackYear: number): { rows: StatementRow[]; skipped: number } {
  const rows: StatementRow[] = [];
  let skipped = 0;
  for (let r = headerRow + 1; r < table.length; r++) {
    const line = table[r] ?? [];
    if (line.every((c) => text(c) === "")) continue;
    const date = parseDate(line[map.date], fallbackYear);
    const amount = parseAmount(line[map.amount]);
    if (!date || amount === null || amount === 0) {
      skipped++; // 합계·소계·빈 줄
      continue;
    }
    const status = map.status !== null ? text(line[map.status]) : "";
    rows.push({
      line: r + 1,
      date,
      merchant: map.merchant >= 0 ? text(line[map.merchant]) : "",
      amount: Math.abs(amount),
      last4: map.card !== null ? last4Of(line[map.card]) : null,
      cancelled: amount < 0 || /취소|환불/.test(status),
    });
  }
  return { rows, skipped };
}
