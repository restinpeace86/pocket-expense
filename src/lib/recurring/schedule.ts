// 정기 결제 일정 (D-110) — DB private.recurring_due_period와 같은 규칙: 짧은 달은 말일, 등록일 이전 결제일은 만들지 않음
export type RecurringCycle = "monthly" | "yearly";

const pad = (n: number) => String(n).padStart(2, "0");
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate(); // m: 1~12
const dateOf = (y: number, m: number, day: number) => `${y}-${pad(m)}-${pad(Math.min(day, lastDay(y, m)))}`;

// today 이후(오늘 포함) 다음 결제일. startsOn보다 앞선 날은 건너뛴다
export function nextBillingDate(p: { cycle: RecurringCycle; billingDay: number; billingMonth: number | null; startsOn: string }, today: string): string {
  const [ty, tm] = today.split("-").map(Number);
  const from = today > p.startsOn ? today : p.startsOn;
  for (let k = 0; k < 30; k++) {
    let d: string;
    if (p.cycle === "monthly") {
      const m0 = tm - 1 + k;
      d = dateOf(ty + Math.floor(m0 / 12), (m0 % 12) + 1, p.billingDay);
    } else {
      d = dateOf(ty + k, p.billingMonth ?? 1, p.billingDay);
    }
    if (d >= from) return d;
  }
  return from;
}

export function scheduleLabel(p: { cycle: RecurringCycle; billingDay: number; billingMonth: number | null }): string {
  const day = p.billingDay >= 31 ? "말일" : `${p.billingDay}일`;
  return p.cycle === "monthly" ? `매월 ${day}` : `매년 ${p.billingMonth}월 ${day}`;
}
