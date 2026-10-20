import { Suspense } from "react";
import { PayoutsView } from "@/components/claims/payouts-view";
import { SectionHeading } from "@/components/ui/help";
import { requireWorkspace } from "@/lib/auth/guards";
import { getPayoutGroups } from "@/lib/claims/payouts";

export const metadata = { title: "정산 지급 관리 · PocketExpense" };

// 화면 A-02 정산 지급 관리 (admin-payouts.md)
export default function PayoutsPage({ params, searchParams }: PageProps<"/workspace/[id]/admin/payouts">) {
  return (
    <>
      <SectionHeading
        as="h1"
        title="정산 지급 관리"
        summary="승인된 소명서 중 직원에게 돌려줄 사비(또는 받을 법인카드 개인 부담금)가 남은 건이에요. 회사 은행에서 이체한 뒤 지급 완료로 처리해 주세요."
      />
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-zinc-100" />}>
        <Payouts params={params} searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Payouts({ params, searchParams }: Pick<PageProps<"/workspace/[id]/admin/payouts">, "params" | "searchParams">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const membership = await requireWorkspace(id, { admin: true });
  const tab = sp.tab === "paid" ? "paid" : "waiting";
  const groups = await getPayoutGroups(membership.company_id, tab);
  return <PayoutsView key={tab} groups={groups} tab={tab} base={`/workspace/${id}/admin/payouts`} claimsBase={`/workspace/${id}/admin/claims`} />;
}
