import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AdminClaimDetail } from "@/components/claims/admin-claim-detail";
import { AdminClaimList, ApprovalTabs } from "@/components/claims/admin-claim-list";
import { ClaimFiltersBar } from "@/components/claims/claim-filters";
import { ClaimListPane } from "@/components/claims/claim-list-pane";
import { getFilterOptions } from "@/lib/claims/filter-options";
import { filterQuery, parseClaimFilters } from "@/lib/claims/filters";
import { ApprovalTimeline } from "@/components/claims/approval-timeline";
import { requireWorkspace } from "@/lib/auth/guards";
import { getAdminClaimList, parseApprovalTab } from "@/lib/claims/admin-list";
import { getClaimDetail } from "@/lib/claims/detail";
import { canActOnClaim } from "@/lib/claims/types";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "지출결의서 검토 · PocketExpense" };

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
  const [detail, { list, pendingCount }, { data: titles }, options, { data: office }] = await Promise.all([
    getClaimDetail(membership.company_id, claimId),
    getAdminClaimList(membership.company_id, tab, filters),
    supabase.from("account_titles").select("id, name, code").eq("company_id", membership.company_id).order("sort_order"),
    getFilterOptions(membership.company_id),
    supabase.rpc("my_company_tax_office"),
  ]);
  // 등록된 세무사무소와 연결돼 있으면 영수증별 계정과목은 사무소가 정한다(D-156)
  const o = office as { registered?: boolean; registered_name?: string | null } | null;
  const taxOffice = o?.registered ? (o.registered_name ?? "세무사무소") : null;
  // 작성 중인 결의서는 관리자 화면에서 열지 않는다
  if (!detail || detail.claim.status === "draft") notFound();
  const { can, reason } = canActOnClaim(detail, membership);
  // 처리 뒤 [다음 결재]: 내가 지금 승인할 수 있는 결의서(관리자 승인 차례, 사전 검토 중·본인 것 제외), 오래된 상신 순
  const pendingRows = tab === "pending" ? list : (await getAdminClaimList(membership.company_id, "pending")).list;
  const nextList = pendingRows.filter((r) => r.id !== claimId && !r.reviewing && r.member_id !== membership.member_id);
  const nextFor = (rows: typeof nextList) => (rows.length ? { href: `${base}/${rows[0].id}?tab=pending${query ? `&${query}` : ""}`, count: rows.length } : { href: "", count: 0 });
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,3fr)]">
      <ClaimListPane className="hidden lg:flex">
        <ApprovalTabs tab={tab} pendingCount={pendingCount} base={base} query={query} />
        <ClaimFiltersBar key={query} filters={filters} tab={tab} base={base} {...options} />
        <AdminClaimList rows={list} tab={tab} base={base} selectedId={claimId} query={query} />
      </ClaimListPane>
      <AdminClaimDetail
        key={`${detail.claim.id}:${detail.claim.current_round}`}
        detail={detail}
        canAct={can}
        blockedReason={reason}
        backHref={`${base}?tab=${tab}${query ? `&${query}` : ""}#c-${claimId}`}
        payoutsHref={`/workspace/${id}/admin/payouts`}
        timeline={<ApprovalTimeline detail={detail} />}
        accountTitles={titles ?? []}
        next={nextFor(nextList)}
        taxOffice={taxOffice}
      />
    </div>
  );
}
