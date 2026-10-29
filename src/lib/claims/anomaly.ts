// 이상 거래 표시 (D-162, reference 4-1 ④) — 결재 화면 영수증 옆 경고 배지. 막지 않고 눈에 띄게만.
// ① 심야 결제(22~06시) ② 주말·공휴일 결제 ③ 같은 날 같은 가맹점 여러 건(쪼개기 결제 의심) ④ 그 직원 평소(최근 결제 중간값)의 3배 이상 · 5만 원 이상
export type AnomalyItem = { id: string; expense_date: string | null; paid_time: string | null; merchant_name: string | null; amount: number | null };
export type AnomalyPeer = { id: string; expense_date: string | null; merchant_name: string | null; amount: number | null };

export const LARGE_MULTIPLE = 3;
export const LARGE_MIN_AMOUNT = 50_000;
const MIN_HISTORY = 5;

const norm = (s: string | null) => (s ?? "").replace(/\s|\(주\)|㈜|주식회사/g, "").toLowerCase();

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function anomalyFlags(item: AnomalyItem, peers: AnomalyPeer[], holidays: string[]): string[] {
  const flags: string[] = [];
  const hour = item.paid_time ? Number(item.paid_time.slice(0, 2)) : NaN;
  if (!Number.isNaN(hour) && (hour >= 22 || hour < 6)) flags.push(`심야 결제(${item.paid_time!.slice(0, 5)})`);
  if (item.expense_date) {
    const dow = new Date(`${item.expense_date}T00:00:00Z`).getUTCDay();
    if (dow === 0 || dow === 6) flags.push("주말 결제");
    else if (holidays.includes(item.expense_date)) flags.push("공휴일 결제");
  }
  const m = norm(item.merchant_name);
  if (m && item.expense_date) {
    const same = peers.filter((p) => p.id !== item.id && p.expense_date === item.expense_date && norm(p.merchant_name) === m).length;
    if (same > 0) flags.push(`같은 날 같은 가맹점 ${same + 1}건`);
  }
  const history = peers.filter((p) => p.id !== item.id && (p.amount ?? 0) > 0).map((p) => p.amount as number);
  if (item.amount && item.amount >= LARGE_MIN_AMOUNT && history.length >= MIN_HISTORY) {
    const med = median(history);
    if (med > 0 && item.amount >= med * LARGE_MULTIPLE) flags.push(`평소의 ${Math.floor(item.amount / med)}배 금액`);
  }
  return flags;
}
