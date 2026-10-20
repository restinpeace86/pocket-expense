import type { ClaimDetail } from "@/lib/claims/types";
import { formatDateTimeKst } from "@/lib/claims/format";

// 결재 타임라인 (employee-mobile.md ④, expense-lifecycle.md §4): 회차별 상신 → 단계별 처리 → 지급 완료
const STEP_LABEL: Record<string, string> = { review: "사전 검토", final: "관리자 승인" };
const STATUS_LABEL: Record<string, [string, string]> = {
  waiting: ["대기", "text-zinc-400"],
  pending: ["처리 차례", "text-amber-700"],
  approved: ["승인", "text-green-700"],
  rejected: ["반려", "text-red-700"],
  skipped: ["생략", "text-zinc-500"],
  canceled: ["취소", "text-zinc-400"],
};

export function ApprovalTimeline({ detail }: { detail: ClaimDetail }) {
  const { claim, approvals } = detail;
  if (claim.self_approved && claim.current_round > 0 && approvals.filter((a) => a.round === claim.current_round).every((a) => a.status === "skipped")) {
    return <p className="text-sm text-zinc-600">본인 결재로 승인(결재 생략) · {formatDateTimeKst(claim.approved_at)}</p>;
  }
  const rounds = [...new Set(approvals.map((a) => a.round))].sort((a, b) => b - a);
  if (rounds.length === 0) return <p className="text-sm text-zinc-500">아직 상신하지 않았어요.</p>;
  return (
    <ol className="flex flex-col gap-4">
      {rounds.map((round) => (
        <li key={round}>
          <p className="text-xs font-semibold text-zinc-500">{round}회차 상신{round === claim.current_round && claim.submitted_at ? ` · ${formatDateTimeKst(claim.submitted_at)}` : ""}</p>
          <ul className="mt-1 flex flex-col gap-1.5 border-l-2 border-zinc-200 pl-3">
            {approvals
              .filter((a) => a.round === round)
              .map((a) => {
                const [label, cls] = STATUS_LABEL[a.status];
                return (
                  <li key={a.id} className="text-sm">
                    <span className="font-medium">{STEP_LABEL[a.step_kind]}</span>
                    {a.step_kind === "review" && a.approver_name && <span className="text-zinc-500"> ({a.approver_name})</span>}
                    <span className={`ml-1.5 ${cls}`}>{label}</span>
                    {a.acted_by_name && <span className="text-zinc-500"> · {a.acted_by_name}</span>}
                    {a.acted_at && <span className="text-zinc-400"> · {formatDateTimeKst(a.acted_at)}</span>}
                    {a.comment && <span className={`mt-0.5 block whitespace-pre-wrap text-xs ${a.status === "rejected" ? "text-red-700" : "text-zinc-600"}`}>{a.comment}</span>}
                  </li>
                );
              })}
          </ul>
        </li>
      ))}
      {claim.paid_at && claim.settlement_required && <li className="text-sm text-purple-700">💰 정산 지급 완료 · {formatDateTimeKst(claim.paid_at)}</li>}
    </ol>
  );
}
