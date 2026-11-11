import { Suspense } from "react";
import { ClaimsListView } from "@/components/employee/claims-list-view";
import { requireWorkspace } from "@/lib/auth/guards";
import { creditEventEnabled } from "@/lib/credits";
import { currentMonthKst } from "@/lib/dates";
import { getMyClaims, getMySummary } from "@/lib/employee/queries";
import { filterStatuses, parseFilter, parseMonth } from "@/lib/expense/status";

export const metadata = { title: "지출결의 · Moa-on" };

// [지출결의] 화면: 내 결의서 목록 (worker-dashboard.md §4, D-235 — 예전 직원 홈에서 옮김)
export default function ClaimsPage({ params, searchParams }: PageProps<"/workspace/[id]/employee/claims">) {
  return (
    <Suspense fallback={<div className="mx-auto my-4 h-64 w-[calc(100%-2rem)] max-w-md animate-pulse rounded-2xl bg-zinc-100" />}>
      <Claims params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Claims({ params, searchParams }: Pick<PageProps<"/workspace/[id]/employee/claims">, "params" | "searchParams">) {
  const { id } = await params;
  const sp = await searchParams;
  const membership = await requireWorkspace(id);
  const thisMonth = currentMonthKst();
  const parsed = parseMonth(typeof sp.month === "string" ? sp.month : null, thisMonth);
  const month = parsed > thisMonth ? thisMonth : parsed;
  const filter = parseFilter(typeof sp.status === "string" ? sp.status : null);
  const [summary, page] = await Promise.all([getMySummary(), getMyClaims(membership.company_id, membership.member_id, { month, statuses: filterStatuses(filter) })]);
  return (
    <ClaimsListView
      key={`${month}:${filter}`}
      base={`/workspace/${id}/employee`}
      month={month}
      thisMonth={thisMonth}
      filter={filter}
      summary={summary}
      creditsBlocked={summary.credits_left <= 0 && !creditEventEnabled()}
      initial={page}
    />
  );
}
