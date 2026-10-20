import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BillingView } from "@/components/admin/billing-view";
import { getBillingPlans, getCreditStatus } from "@/lib/admin/billing";
import { requireWorkspace } from "@/lib/auth/guards";

export const metadata = { title: "요금제 · PocketExpense" };

// 화면 A-05 요금제 (spec/screens/admin-billing.md)
export default function BillingPage({ params }: PageProps<"/workspace/[id]/admin/billing">) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-zinc-100" />}>
      <Billing params={params} />
    </Suspense>
  );
}

async function Billing({ params }: { params: PageProps<"/workspace/[id]/admin/billing">["params"] }) {
  const { id } = await params;
  const membership = await requireWorkspace(id, { admin: true });
  const [status, plans] = await Promise.all([getCreditStatus(membership.company_id), getBillingPlans()]);
  if (!status) notFound();
  return <BillingView status={status} plans={plans} />;
}
