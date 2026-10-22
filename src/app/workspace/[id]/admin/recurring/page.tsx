import { Suspense } from "react";
import { RecurringHeading, RecurringView } from "@/components/admin/recurring-view";
import { getRecurringPayments } from "@/lib/admin/queries";
import { requireWorkspace } from "@/lib/auth/guards";
import { todayKst } from "@/lib/dates";

export const metadata = { title: "정기 결제 · PocketExpense" };

// 정기 결제 (D-110, spec/features/recurring-subscriptions.md)
export default function RecurringPage({ params }: PageProps<"/workspace/[id]/admin/recurring">) {
  return (
    <>
      <RecurringHeading />
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-zinc-100" />}>
        <Content params={params} />
      </Suspense>
    </>
  );
}

async function Content({ params }: { params: PageProps<"/workspace/[id]/admin/recurring">["params"] }) {
  const { id } = await params;
  const membership = await requireWorkspace(id, { admin: true });
  const data = await getRecurringPayments(membership.company_id);
  return <RecurringView {...data} today={todayKst()} />;
}
