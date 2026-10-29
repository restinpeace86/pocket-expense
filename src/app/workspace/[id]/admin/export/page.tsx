import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CardReconcileStatus } from "@/components/admin/card-reconcile-status";
import { getSavedReconcile } from "@/lib/cards/saved-server";
import { TaxClosingView } from "@/components/admin/tax-closing-view";
import { SectionHeading } from "@/components/ui/help";
import { requireWorkspace } from "@/lib/auth/guards";
import { currentMonthKst } from "@/lib/dates";
import { getTaxMonth, MONTH } from "@/lib/tax/closing";
import { TemplateDownloads } from "@/components/tax-office/template-downloads";
import { TaxDownloadLog, type TaxDownloadRow } from "@/components/admin/tax-download-log";
import { createClient } from "@/lib/supabase/server";
import type { TemplateTarget } from "@/lib/tax-office/template-fields";
import { HometaxFiles } from "@/components/tax-office/hometax-files";
import { listHometax } from "@/lib/hometax/server";
import { claimCutoff, mdLabel, monthLabel, taxCloseDue } from "@/lib/expense/deadline";
import { getHolidays } from "@/lib/expense/holidays";

export const metadata = { title: "세무 마감 · PocketExpense" };

// 화면: 세무 마감 및 증빙 다운로드 (tax-closing.md)
export default function ExportPage({ params, searchParams }: PageProps<"/workspace/[id]/admin/export">) {
  return (
    <>
      <SectionHeading
        as="h1"
        title="세무 마감"
        summary="승인된 지출을 세무사무소에 보낼 엑셀 장부와 1:1로 이름 붙인 영수증 묶음(ZIP)으로 내려받아요. 사용일자 기준으로 달을 나눠요."
      />
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-zinc-100" />}>
        <Export params={params} searchParams={searchParams} />
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

async function Export({ params, searchParams }: Pick<PageProps<"/workspace/[id]/admin/export">, "params" | "searchParams">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const membership = await requireWorkspace(id, { admin: true });
  const now = currentMonthKst();
  const months = recentMonths(now);
  // 기본은 지난달(보통 지난달을 마감한다)
  const month = typeof sp.month === "string" && MONTH.test(sp.month) && sp.month <= now ? sp.month : months[1];
  const supabase = await createClient();
  const [y0, m0] = month.split("-").map(Number);
  const nextFirst = new Date(Date.UTC(y0, m0, 1)).toISOString().slice(0, 10);
  const [res, { data: templates }, { data: downloads }, cardRec, hometax, holidays, { data: pendingItems }] = await Promise.all([
    getTaxMonth(month),
    supabase.rpc("my_company_tax_templates"),
    supabase.from("tax_export_downloads").select("id, actor_kind, actor_name, office_name, month, kind, template_name, row_count, closed, created_at").order("created_at", { ascending: false }).limit(20),
    getSavedReconcile(membership.company_id, month),
    listHometax(membership.company_id, month),
    getHolidays(),
    // 이 달까지 쓴 영수증이 든 승인 대기 결의서(D-166) — 마감 전에 승인·반려하라고 보여 준다
    supabase.from("expense_items").select("claim_id, expense_claims!inner(status)").eq("company_id", membership.company_id).eq("expense_claims.status", "submitted").lt("expense_date", nextFirst).limit(1000),
  ]);
  const pendingClaims = new Set((pendingItems ?? []).map((i) => i.claim_id)).size;
  const cutoff = claimCutoff(month, holidays);
  const due = taxCloseDue(month, holidays);
  if (!res.ok) notFound();
  return (
    <div className="flex flex-col gap-4">
      {/* 고정 마감 일정(D-161): 청구 마감 2일 · 세무 마감 5일(영업일로 당김), 늦은 청구는 다음 달 정산 */}
      <p className="break-keep rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-900">
        {monthLabel(month)}분 <b>세무 마감일은 {mdLabel(due)}</b>이에요(직원 청구 마감 {mdLabel(cutoff)}). 홈택스 자료를 올리고 마감해 세무사무소에 넘겨 주세요. 청구 마감 뒤에 상신된 {monthLabel(month)} 영수증은 다음 달 세무 마감의 &ldquo;전월 추가분&rdquo;으로 들어가요.
      </p>
      {pendingClaims > 0 && (
        <div role="alert" className="flex flex-col gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="break-keep text-sm text-red-900">
            <b>{monthLabel(month)}까지 쓴 결의서 {pendingClaims}건이 아직 승인 대기 중이에요.</b> 마감일({mdLabel(due)})까지 승인 또는 반려해 주세요. 처리하지 않으면 이번 세무 자료에서 빠지고 다음 달로 넘어가요.
          </p>
          <Link href={`/workspace/${id}/admin/claims?tab=pending`} className="inline-flex min-h-11 shrink-0 items-center justify-center whitespace-nowrap rounded-xl bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700">
            승인하러 가기
          </Link>
        </div>
      )}
      {/* 이번 달 카드 내역 대조 상태(D-111, D-154): 막지 않고 보여 주며, 결과는 세무 엑셀 카드 대조 결과 시트로 함께 넘어간다 */}
      <CardReconcileStatus saved={cardRec} month={month} href={`/workspace/${id}/admin/corporate-cards/reconcile?month=${month}`} />
      {/* 우리 세무사무소가 올린 결산 양식으로 받기 (D-150) */}
      <TemplateDownloads
        templates={(templates ?? []).map((t) => ({ id: t.id, name: t.name, target: t.target as TemplateTarget }))}
        officeName={templates?.[0]?.office_name}
        hrefFor={(tid) => `/workspace/${id}/admin/export/template?id=${tid}&month=${month}`}
        disabled={res.data.rows.length === 0}
      />
      <TaxClosingView
      key={month}
      data={res.data}
      months={months.includes(month) ? months : [month, ...months]}
      base={`/workspace/${id}/admin/export`}
      claimsBase={`/workspace/${id}/admin/claims`}
      companyName={membership.company_name}
      isSuper={membership.role === "super_admin"}
    />
      {/* 홈택스에서 내려받은 자료 올리기 — 세무사무소도 보고 받음(D-158) */}
      <HometaxFiles key={`ht-${month}`} uploads={hometax} month={month} downloadBase={`/workspace/${id}/admin/export/hometax?id=`} editable />
      {/* 세무 자료 내려받은 기록(D-153) */}
      <TaxDownloadLog rows={(downloads ?? []) as TaxDownloadRow[]} />
    </div>
  );
}
