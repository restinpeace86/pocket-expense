// 청구 기한 (D-031, D-064, expense-lifecycle.md §6 — 항목 단위 판정, 상신은 막지 않고 경고·"기한 초과" 배지만)
// DB 함수 private.claim_deadline_date 와 같은 규칙 — 바꾸면 함께 고친다.
export type DeadlinePolicy = { type: "none" | "end_of_month" | "days_after" | "next_month_day"; days: number | null };

const ymd = (d: Date) => d.toISOString().slice(0, 10);

// 결제일 → 청구 기한(그날까지 상신하면 됨). 기한 없음이면 null
export function deadlineDate(expenseDate: string | null, p: DeadlinePolicy): string | null {
  if (!expenseDate || !/^\d{4}-\d{2}-\d{2}$/.test(expenseDate) || p.type === "none") return null;
  const [y, m, d] = expenseDate.split("-").map(Number);
  if (p.type === "end_of_month") return ymd(new Date(Date.UTC(y, m, 0)));
  if (p.type === "days_after") return ymd(new Date(Date.UTC(y, m - 1, d + (p.days ?? 30))));
  return ymd(new Date(Date.UTC(y, m, Math.min(Math.max(p.days ?? 5, 1), 28)))); // 다음 달 N일
}

// 기준일(상신했으면 상신일, 아니면 오늘 — 한국 날짜)이 기한보다 늦으면 초과
export function isOverdue(expenseDate: string | null, p: DeadlinePolicy, refDate: string): boolean {
  const dl = deadlineDate(expenseDate, p);
  return !!dl && refDate > dl;
}

// 상신 시각(UTC ISO) → 한국 날짜
export const kstDate = (iso: string) => new Date(new Date(iso).getTime() + 9 * 3600_000).toISOString().slice(0, 10);
