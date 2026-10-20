import Link from "next/link";
import { APPROVAL_TABS, type AdminClaimRow, type ApprovalTab } from "@/lib/claims/admin-list";
import { formatDateTimeKst } from "@/lib/claims/format";
import { claimStatusBadge } from "@/lib/expense/status";
import { formatWon } from "@/lib/format";

// 지출 승인 관리 왼쪽 목록 + 상태 탭 (admin-expense-approvals.md §4.A·B)
export function ApprovalTabs({ tab, pendingCount, base }: { tab: ApprovalTab; pendingCount: number; base: string }) {
  return (
    <div className="flex gap-1 overflow-x-auto rounded-xl bg-zinc-100 p-1" aria-label="상태">
      {APPROVAL_TABS.map((t) => (
        <Link
          key={t.key}
          href={`${base}?tab=${t.key}`}
          aria-current={tab === t.key ? "page" : undefined}
          className={`inline-flex min-h-10 flex-1 items-center justify-center whitespace-nowrap rounded-lg px-2 text-[13px] ${tab === t.key ? "bg-white font-semibold shadow-sm" : "text-zinc-600 hover:text-zinc-900"}`}
        >
          {t.label}
          {t.key === "pending" && pendingCount > 0 && <span className="ml-1.5 rounded-full bg-brand-600 px-1.5 text-xs text-white">{pendingCount}</span>}
        </Link>
      ))}
    </div>
  );
}

export function AdminClaimList({ rows, tab, base, selectedId }: { rows: AdminClaimRow[]; tab: ApprovalTab; base: string; selectedId?: string }) {
  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-zinc-300 bg-white px-4 py-10 text-center text-sm text-zinc-500">
        {tab === "pending" ? "승인할 지출소명서가 없어요." : tab === "done" ? "승인한 지출소명서가 없어요." : "반려한 지출소명서가 없어요."}
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((c) => {
        const badge = claimStatusBadge(c.status, c.settlement_required);
        const active = c.id === selectedId;
        return (
          <li key={c.id}>
            <Link
              href={`${base}/${c.id}?tab=${tab}`}
              aria-current={active ? "true" : undefined}
              className={`block rounded-xl border p-3 hover:border-brand-300 ${active ? "border-brand-500 bg-brand-50" : "border-zinc-200 bg-white"}`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 break-keep font-medium [overflow-wrap:anywhere]">
                  {c.is_business_trip && <span className="mr-1 rounded bg-sky-100 px-1.5 py-0.5 text-[11px] text-sky-800">출장</span>}
                  {c.title || "제목 없는 소명서"}
                </p>
                <span className="shrink-0 font-semibold tabular-nums">{formatWon(c.total_amount)}</span>
              </div>
              <p className="mt-1 text-xs text-zinc-500">
                {c.member_name} · {c.item_count}건 · {formatDateTimeKst(c.submitted_at).slice(0, 10)}
              </p>
              <p className="mt-1 flex flex-wrap gap-1">
                {tab !== "pending" && <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${badge.className}`}>{c.self_approved ? "결재 생략" : badge.label}</span>}
                {c.reviewing && <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-600">{c.reviewing} 검토 중</span>}
              </p>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
