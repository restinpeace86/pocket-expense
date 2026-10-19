import { Suspense } from "react";
import { CompaniesView, type CompanyOverviewRow } from "@/components/app-admin/companies-view";
import { getCompanyOverview } from "@/lib/app-admin/queries";
import { currentMonthKst } from "@/lib/dates";
import { parseMonth } from "@/lib/expense/status";

export default function AppAdminHome({ searchParams }: PageProps<"/app-admin">) {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-zinc-100" />}>
      <Home searchParams={searchParams} />
    </Suspense>
  );
}

async function Home({ searchParams }: Pick<PageProps<"/app-admin">, "searchParams">) {
  const sp = await searchParams;
  const month = parseMonth(typeof sp.month === "string" ? sp.month : null, currentMonthKst());
  const rows = (await getCompanyOverview(month)) as CompanyOverviewRow[];
  return <CompaniesView rows={rows} month={month} />;
}
