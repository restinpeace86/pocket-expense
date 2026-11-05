import { notFound } from "next/navigation";
import { Suspense } from "react";
import { OfficeWorkbookPreview } from "@/components/tax-office/office-workbook-preview";
import { TaxOfficeMonthView } from "@/components/tax-office/tax-office-month-view";
import { currentMonthKst } from "@/lib/dates";
import { MONTH } from "@/lib/tax/closing";
import { createClient } from "@/lib/supabase/server";
import { getSavedReconcile } from "@/lib/cards/saved-server";
import { getTaxOfficeClients, getTaxOfficeMonth, signTaxOfficeReceipts } from "@/lib/tax-office/queries";
import type { TemplateTarget } from "@/lib/tax-office/template-fields";
import { listHometax } from "@/lib/hometax/server";
import { listTaxRequests, markTaxRequestsSeen } from "@/lib/tax-office/requests";
import { getExportOptions } from "@/lib/tax/export-options";
import { ISSUE_KINDS, type IssueKind } from "@/lib/tax/export-rows";

export const metadata = { title: "세무 자료 · WORKON 세무사무소" };

// 세무사무소: 고객사 한 곳의 월별 세무 자료 (D-149). 회사 관리자 세무 마감과 같은 행(승인·지급된 지출만)
const openRequestItems = (rs: { item_id: string | null; status: string }[]) => rs.filter((r) => r.item_id && r.status !== "resolved").map((r) => r.item_id!);

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
  const company = (await getTaxOfficeClients()).find((c) => c.company_id === companyId);
  if (!company) notFound();
  const now = currentMonthKst();
  const months = recentMonths(now);
  // 기본은 지난달(보통 지난달을 기장한다)
  const month = typeof sp.month === "string" && MONTH.test(sp.month) && sp.month <= now ? sp.month : months[1];
  const data = await getTaxOfficeMonth(companyId, month);
  if (!data) notFound();
  const supabase = await createClient();
  const [urls, { data: templates }, cardReconcile, { data: titles }, hometax, requests, exportOptions] = await Promise.all([
    signTaxOfficeReceipts(companyId, data.rows),
    supabase.rpc("tax_office_template_list"),
    getSavedReconcile(companyId, month),
    supabase.from("account_titles").select("id, name, code").eq("company_id", companyId).order("sort_order"),
    listHometax(companyId, month),
    listTaxRequests(companyId, month),
    getExportOptions(companyId),
  ]);
  // 확인 요청을 열어 봤음(D-196) — 이번 화면은 "새" 표시를 그대로 보여 주고, 다음부터 지움
  if (requests.some((r) => r.unread_for === "office")) await markTaxRequestsSeen(companyId);
  return (
    <TaxOfficeMonthView
      companyId={companyId}
      companyName={company.company_name}
      businessNumber={company.business_number}
      data={data}
      months={months.includes(month) ? months : [month, ...months]}
      receiptUrls={Object.fromEntries(urls)}
      cardReconcile={cardReconcile}
      accountTitles={titles ?? []}
      hometax={hometax}
      requests={requests}
      templates={(templates ?? []).map((t) => ({ id: t.id, name: t.name, target: t.target as TemplateTarget }))}
      exportOptions={exportOptions}
      issue={typeof sp.issue === "string" && (ISSUE_KINDS as string[]).includes(sp.issue) ? (sp.issue as IssueKind) : null}
      workbookPreview={
        data.rows.length > 0 ? (
          <Suspense key={`wb-${month}`} fallback={<div className="h-12 animate-pulse rounded-xl bg-zinc-100" />}>
            <OfficeWorkbookPreview month={month} companyName={company.company_name} rows={data.rows} preview={data.status !== "closed"} cardReconcile={cardReconcile} main={exportOptions.main} receiptUrls={Object.fromEntries(urls)} requestItemIds={openRequestItems(requests)} />
          </Suspense>
        ) : null
      }
    />
  );
}
