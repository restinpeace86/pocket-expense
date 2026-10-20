import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { ClaimEditor } from "@/components/employee/claim-editor";
import { requireWorkspace } from "@/lib/auth/guards";
import { getApprovalPreview } from "@/lib/admin/approval-lines";
import { getMyClaimForEdit } from "@/lib/employee/claim";

export const metadata = { title: "지출소명서 작성 · PocketExpense" };

// 화면 E-02 지출소명서 작성 (spec/screens/worker-tax-processing.md)
export default function ClaimEditPage({ params, searchParams }: PageProps<"/workspace/[id]/employee/claims/[claimId]/edit">) {
  return (
    <Suspense fallback={<div className="mx-auto my-4 h-96 w-[calc(100%-2rem)] max-w-md animate-pulse rounded-2xl bg-zinc-100" />}>
      <ClaimEdit params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function ClaimEdit({ params, searchParams }: Pick<PageProps<"/workspace/[id]/employee/claims/[claimId]/edit">, "params" | "searchParams">) {
  const { id, claimId } = await params;
  const sp = await searchParams;
  const membership = await requireWorkspace(id);
  const [data, approvalPreview] = await Promise.all([getMyClaimForEdit(membership, claimId), getApprovalPreview(membership.company_id, membership)]);
  if (!data) notFound();
  const base = `/workspace/${id}/employee`;
  // 상신 이후에는 편집하지 않고 읽기 전용 상세로
  if (data.claim.status !== "draft" && data.claim.status !== "rejected") redirect(`${base}/claims/${claimId}`);
  return <ClaimEditor key={data.claim.id} data={data} base={base} openAdd={sp.add === "1"} selfApprove={membership.role === "super_admin"} approvalPreview={approvalPreview} />;
}
