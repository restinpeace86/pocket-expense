import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { AdminClaimDetail } from "@/components/claims/admin-claim-detail";
import { ApprovalTimeline } from "@/components/claims/approval-timeline";
import { requireWorkspace } from "@/lib/auth/guards";
import { isAdminRole } from "@/lib/auth/paths";
import { getClaimDetail } from "@/lib/claims/detail";
import { canActOnClaim } from "@/lib/claims/types";

export const metadata = { title: "결재 · PocketExpense" };

// 결재 화면 (approver.md ①) — 알림톡 [결재하러 가기] 도착지.
// 링크에 토큰이 없으므로 로그인은 proxy가 확인하고(로그인 뒤 이 주소로 돌아옴), 여기서는 권한에 맞는 화면을 보여 준다.
// 관리자 → 지출 승인 관리 상세 / 청구자 본인 → 내 결의서 / 사전 검토자 → 이 화면 / 그 밖 → 권한 없음
export default function ApprovalPage({ params }: PageProps<"/workspace/[id]/approvals/[claimId]">) {
  return (
    <Suspense fallback={<div className="m-4 h-64 animate-pulse rounded-xl bg-zinc-100" />}>
      <Approval params={params} />
    </Suspense>
  );
}

async function Approval({ params }: Pick<PageProps<"/workspace/[id]/approvals/[claimId]">, "params">) {
  const { id, claimId } = await params;
  const membership = await requireWorkspace(id);
  if (isAdminRole(membership.role)) redirect(`/workspace/${id}/admin/claims/${claimId}`);
  const detail = await getClaimDetail(membership.company_id, claimId);
  if (detail && detail.claim.member_id === membership.member_id) redirect(`/workspace/${id}/employee/claims/${claimId}`);
  if (!detail || detail.claim.status === "draft") notFound();
  const { can } = canActOnClaim(detail, membership);
  const myStep = [...detail.approvals].reverse().find((a) => a.approver_member_id === membership.member_id && a.round === detail.claim.current_round);
  // 처리 권한이 없을 때 이유 (approver.md ① 상태별 표시)
  const reason = can
    ? null
    : myStep && (myStep.status === "approved" || myStep.status === "rejected")
      ? `이미 처리된 결재입니다 (${myStep.status === "approved" ? "승인" : "반려"})`
      : detail.pendingStep?.step_kind === "review"
        ? `앞 단계 검토 대기 중입니다 (${detail.pendingStep.approver_name ?? "사전 검토자"})`
        : detail.claim.status === "submitted"
          ? "관리자 승인 차례예요."
          : null;
  return (
    <main className="mx-auto flex w-full max-w-md flex-col px-4 pt-3 md:max-w-3xl">
        <AdminClaimDetail
          key={`${detail.claim.id}:${detail.claim.status}:${detail.pendingStep?.id ?? ""}`}
          detail={detail}
          canAct={can}
          blockedReason={reason}
          backHref={`/workspace/${id}/approvals`}
          payoutsHref="#"
          timeline={<ApprovalTimeline detail={detail} />}
          reviewer
        />
    </main>
  );
}
