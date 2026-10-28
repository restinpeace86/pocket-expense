import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AccountTitlesView } from "@/components/admin/account-titles-view";
import { getAccountTitles } from "@/lib/admin/queries";
import { getMyTaxCompanies } from "@/lib/tax-office/queries";
import { taxAgentAddTitleAction, taxAgentSetMappingAction, taxAgentUpdateTitleAction } from "./actions";

export const metadata = { title: "계정과목 · PocketExpense 세무사무소" };

// 세무사: 담당 회사의 계정과목·계정코드·분류 연결 (D-148). 회사 관리자 화면과 같은 화면, 삭제만 없음
export default function TaxOfficeAccountTitlesPage({ params }: PageProps<"/tax-office/[companyId]/account-titles">) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-zinc-100" />}>
      <Content params={params} />
    </Suspense>
  );
}

async function Content({ params }: Pick<PageProps<"/tax-office/[companyId]/account-titles">, "params">) {
  const { companyId } = await params;
  const company = (await getMyTaxCompanies()).find((c) => c.company_id === companyId);
  if (!company) notFound();
  const { titles, mappings } = await getAccountTitles(companyId);
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold tracking-tight">{company.company_name}</h1>
          <p className="break-keep text-sm text-zinc-500">세무사무소 회계 프로그램의 계정과목·코드에 맞춰 바꿔 주세요. 이후 상신되는 지출부터 적용돼요.</p>
        </div>
        <nav aria-label="회사 메뉴" className="flex gap-1 text-sm">
          <Link href={`/tax-office/${companyId}`} className="inline-flex min-h-10 items-center rounded-lg border border-zinc-300 bg-white px-3 hover:bg-zinc-50">
            세무 자료
          </Link>
          <span aria-current="page" className="inline-flex min-h-10 items-center rounded-lg bg-zinc-900 px-3 font-semibold text-white">
            계정과목
          </span>
        </nav>
      </div>
      <AccountTitlesView
        titles={titles}
        mappings={mappings}
        actions={{
          add: taxAgentAddTitleAction.bind(null, companyId),
          update: taxAgentUpdateTitleAction.bind(null, companyId),
          setMapping: taxAgentSetMappingAction.bind(null, companyId),
        }}
      />
    </>
  );
}
