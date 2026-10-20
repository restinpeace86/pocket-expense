import { notFound } from "next/navigation";
import { Suspense } from "react";
import { EmployeeClaimDetail } from "@/components/claims/employee-claim-detail";
import { requireWorkspace } from "@/lib/auth/guards";
import { getClaimDetail } from "@/lib/claims/detail";

export const metadata = { title: "지출소명서 · PocketExpense" };

// 직원 소명서 상세 (employee-mobile.md ④): 본인 소명서만
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
  const detail = await getClaimDetail(membership.company_id, claimId, { ownerMemberId: membership.member_id });
  if (!detail) notFound();
  return <EmployeeClaimDetail detail={detail} base={`/workspace/${id}/employee`} />;
}
