import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DefaultTitlesApply, type DefaultTitles } from "@/components/tax-office/default-titles";
import { createClient } from "@/lib/supabase/server";
import { getMyTaxOffice, getTaxOfficeClients, isActiveMember } from "@/lib/tax-office/queries";

export const metadata = { title: "기본 계정과목 · WORKON 세무사무소" };

// 사무소 기본 계정과목 (D-160, D-167) — 모든 고객사에 자동 적용. 사무소 관리자만. [사무소 관리]에서 메뉴로 옮김(D-184)
export default function TaxOfficeDefaultTitlesPage() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-zinc-100" />}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  const state = await getMyTaxOffice();
  if (!isActiveMember(state) || state.role !== "admin") notFound();
  const supabase = await createClient();
  const [clients, { data: defaults }] = await Promise.all([getTaxOfficeClients(), supabase.rpc("tax_office_default_titles")]);
  return (
    <>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">기본 계정과목</h1>
        <p className="mt-1 break-keep text-sm text-zinc-600">우리 사무소 기준 계정과목·코드·분류 연결이에요. 모든 고객사에 자동으로 적용되고, 새로 연결되는 고객사도 연결되는 순간 적용돼요. 특정 고객사만 다르게 하려면 그 고객사의 [계정과목]에서 고치세요.</p>
      </div>
      <DefaultTitlesApply value={(defaults ?? null) as unknown as DefaultTitles} clients={clients.map((c) => ({ id: c.company_id, name: c.company_name }))} />
    </>
  );
}
