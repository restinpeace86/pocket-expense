// 법인카드 사용 내역 ↔ 올라온 영수증 짝 맞추기 (D-111)
// 같은 금액 + 날짜 ±1일(승인일·매입일 차이) + 카드 끝 4자리(둘 다 있으면 같아야 함). 한 영수증은 한 결제에만.
// 같은 날 같은 금액이 여러 건이면 가맹점 사업자번호로 구분한다(둘 다 있으면 같아야 함 — 세무사무소 답변, D-136).
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
  bizNo?: string | null; // 영수증에서 읽은 가맹점 사업자번호(숫자 10자리)
  noEvidence?: boolean; // "자료가 정말 없어요"로 올린 영수증(카드 내역으로 증빙 대체 가능, D-170)
};

export type ReconcileResult = {
  matched: { row: StatementRow; item: LedgerItem }[];
  personal: { row: StatementRow; item: LedgerItem }[]; // 카드 내역에 있는데 개인(사비)으로 올림 → 이중 지급 위험
  missing: StatementRow[]; // 카드는 썼는데 결의서가 없음
  extra: LedgerItem[]; // 법인카드로 올렸는데 카드 내역에 없음
  cancelled: number;
  // 정기 결제(D-171): 결의서 없는 카드 결제 중 등록된 정기 결제와 맞는 것 / 결제일이 내역 기간 안인데 카드 내역에서 못 찾은 정기 결제
  recurring?: {
    matches: { line: number; recurringId: string; serviceName: string; assignee: string; claimed: boolean }[];
    notFound: { recurringId: string; serviceName: string; amount: number; due: string }[];
  };
};

export type RecurringRef = { id: string; serviceName: string; keyword: string | null; amount: number; cycle: "monthly" | "yearly"; billingDay: number; billingMonth: number | null; assignee: string; claimedPeriods: string[] };

// 정기 결제 찾기: 가맹점에 키워드(없으면 서비스명)가 들어 있고 금액이 ±10% 안
export function matchRecurring(row: StatementRow, list: RecurringRef[]): RecurringRef | null {
  const m = plain(row.merchant);
  if (!m) return null;
  return (
    list.find((r) => {
      const k = plain(r.keyword || r.serviceName);
      return k.length >= 2 && (m.includes(k) || k.includes(m)) && Math.abs(row.amount - r.amount) <= Math.max(1000, r.amount * 0.1);
    }) ?? null
  );
}

// 기간(YYYY-MM 또는 YYYY) — 이미 결의서가 있는지 볼 때
export const recurringPeriodKey = (cycle: "monthly" | "yearly", date: string) => (cycle === "monthly" ? date.slice(0, 7) : date.slice(0, 4));

export function recurringReport(rows: StatementRow[], missing: StatementRow[], list: RecurringRef[]): NonNullable<ReconcileResult["recurring"]> {
  const matches: NonNullable<ReconcileResult["recurring"]>["matches"] = [];
  const hit = new Set<string>();
  for (const row of missing) {
    const r = matchRecurring(row, list);
    if (!r) continue;
    hit.add(`${r.id}:${recurringPeriodKey(r.cycle, row.date)}`);
    matches.push({ line: row.line, recurringId: r.id, serviceName: r.serviceName, assignee: r.assignee, claimed: r.claimedPeriods.includes(recurringPeriodKey(r.cycle, row.date)) });
  }
  // 이미 결의서와 짝이 맞은 결제도 "찾음"으로 본다
  for (const row of rows) {
    const r = matchRecurring(row, list);
    if (r) hit.add(`${r.id}:${recurringPeriodKey(r.cycle, row.date)}`);
  }
  const live = rows.filter((r) => !r.cancelled);
  const notFound: NonNullable<ReconcileResult["recurring"]>["notFound"] = [];
  if (live.length) {
    const from = live.reduce((m, r) => (r.date < m ? r.date : m), live[0].date);
    const to = live.reduce((m, r) => (r.date > m ? r.date : m), live[0].date);
    for (const r of list) {
      for (let d = new Date(`${from.slice(0, 7)}-01T00:00:00Z`); d.toISOString().slice(0, 10) <= to; d.setUTCMonth(d.getUTCMonth() + 1)) {
        const y = d.getUTCFullYear();
        const mo = d.getUTCMonth() + 1;
        if (r.cycle === "yearly" && r.billingMonth !== mo) continue;
        const last = new Date(Date.UTC(y, mo, 0)).getUTCDate();
        const due = `${y}-${String(mo).padStart(2, "0")}-${String(Math.min(r.billingDay, last)).padStart(2, "0")}`;
        if (due < from || due > to) continue;
        const key = recurringPeriodKey(r.cycle, due);
        if (!hit.has(`${r.id}:${key}`) && !r.claimedPeriods.includes(key)) notFound.push({ recurringId: r.id, serviceName: r.serviceName, amount: r.amount, due });
      }
    }
  }
  return { matches, notFound };
}

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
      if (row.bizNo && it.bizNo && row.bizNo !== it.bizNo) continue;
      const m1 = plain(row.merchant);
      const m2 = plain(it.merchant);
      const score =
        (row.last4 && it.last4 === row.last4 ? 4 : 0) +
        (row.bizNo && it.bizNo === row.bizNo ? 3 : 0) +
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
