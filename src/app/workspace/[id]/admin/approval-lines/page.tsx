import { Suspense } from "react";
import { ApprovalLinesHeading, ApprovalLinesView } from "@/components/admin/approval-lines-view";
import { getApprovalLines } from "@/lib/admin/approval-lines";
import { requireWorkspace } from "@/lib/auth/guards";

export const metadata = { title: "사전 검토 결재라인 · PocketExpense" };

// 화면 ⑥ 사전 검토 결재라인 (admin-dashboard.md ⑥)
export default function ApprovalLinesPage({ params }: PageProps<"/workspace/[id]/admin/approval-lines">) {
  return (
    <>
      <ApprovalLinesHeading />
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-zinc-100" />}>
        <Lines params={params} />
      </Suspense>
    </>
  );
}

async function Lines({ params }: { params: PageProps<"/workspace/[id]/admin/approval-lines">["params"] }) {
  const { id } = await params;
  const membership = await requireWorkspace(id, { admin: true });
  const data = await getApprovalLines(membership.company_id);
  return <ApprovalLinesView {...data} />;
}
