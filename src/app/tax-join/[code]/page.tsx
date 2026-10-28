import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { JoinTaxOfficeForm } from "@/components/tax-office/join-tax-office-form";
import { buttonSecondary, Card, PageShell } from "@/components/ui/page-shell";
import { requireLogin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { getMyTaxOffice } from "@/lib/tax-office/queries";

export const metadata = { title: "세무사무소 합류 · PocketExpense", robots: { index: false, follow: false } };

// 소속 세무사 합류 링크 (D-149). 회사 직원 가입과 별개
export default function TaxJoinPage({ params }: PageProps<"/tax-join/[code]">) {
  return (
    <PageShell>
      <Suspense fallback={<div className="h-72 animate-pulse rounded-xl bg-zinc-100" />}>
        <Content params={params} />
      </Suspense>
    </PageShell>
  );
}

async function Content({ params }: Pick<PageProps<"/tax-join/[code]">, "params">) {
  const { code } = await params;
  await requireLogin(`/tax-join/${encodeURIComponent(code)}`);
  const state = await getMyTaxOffice();
  if (state && state.member_id !== null) redirect("/tax-office");
  const supabase = await createClient();
  const { data: officeName } = await supabase.rpc("get_tax_office_by_code", { p_code: code });
  if (!officeName) {
    return (
      <Card>
        <h1 className="text-xl font-bold">초대 링크를 확인해 주세요</h1>
        <p className="mb-4 mt-1 break-keep text-sm text-zinc-600">없거나 새로 바뀐 초대 링크예요. 사무소 관리자에게 새 링크를 요청해 주세요.</p>
        <Link href="/tax-office" className={buttonSecondary}>
          세무사무소 화면으로
        </Link>
      </Card>
    );
  }
  return (
    <>
      <div className="pt-6">
        <p className="text-sm font-medium text-blue-600">세무사무소 합류</p>
        <h1 className="text-balance break-keep text-2xl font-bold tracking-tight">{officeName}</h1>
        <p className="mt-1 break-keep text-sm text-zinc-600">합류하면 사무소 관리자가 배정한 고객사의 세무 자료를 볼 수 있어요.</p>
      </div>
      <Card>
        <JoinTaxOfficeForm code={code} />
      </Card>
    </>
  );
}
