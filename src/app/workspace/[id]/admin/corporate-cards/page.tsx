import { Suspense } from "react";
import { CorporateCardsHeading, CorporateCardsView } from "@/components/admin/corporate-cards-view";
import { ReconcileLink } from "@/components/admin/reconcile-link";
import { getCorporateCards } from "@/lib/admin/queries";
import { requireWorkspace } from "@/lib/auth/guards";
import { currentMonthKst, monthRange } from "@/lib/dates";

export const metadata = { title: "법인카드 · PocketExpense" };

// 법인카드 (선택 기능, spec/screens/admin-dashboard.md ⑫, spec/features/corporate-cards.md)
export default function CorporateCardsPage({ params }: PageProps<"/workspace/[id]/admin/corporate-cards">) {
  return (
    <>
      <CorporateCardsHeading />
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-zinc-100" />}>
        <Content params={params} />
      </Suspense>
    </>
  );
}

async function Content({ params }: { params: PageProps<"/workspace/[id]/admin/corporate-cards">["params"] }) {
  const { id } = await params;
  const membership = await requireWorkspace(id, { admin: true });
  const { start, end } = monthRange(currentMonthKst());
  const { cards, members } = await getCorporateCards(membership.company_id, start, end);
  return (
    <div className="flex flex-col gap-4">
      <ReconcileLink href={`/workspace/${id}/admin/corporate-cards/reconcile`} />
      <CorporateCardsView cards={cards} members={members} />
    </div>
  );
}
