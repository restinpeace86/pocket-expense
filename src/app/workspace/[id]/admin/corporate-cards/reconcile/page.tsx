import { Suspense } from "react";
import { ReconcileHeading, ReconcileView } from "@/components/admin/reconcile-view";
import { requireWorkspace } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { SavedReconcilePanel } from "@/components/admin/card-reconcile-saved";
import { getSavedReconcile } from "@/lib/cards/saved-server";
import { currentMonthKst } from "@/lib/dates";
import { MONTH } from "@/lib/tax/closing";

export const metadata = { title: "법인카드 내역 대조 · PocketExpense" };

// 법인카드 사용 내역 대조 (D-111)
export default function ReconcilePage({ params, searchParams }: PageProps<"/workspace/[id]/admin/corporate-cards/reconcile">) {
  return (
    <>
      <ReconcileHeading />
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-zinc-100" />}>
        <Content params={params} searchParams={searchParams} />
      </Suspense>
    </>
  );
}

// 이번 달부터 지난 11개월
function recentMonths(now: string): string[] {
  const [y, m] = now.split("-").map(Number);
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}

async function Content({ params, searchParams }: Pick<PageProps<"/workspace/[id]/admin/corporate-cards/reconcile">, "params" | "searchParams">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const membership = await requireWorkspace(id, { admin: true });
  const supabase = await createClient();
  const { data: cards } = await supabase.from("corporate_cards").select("last4, nickname, holder:members(name)").eq("company_id", membership.company_id);
  const holders = Object.fromEntries((cards ?? []).map((c) => [c.last4, `${c.nickname}${(c.holder as { name: string } | null)?.name ? ` · ${(c.holder as { name: string }).name}` : ""}`]));
  // 저장된 대조 결과(D-154): 기본은 지난달(보통 지난달을 마감한다)
  const months = recentMonths(currentMonthKst());
  const month = typeof sp.month === "string" && MONTH.test(sp.month) ? sp.month : months[1];
  const saved = await getSavedReconcile(membership.company_id, month);
  return (
    <div className="flex flex-col gap-4">
      <nav aria-label="대조 결과 달" className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-zinc-600">저장된 결과 보기</span>
        {months.slice(0, 6).map((m) => (
          <Link
            key={m}
            href={`?month=${m}`}
            aria-current={m === month ? "page" : undefined}
            className={`inline-flex min-h-9 items-center rounded-lg px-3 ${m === month ? "bg-zinc-900 font-semibold text-white" : "border border-zinc-300 bg-white hover:bg-zinc-50"}`}
          >
            {Number(m.slice(5))}월
          </Link>
        ))}
      </nav>
      {saved ? (
        <SavedReconcilePanel key={saved.updated_at} saved={saved} editable />
      ) : (
        <p className="rounded-xl bg-zinc-100 px-4 py-3 text-sm text-zinc-600">
          {Number(month.slice(5))}월 대조 결과가 아직 없어요. 아래에서 카드 내역을 올려 대조하고 저장해 주세요.
        </p>
      )}
      <ReconcileView base={`/workspace/${id}`} holders={holders} />
    </div>
  );
}
