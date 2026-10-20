import { Suspense } from "react";
import { AdminClaimList, ApprovalTabs } from "@/components/claims/admin-claim-list";
import { requireWorkspace } from "@/lib/auth/guards";
import { getAdminClaimList, parseApprovalTab } from "@/lib/claims/admin-list";

export const metadata = { title: "지출 승인 관리 · PocketExpense" };

// 지출 승인 관리 목록 (admin-expense-approvals.md). 넓은 화면에서는 소명서를 고르면 오른쪽에 상세가 열린다
export default function ClaimsPage({ params, searchParams }: PageProps<"/workspace/[id]/admin/claims">) {
  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">지출 승인 관리</h1>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-zinc-100" />}>
        <Claims params={params} searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Claims({ params, searchParams }: Pick<PageProps<"/workspace/[id]/admin/claims">, "params" | "searchParams">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const membership = await requireWorkspace(id, { admin: true });
  const tab = parseApprovalTab(sp.tab);
  const base = `/workspace/${id}/admin/claims`;
  const { list, pendingCount } = await getAdminClaimList(membership.company_id, tab);
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,3fr)]">
      <div className="flex min-w-0 flex-col gap-3">
        <ApprovalTabs tab={tab} pendingCount={pendingCount} base={base} />
        <AdminClaimList rows={list} tab={tab} base={base} />
      </div>
      <p className="hidden rounded-xl border border-dashed border-zinc-300 bg-white px-4 py-16 text-center text-sm text-zinc-500 lg:block">왼쪽에서 지출소명서를 고르면 여기에 내용이 보여요.</p>
    </div>
  );
}
