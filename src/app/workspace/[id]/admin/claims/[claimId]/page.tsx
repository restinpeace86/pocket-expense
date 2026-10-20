import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AdminClaimDetail } from "@/components/claims/admin-claim-detail";
import { AdminClaimList, ApprovalTabs } from "@/components/claims/admin-claim-list";
import { ClaimFiltersBar } from "@/components/claims/claim-filters";
import { getFilterOptions } from "@/lib/claims/filter-options";
import { filterQuery, parseClaimFilters } from "@/lib/claims/filters";
import { ApprovalTimeline } from "@/components/claims/approval-timeline";
import { requireWorkspace } from "@/lib/auth/guards";
import { getAdminClaimList, parseApprovalTab } from "@/lib/claims/admin-list";
import { getClaimDetail } from "@/lib/claims/detail";
import { canActOnClaim } from "@/lib/claims/types";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "지출소명서 검토 · PocketExpense" };

// 지출 승인 관리 상세 (admin-expense-approvals.md §2: 넓은 화면은 25/75 분할, 휴대폰은 상세만)
export default function ClaimDetailPage({ params, searchParams }: PageProps<"/workspace/[id]/admin/claims/[claimId]">) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-zinc-100" />}>
      <Detail params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Detail({ params, searchParams }: Pick<PageProps<"/workspace/[id]/admin/claims/[claimId]">, "params" | "searchParams">) {
  const [{ id, claimId }, sp] = await Promise.all([params, searchParams]);
  const membership = await requireWorkspace(id, { admin: true });
  const tab = parseApprovalTab(sp.tab);
  const base = `/workspace/${id}/admin/claims`;
  const supabase = await createClient();
  const filters = parseClaimFilters(sp);
  const query = filterQuery(filters);
  const [detail, { list, pendingCount }, { data: titles }, options] = await Promise.all([
    getClaimDetail(membership.company_id, claimId),
    getAdminClaimList(membership.company_id, tab, filters),
    supabase.from("account_titles").select("id, name, code").eq("company_id", membership.company_id).order("sort_order"),
    getFilterOptions(membership.company_id),
  ]);
  // 작성 중인 소명서는 관리자 화면에서 열지 않는다
  if (!detail || detail.claim.status === "draft") notFound();
  const { can, reason } = canActOnClaim(detail, membership);
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,3fr)]">
      <div className="hidden min-w-0 flex-col gap-3 lg:flex">
        <ApprovalTabs tab={tab} pendingCount={pendingCount} base={base} query={query} />
        <ClaimFiltersBar key={query} filters={filters} tab={tab} base={base} {...options} />
        <AdminClaimList rows={list} tab={tab} base={base} selectedId={claimId} query={query} />
      </div>
      <AdminClaimDetail
        key={`${detail.claim.id}:${detail.claim.status}:${detail.claim.current_round}`}
        detail={detail}
        canAct={can}
        blockedReason={reason}
        backHref={`${base}?tab=${tab}${query ? `&${query}` : ""}`}
        payoutsHref={`/workspace/${id}/admin/payouts`}
        timeline={<ApprovalTimeline detail={detail} />}
        accountTitles={titles ?? []}
      />
    </div>
  );
}
