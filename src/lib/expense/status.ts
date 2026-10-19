// 지출소명서 상태 배지 표준 (spec/common/ui-rules.md §4, D-022)
import { currentMonthKst } from "@/lib/dates";
export type ClaimStatus = "draft" | "submitted" | "approved" | "rejected" | "paid";

export function claimStatusBadge(status: ClaimStatus, settlementRequired: boolean | null = null): { label: string; className: string } {
  switch (status) {
    case "draft":
      return { label: "📝 임시저장", className: "bg-zinc-100 text-zinc-700" };
    case "submitted":
      return { label: "🟡 검토 대기", className: "bg-yellow-100 text-yellow-800" };
    case "approved":
      return { label: "✅ 승인 완료 (정산 대기)", className: "bg-green-100 text-green-700" };
    case "rejected":
      return { label: "🔴 반려됨", className: "bg-red-100 text-red-700" };
    case "paid":
      return settlementRequired === false
        ? { label: "✅ 승인 완료 (정산 없음)", className: "bg-purple-100 text-purple-700" }
        : { label: "💰 정산 지급 완료", className: "bg-purple-100 text-purple-700" };
  }
}

export const CLAIM_FILTERS = [
  { key: "all", label: "전체", statuses: null },
  { key: "draft", label: "임시저장", statuses: ["draft"] },
  { key: "submitted", label: "검토 대기", statuses: ["submitted"] },
  { key: "rejected", label: "반려됨", statuses: ["rejected"] },
  { key: "done", label: "완료", statuses: ["approved", "paid"] },
] as const satisfies readonly { key: string; label: string; statuses: readonly ClaimStatus[] | null }[];
export type ClaimFilterKey = (typeof CLAIM_FILTERS)[number]["key"];

export function filterStatuses(key: string | null | undefined): readonly ClaimStatus[] | null {
  return CLAIM_FILTERS.find((f) => f.key === key)?.statuses ?? null;
}

export function parseFilter(key: string | null | undefined): ClaimFilterKey {
  return CLAIM_FILTERS.find((f) => f.key === key)?.key ?? "all";
}

// "YYYY-MM"만 받고 나머지는 이번 달(KST)로
export function parseMonth(raw: string | null | undefined, fallback?: string): string {
  if (raw && /^\d{4}-(0[1-9]|1[0-2])$/.test(raw)) return raw;
  return fallback ?? currentMonthKst();
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
