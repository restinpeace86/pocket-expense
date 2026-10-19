import { Suspense } from "react";
import { EmployeeHomeView } from "@/components/employee/employee-home-view";
import { requireWorkspace } from "@/lib/auth/guards";
import { creditEventEnabled } from "@/lib/credits";
import { currentMonthKst } from "@/lib/dates";
import { getMyClaims, getMySummary } from "@/lib/employee/queries";
import { filterStatuses, parseFilter, parseMonth } from "@/lib/expense/status";

export const metadata = { title: "내 경비 · PocketExpense" };

// 화면 E-01 직원 메인 (spec/screens/worker-dashboard.md)
export default function EmployeeHomePage({ params, searchParams }: PageProps<"/workspace/[id]/employee">) {
  return (
    <Suspense fallback={<div className="mx-auto my-4 h-64 w-[calc(100%-2rem)] max-w-md animate-pulse rounded-2xl bg-zinc-100" />}>
      <EmployeeHome params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function EmployeeHome({ params, searchParams }: Pick<PageProps<"/workspace/[id]/employee">, "params" | "searchParams">) {
  const { id } = await params;
  const sp = await searchParams;
  const membership = await requireWorkspace(id);
  const thisMonth = currentMonthKst();
  const parsed = parseMonth(typeof sp.month === "string" ? sp.month : null, thisMonth);
  const month = parsed > thisMonth ? thisMonth : parsed;
  const filter = parseFilter(typeof sp.status === "string" ? sp.status : null);
  const [summary, page] = await Promise.all([
    getMySummary(),
    getMyClaims(membership.company_id, membership.member_id, { month, statuses: filterStatuses(filter) }),
  ]);
  return (
    <EmployeeHomeView
      key={`${month}:${filter}`}
      name={membership.name}
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
