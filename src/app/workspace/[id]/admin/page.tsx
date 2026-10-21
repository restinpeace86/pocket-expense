import { Suspense } from "react";
import { AdminHomeView } from "@/components/admin/admin-home-view";
import { EventBonusBanner } from "@/components/admin/event-bonus-banner";
import { getCreditStatus } from "@/lib/admin/billing";
import { describePolicy } from "@/lib/admin/policy";
import { getDashboard } from "@/lib/admin/dashboard-query";
import { getCompanySummary } from "@/lib/admin/queries";
import { currentMonthKst } from "@/lib/dates";
import { requireWorkspace } from "@/lib/auth/guards";

export const metadata = { title: "관리자 · PocketExpense" };

export default function AdminHomePage({ params }: PageProps<"/workspace/[id]/admin">) {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-zinc-100" />}>
      <AdminHome params={params} />
    </Suspense>
  );
}

async function AdminHome({ params }: { params: PageProps<"/workspace/[id]/admin">["params"] }) {
  const { id } = await params;
  const membership = await requireWorkspace(id, { admin: true });
  const [{ company }, credit, dashboard] = await Promise.all([getCompanySummary(membership.company_id), getCreditStatus(membership.company_id), getDashboard(currentMonthKst())]);
  if (!company || !dashboard) return null;
  return (
    <>
      {/* 이벤트 추가 지급 뒤 처음 접속하면 상단 배너 (pricing-policy.md §5) */}
      {credit?.showEventBanner && <EventBonusBanner amount={credit.eventAmount} count={credit.eventCount} total={credit.eventTotal} />}
      <AdminHomeView
      adminName={membership.name}
      companyName={company.name}
      inviteCode={company.invite_code}
      dashboard={dashboard}
      creditsLeft={company.receipt_credits_granted - company.receipt_credits_used}
      creditsGranted={company.receipt_credits_granted}
      policyToConfirm={company.policy_confirmed_at ? null : describePolicy(company)}
      basePath={`/workspace/${membership.company_id}/admin`}
      />
    </>
  );
}
