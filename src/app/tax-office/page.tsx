import { Building2, ChevronRight } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { getMyTaxCompanies } from "@/lib/tax-office/queries";

// 세무사 첫 화면: 담당 회사 목록 (D-148)
export default function TaxOfficeHome() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-zinc-100" />}>
      <Companies />
    </Suspense>
  );
}

const bizNo = (v: string) => (/^\d{10}$/.test(v) ? `${v.slice(0, 3)}-${v.slice(3, 5)}-${v.slice(5)}` : v);

async function Companies() {
  const companies = await getMyTaxCompanies();
  return (
    <>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">담당 회사</h1>
        <p className="mt-1 break-keep text-sm text-zinc-600">
          고객사가 담당 세무사로 이 계정의 이메일을 등록하면 자동으로 늘어나요. 회사를 고르면 승인된 지출과 세무용 엑셀을 볼 수 있어요.
        </p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {companies.map((c) => (
          <li key={c.company_id}>
            <Link href={`/tax-office/${c.company_id}`} className="flex min-h-16 items-center gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm hover:border-brand-600">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                <Building2 className="size-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-zinc-900">{c.company_name}</span>
                <span className="block text-xs text-zinc-500">
                  {bizNo(c.business_number)} · 담당 {c.agent_name}
                </span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-zinc-400" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
