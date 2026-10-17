import { Suspense } from "react";
import { AdminHomeView } from "@/components/admin/admin-home-view";
import { getCompanySummary } from "@/lib/admin/queries";
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
  const { company, pendingCount, approvedCount } = await getCompanySummary(membership.company_id);
  if (!company) return null;
  return (
    <AdminHomeView
      adminName={membership.name}
      companyName={company.name}
      inviteCode={company.invite_code}
      pendingCount={pendingCount}
      approvedCount={approvedCount}
      creditsLeft={company.receipt_credits_granted - company.receipt_credits_used}
      creditsGranted={company.receipt_credits_granted}
      basePath={`/workspace/${membership.company_id}/admin`}
    />
  );
}
