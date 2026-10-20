import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ClaimDetail } from "@/lib/claims/types";
import { formatDateTimeKst } from "@/lib/claims/format";
import { claimStatusBadge } from "@/lib/expense/status";
import { formatWon } from "@/lib/format";
import { ApprovalTimeline } from "./approval-timeline";
import { ClaimItems } from "./claim-items";

// 직원 소명서 상세 — 읽기 전용 (employee-mobile.md ④, T9-5)
function period(d: ClaimDetail) {
  const dates = d.items.map((i) => i.expense_date).filter((x): x is string => !!x).sort();
  if (!dates.length) return null;
  const a = dates[0].replaceAll("-", ".");
  const b = dates[dates.length - 1].replaceAll("-", ".");
  return a === b ? a : `${a} ~ ${b.slice(5)}`;
}

export function EmployeeClaimDetail({ detail, base }: { detail: ClaimDetail; base: string }) {
  const { claim } = detail;
  const badge = claimStatusBadge(claim.status, claim.settlement_required);
  const reviewing = detail.pendingStep?.step_kind === "review" ? `${detail.pendingStep.approver_name ?? "사전 검토자"} 검토 중` : null;
  const lastReject = [...detail.approvals].reverse().find((a) => a.status === "rejected");
  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-3 md:max-w-3xl">
      <div className="flex items-center justify-between gap-2">
        <Link href={base} className="-ml-2 inline-flex min-h-11 items-center gap-1 rounded-xl px-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100">
          <ArrowLeft className="size-4" />내 소명서
        </Link>
        <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}>{badge.label}</span>
      </div>

      <section className="rounded-2xl border border-zinc-200 bg-white p-4">
        <h1 className="break-keep text-lg font-bold [overflow-wrap:anywhere]">{claim.title || "제목 없는 소명서"}</h1>
        <p className="mt-1 text-sm text-zinc-500">{[period(detail), `영수증 ${claim.item_count}건`, reviewing].filter(Boolean).join(" · ")}</p>
        <p className="mt-2 text-2xl font-bold tabular-nums">{formatWon(claim.total_amount)}</p>
        {claim.description && <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-700">{claim.description}</p>}
        {claim.is_business_trip && (
          <p className="mt-2 text-sm text-zinc-600">
            🧳 {claim.trip_destination} · {claim.trip_start_date?.replaceAll("-", ".")} ~ {claim.trip_end_date?.slice(5).replace("-", ".")} · {claim.trip_purpose}
          </p>
        )}
      </section>

      {claim.status === "rejected" && (
        <section className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-semibold">
            반려됨{lastReject?.acted_by_name ? ` · ${lastReject.acted_by_name}` : ""}
            {lastReject?.acted_at ? ` · ${formatDateTimeKst(lastReject.acted_at)}` : ""}
          </p>
          <p className="mt-1 whitespace-pre-wrap">{claim.rejection_reason}</p>
          {detail.flaggedItemIds.length > 0 && <p className="mt-1">지목된 영수증 {detail.flaggedItemIds.length}건 — 아래 목록에 빨갛게 표시돼요.</p>}
        </section>
      )}

      {(detail.payout > 0 || detail.payback > 0 || claim.status === "paid") && (
        <section className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm">
          <p className="font-semibold">정산</p>
          <p className="mt-1 text-zinc-700">
            {[detail.payout > 0 && `회사가 ${formatWon(detail.payout)} 지급${claim.status === "paid" ? "" : " 예정"}`, detail.payback > 0 && `법인카드 한도 초과 ${formatWon(detail.payback)} 납부${claim.status === "paid" ? "" : " 필요"}`]
              .filter(Boolean)
              .join(" / ") || "정산할 금액이 없어요 (법인카드)"}
          </p>
          {claim.status === "paid" && claim.settlement_required && <p className="mt-1 text-purple-700">💰 지급 완료 · {formatDateTimeKst(claim.paid_at)}</p>}
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">영수증 {detail.items.length}건</h2>
        <ClaimItems items={detail.items} cards={detail.cards} flaggedIds={detail.flaggedItemIds} />
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-4">
        <h2 className="mb-3 font-semibold">결재 진행</h2>
        <ApprovalTimeline detail={detail} />
      </section>

      {(claim.status === "draft" || claim.status === "rejected") && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200 bg-white/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur">
          <div className="mx-auto max-w-md md:max-w-3xl">
            <Link href={`${base}/claims/${claim.id}/edit`} className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-brand-600 font-semibold text-white hover:bg-brand-700">
              {claim.status === "rejected" ? "수정 후 재상신하기" : "편집"}
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}
