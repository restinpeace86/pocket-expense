// 법인카드 사용 내역 ↔ 올라온 영수증 짝 맞추기 (D-111)
// 같은 금액 + 날짜 ±1일(승인일·매입일 차이) + 카드 끝 4자리(둘 다 있으면 같아야 함). 한 영수증은 한 결제에만.
import type { StatementRow } from "./statement";

export type LedgerItem = {
  id: string;
  claimId: string;
  claimTitle: string;
  claimStatus: string;
  memberName: string;
  date: string;
  amount: number;
  merchant: string;
  paymentMethod: "corporate_card" | "personal_card";
  last4: string | null;
};

export type ReconcileResult = {
  matched: { row: StatementRow; item: LedgerItem }[];
  personal: { row: StatementRow; item: LedgerItem }[]; // 카드 내역에 있는데 개인(사비)으로 올림 → 이중 지급 위험
  missing: StatementRow[]; // 카드는 썼는데 결의서가 없음
  extra: LedgerItem[]; // 법인카드로 올렸는데 카드 내역에 없음
  cancelled: number;
};

const dayDiff = (a: string, b: string) => Math.round(Math.abs(Date.parse(a) - Date.parse(b)) / 86400_000);
const plain = (s: string) => s.replace(/[\s()㈜(주)]/g, "").toLowerCase();

export function reconcile(rows: StatementRow[], items: LedgerItem[]): ReconcileResult {
  const used = new Set<string>();
  const out: ReconcileResult = { matched: [], personal: [], missing: [], extra: [], cancelled: 0 };
  const live = rows.filter((r) => {
    if (r.cancelled) out.cancelled++;
    return !r.cancelled;
  });
  for (const row of [...live].sort((a, b) => a.date.localeCompare(b.date))) {
    let best: LedgerItem | null = null;
    let bestScore = -1;
    for (const it of items) {
      if (used.has(it.id) || it.amount !== row.amount || dayDiff(it.date, row.date) > 1) continue;
      if (row.last4 && it.last4 && row.last4 !== it.last4) continue;
      const m1 = plain(row.merchant);
      const m2 = plain(it.merchant);
      const score =
        (row.last4 && it.last4 === row.last4 ? 4 : 0) +
        (it.date === row.date ? 2 : 0) +
        (m1 && m2 && (m1.includes(m2) || m2.includes(m1)) ? 1 : 0) +
        (it.paymentMethod === "corporate_card" ? 1 : 0);
      if (score > bestScore) {
        best = it;
        bestScore = score;
      }
    }
    if (!best) {
      out.missing.push(row);
      continue;
    }
    used.add(best.id);
    (best.paymentMethod === "personal_card" ? out.personal : out.matched).push({ row, item: best });
  }
  // 카드 내역 기간 안의 법인카드 영수증인데 짝이 없는 것(내역에 카드번호가 있으면 그 카드들만)
  if (live.length) {
    const from = live.reduce((m, r) => (r.date < m ? r.date : m), live[0].date);
    const to = live.reduce((m, r) => (r.date > m ? r.date : m), live[0].date);
    const cards = new Set(live.map((r) => r.last4).filter((x): x is string => !!x));
    out.extra = items.filter((it) => !used.has(it.id) && it.paymentMethod === "corporate_card" && it.date >= from && it.date <= to && (!cards.size || !it.last4 || cards.has(it.last4)));
  }
  return out;
}
