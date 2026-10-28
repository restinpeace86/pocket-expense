// 저장된 법인카드 대조 결과 (D-154) — 순수 함수(서버·브라우저 공용)
import type { ReconcileResult } from "./reconcile";

export type IssueKind = "missing" | "personal" | "extra";
export type IssueStatus = "open" | "claim_requested" | "personal_use" | "fixed" | "refunded" | "tax_review";

export type IssueInput = {
  kind: IssueKind;
  fingerprint: string;
  date: string;
  merchant: string;
  amount: number;
  last4: string | null;
  item_id: string | null;
  claim_title: string | null;
  member_name: string | null;
};

export type SavedIssue = {
  id: string;
  kind: IssueKind;
  expense_date: string | null;
  merchant: string | null;
  amount: number | null;
  last4: string | null;
  item_id: string | null;
  claim_title: string | null;
  member_name: string | null;
  status: IssueStatus;
  memo: string | null;
  resolved_by_name: string | null;
  resolved_at: string | null;
};

export type SavedReconcile = {
  id: string;
  month: string;
  file_name: string | null;
  period_from: string | null;
  period_to: string | null;
  matched: number;
  personal: number;
  missing: number;
  extra: number;
  cancelled: number;
  created_by_name: string | null;
  updated_at: string;
  issues: SavedIssue[];
};

export const KIND_LABEL: Record<IssueKind, string> = {
  missing: "카드는 썼는데 결의서가 없음",
  personal: "법인카드 결제인데 개인(사비)으로 올림",
  extra: "법인카드로 올렸는데 카드 내역에 없음",
};

export const STATUS_LABEL: Record<IssueStatus, string> = {
  open: "처리 전",
  claim_requested: "결의서 작성 요청",
  personal_use: "개인 사용 · 회사에 돌려받을 금액",
  fixed: "결의서 고침(결제수단)",
  refunded: "취소·환불됨",
  tax_review: "세무사 확인 필요",
};

// 구분별로 고를 수 있는 처리(DB 제약과 같음)
export const STATUS_OPTIONS: Record<IssueKind, IssueStatus[]> = {
  missing: ["open", "claim_requested", "personal_use", "tax_review"],
  personal: ["open", "fixed", "tax_review"],
  extra: ["open", "refunded", "fixed", "tax_review"],
};

const norm = (s: string) => s.replace(/\s+/g, "").toLowerCase().slice(0, 40);

// 대조 결과 → 저장할 '맞지 않는 건'. 같은 건을 다시 대조해도 같은 지문이 나와 처리가 이어진다(같은 날·금액·가맹점이 여러 번이면 #순번)
export function issuesFromResult(r: ReconcileResult): IssueInput[] {
  const seen = new Map<string, number>();
  const fp = (base: string) => {
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return n === 1 ? base : `${base}#${n}`;
  };
  const out: IssueInput[] = [];
  for (const m of r.missing) {
    out.push({ kind: "missing", fingerprint: fp(`m|${m.date}|${m.amount}|${m.last4 ?? ""}|${norm(m.merchant)}`), date: m.date, merchant: m.merchant, amount: m.amount, last4: m.last4, item_id: null, claim_title: null, member_name: null });
  }
  for (const { row, item } of r.personal) {
    out.push({ kind: "personal", fingerprint: fp(`p|${item.id}`), date: row.date, merchant: row.merchant || item.merchant, amount: row.amount, last4: row.last4, item_id: item.id, claim_title: item.claimTitle, member_name: item.memberName || null });
  }
  for (const it of r.extra) {
    out.push({ kind: "extra", fingerprint: fp(`e|${it.id}`), date: it.date, merchant: it.merchant, amount: it.amount, last4: it.last4, item_id: it.id, claim_title: it.claimTitle, member_name: it.memberName || null });
  }
  return out;
}

// 카드 내역에서 가장 많은 달(저장 기본값)
export function majorityMonth(dates: string[]): string | null {
  const c = new Map<string, number>();
  for (const d of dates) if (/^\d{4}-\d{2}/.test(d)) c.set(d.slice(0, 7), (c.get(d.slice(0, 7)) ?? 0) + 1);
  let best: string | null = null;
  for (const [m, n] of c) if (!best || n > (c.get(best) ?? 0) || (n === c.get(best) && m > best)) best = m;
  return best;
}

export type ReconcileStatus = { kind: "none" } | { kind: "open"; open: number; total: number; updatedAt: string } | { kind: "done"; total: number; updatedAt: string };

export function reconcileStatus(saved: Pick<SavedReconcile, "issues" | "updated_at"> | null): ReconcileStatus {
  if (!saved) return { kind: "none" };
  const open = saved.issues.filter((i) => i.status === "open").length;
  return open ? { kind: "open", open, total: saved.issues.length, updatedAt: saved.updated_at } : { kind: "done", total: saved.issues.length, updatedAt: saved.updated_at };
}
