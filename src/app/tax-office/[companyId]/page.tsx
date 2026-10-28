import { notFound } from "next/navigation";
import { Suspense } from "react";
import { TaxOfficeMonthView } from "@/components/tax-office/tax-office-month-view";
import { currentMonthKst } from "@/lib/dates";
import { MONTH } from "@/lib/tax/closing";
import { getMyTaxCompanies, getTaxAgentMonth, signTaxAgentReceipts } from "@/lib/tax-office/queries";

export const metadata = { title: "세무 자료 · PocketExpense 세무사무소" };

// 세무사: 담당 회사 한 곳의 월별 세무 자료 (D-148). 회사 관리자 세무 마감과 같은 행(승인·지급된 지출만)
export default function TaxOfficeCompanyPage({ params, searchParams }: PageProps<"/tax-office/[companyId]">) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-zinc-100" />}>
      <Content params={params} searchParams={searchParams} />
    </Suspense>
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

async function Content({ params, searchParams }: Pick<PageProps<"/tax-office/[companyId]">, "params" | "searchParams">) {
  const [{ companyId }, sp] = await Promise.all([params, searchParams]);
  const company = (await getMyTaxCompanies()).find((c) => c.company_id === companyId);
  if (!company) notFound();
  const now = currentMonthKst();
  const months = recentMonths(now);
  // 기본은 지난달(보통 지난달을 기장한다)
  const month = typeof sp.month === "string" && MONTH.test(sp.month) && sp.month <= now ? sp.month : months[1];
  const data = await getTaxAgentMonth(companyId, month);
  if (!data) notFound();
  const urls = await signTaxAgentReceipts(companyId, data.rows);
  return (
    <TaxOfficeMonthView
      companyId={companyId}
      companyName={company.company_name}
      businessNumber={company.business_number}
      data={data}
      months={months.includes(month) ? months : [month, ...months]}
      receiptUrls={Object.fromEntries(urls)}
    />
  );
}
