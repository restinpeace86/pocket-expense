import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ReconcileLink } from "@/components/admin/reconcile-link";
import { TaxClosingView } from "@/components/admin/tax-closing-view";
import { SectionHeading } from "@/components/ui/help";
import { requireWorkspace } from "@/lib/auth/guards";
import { currentMonthKst } from "@/lib/dates";
import { getTaxMonth, MONTH } from "@/lib/tax/closing";

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
  const res = await getTaxMonth(month);
  if (!res.ok) notFound();
  return (
    <div className="flex flex-col gap-4">
      {/* 마감 전에 결의서 없는 법인카드 결제가 없는지 (D-111) */}
      <ReconcileLink href={`/workspace/${id}/admin/corporate-cards/reconcile`} />
      <TaxClosingView
      key={month}
      data={res.data}
      months={months.includes(month) ? months : [month, ...months]}
      base={`/workspace/${id}/admin/export`}
      claimsBase={`/workspace/${id}/admin/claims`}
      companyName={membership.company_name}
      isSuper={membership.role === "super_admin"}
    />
    </div>
  );
}
