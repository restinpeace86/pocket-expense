// 청구 마감 (D-161, 개선사항 1 — D-031·D-064의 회사별 기한을 대체): 모든 회사 같은 규칙.
// - 직원 청구 마감 = 사용한 달의 다음 달 2일, 세무 마감 = 다음 달 5일. 쉬는 날(주말·공휴일)이면 앞 영업일로 당긴다
// - 마감이 지나 상신한 영수증도 상신은 되고, 정산(세무 마감) 달이 상신한 달로 넘어간다
// DB 함수 private.prev_working_day / claim_cutoff / tax_close_due / settlement_month 와 같은 규칙 — 바꾸면 함께 고친다.
export type DeadlinePolicy = { holidays: string[] }; // 공휴일(YYYY-MM-DD) — kr_holidays

const ymd = (d: Date) => d.toISOString().slice(0, 10);
const day = (s: string) => new Date(`${s}T00:00:00Z`);

export function prevWorkingDay(date: string, holidays: string[]): string {
  const off = new Set(holidays);
  const d = day(date);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6 || off.has(ymd(d))) d.setUTCDate(d.getUTCDate() - 1);
  return ymd(d);
}

// 그 달(YYYY-MM)의 다음 달 n일을 영업일로 당긴 날
function nextMonthDay(month: string, n: number, holidays: string[]): string {
  const [y, m] = month.split("-").map(Number);
  return prevWorkingDay(ymd(new Date(Date.UTC(y, m, n))), holidays);
}
export const claimCutoff = (month: string, holidays: string[]) => nextMonthDay(month, 2, holidays);
export const taxCloseDue = (month: string, holidays: string[]) => nextMonthDay(month, 5, holidays);

// 사용일 → 청구 마감일. 날짜가 없으면 null
export function deadlineDate(expenseDate: string | null, p: DeadlinePolicy): string | null {
  if (!expenseDate || !/^\d{4}-\d{2}-\d{2}$/.test(expenseDate)) return null;
  return claimCutoff(expenseDate.slice(0, 7), p.holidays);
}

// 기준일(상신했으면 상신일, 아니면 오늘 — 한국 날짜)이 마감보다 늦으면 늦은 청구(다음 달 정산)
export function isOverdue(expenseDate: string | null, p: DeadlinePolicy, refDate: string): boolean {
  const dl = deadlineDate(expenseDate, p);
  return !!dl && refDate > dl;
}

// 정산 달: 마감 안에 상신하면 사용한 달, 늦으면 상신한 달
export function settlementMonth(expenseDate: string, p: DeadlinePolicy, refDate: string): string {
  const used = expenseDate.slice(0, 7);
  return isOverdue(expenseDate, p, refDate) && refDate.slice(0, 7) > used ? refDate.slice(0, 7) : used;
}

export const monthLabel = (month: string) => `${Number(month.slice(5, 7))}월`;
export const mdLabel = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;

// 상신 시각(UTC ISO) → 한국 날짜
export const kstDate = (iso: string) => new Date(new Date(iso).getTime() + 9 * 3600_000).toISOString().slice(0, 10);
