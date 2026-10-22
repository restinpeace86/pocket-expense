import { Suspense } from "react";
import { ReconcileHeading, ReconcileView } from "@/components/admin/reconcile-view";
import { requireWorkspace } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "법인카드 내역 대조 · PocketExpense" };

// 법인카드 사용 내역 대조 (D-111)
export default function ReconcilePage({ params }: PageProps<"/workspace/[id]/admin/corporate-cards/reconcile">) {
  return (
    <>
      <ReconcileHeading />
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-zinc-100" />}>
        <Content params={params} />
      </Suspense>
    </>
  );
}

async function Content({ params }: { params: PageProps<"/workspace/[id]/admin/corporate-cards/reconcile">["params"] }) {
  const { id } = await params;
  const membership = await requireWorkspace(id, { admin: true });
  const supabase = await createClient();
  const { data: cards } = await supabase.from("corporate_cards").select("last4, nickname, holder:members(name)").eq("company_id", membership.company_id);
  const holders = Object.fromEntries((cards ?? []).map((c) => [c.last4, `${c.nickname}${(c.holder as { name: string } | null)?.name ? ` · ${(c.holder as { name: string }).name}` : ""}`]));
  return <ReconcileView base={`/workspace/${id}`} holders={holders} />;
}
