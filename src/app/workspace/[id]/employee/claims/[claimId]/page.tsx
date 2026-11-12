import { notFound } from "next/navigation";
import { Suspense } from "react";
import { EmployeeClaimDetail } from "@/components/claims/employee-claim-detail";
import { ClaimChatButton } from "@/components/chat/claim-chat-button";
import { requireWorkspace } from "@/lib/auth/guards";
import { chatEnabled } from "@/lib/chat/server";
import { ClaimEventLink } from "@/components/calendar/claim-event-link";
import { getClaimDetail } from "@/lib/claims/detail";
import { BRAND } from "@/lib/brand";

export const metadata = { title: `지출결의서 · ${BRAND.name}` };

// 직원 결의서 상세 (employee-mobile.md ④): 본인 결의서만
export default function EmployeeClaimPage({ params }: PageProps<"/workspace/[id]/employee/claims/[claimId]">) {
  return (
    <Suspense fallback={<div className="mx-auto my-4 h-96 w-[calc(100%-2rem)] max-w-md animate-pulse rounded-2xl bg-zinc-100" />}>
      <EmployeeClaim params={params} />
    </Suspense>
  );
}

async function EmployeeClaim({ params }: Pick<PageProps<"/workspace/[id]/employee/claims/[claimId]">, "params">) {
  const { id, claimId } = await params;
  const membership = await requireWorkspace(id);
  const [detail, chat] = await Promise.all([getClaimDetail(membership.company_id, claimId, { ownerMemberId: membership.member_id }), chatEnabled()]);
  if (!detail) notFound();
  return <EmployeeClaimDetail detail={detail} base={`/workspace/${id}/employee`} chat={chat && detail.claim.status !== "draft" ? <ClaimChatButton companyId={id} claimId={claimId} /> : null} eventLink={<ClaimEventLink companyId={id} claimId={claimId} />} />;
}
