// 날짜 기준은 한국 시간. DB의 date 컬럼(expense_date)은 반드시 'YYYY-MM-DD' 문자열과 비교한다
// (timestamp와 비교하면 인덱스의 날짜 부분을 못 쓴다 — bench 측정, performance.md §3).
const KST = "Asia/Seoul";

export function todayKst(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: KST, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

// "2026-10" → { start: "2026-10-01", end: "2026-11-01" } (end는 포함하지 않음)
export function monthRange(month: string): { start: string; end: string } {
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  if (!m) throw new Error(`월 형식이 올바르지 않습니다: ${month}`);
  const y = Number(m[1]);
  const mo = Number(m[2]);
  if (mo < 1 || mo > 12) throw new Error(`월 형식이 올바르지 않습니다: ${month}`);
  const pad = (n: number) => String(n).padStart(2, "0");
  const ny = mo === 12 ? y + 1 : y;
  const nm = mo === 12 ? 1 : mo + 1;
  return { start: `${y}-${pad(mo)}-01`, end: `${ny}-${pad(nm)}-01` };
}

export const currentMonthKst = (now: Date = new Date()) => todayKst(now).slice(0, 7);
