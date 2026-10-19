import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CompanyDetailView } from "@/components/app-admin/company-detail-view";
import { getCompanyDetail } from "@/lib/app-admin/queries";
import { currentMonthKst } from "@/lib/dates";
import { parseMonth } from "@/lib/expense/status";

export default function AppAdminCompany({ params, searchParams }: PageProps<"/app-admin/companies/[companyId]">) {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-zinc-100" />}>
      <Company params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Company({ params, searchParams }: Pick<PageProps<"/app-admin/companies/[companyId]">, "params" | "searchParams">) {
  const [{ companyId }, sp] = await Promise.all([params, searchParams]);
  const month = parseMonth(typeof sp.month === "string" ? sp.month : null, currentMonthKst());
  const data = await getCompanyDetail(companyId, month);
  if (!data) notFound();
  return <CompanyDetailView data={data} month={month} />;
}
