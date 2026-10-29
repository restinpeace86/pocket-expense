import { Link2Off } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { TaxOfficeOnboarding } from "@/components/tax-office/tax-office-onboarding";
import { requireLogin } from "@/lib/auth/guards";
import { messageForDbError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { getMyTaxOffice } from "@/lib/tax-office/queries";

export const metadata = { title: "고객사 연결 · PocketExpense 세무사무소", robots: { index: false, follow: false } };

// 고객사 연결 링크 처리 (D-173): 로그인 → 사무소가 없으면 등록과 함께 연결 / 사무소 관리자면 바로 연결 / 소속 세무사면 안내
export default function TaxConnectPage({ params }: PageProps<"/tax-connect/[code]">) {
  return (
    <Suspense fallback={<div className="m-6 h-96 animate-pulse rounded-xl bg-zinc-100" />}>
      <Connect params={params} />
    </Suspense>
  );
}

async function Connect({ params }: Pick<PageProps<"/tax-connect/[code]">, "params">) {
  const { code } = await params;
  const clean = code.toUpperCase().replace(/[^A-Z2-9]/g, "").slice(0, 10);
  await requireLogin(`/tax-connect/${clean}`);
  const supabase = await createClient();
  const { data } = await supabase.rpc("tax_office_connect_info", { p_code: clean });
  const info = data as { company_name: string; office_name: string } | null;
  if (!info) return <Problem text={messageForDbError({ message: "INVALID_CONNECT_CODE" })} />;
  const state = await getMyTaxOffice();
  if (!state || state.member_id === null) {
    return <TaxOfficeOnboarding email={state?.email ?? null} requests={state?.requests ?? []} connect={{ code: clean, companyName: info.company_name }} />;
  }
  if (state.status !== "active" || state.role !== "admin") {
    return <Problem text={`${info.company_name} 연결은 ${state.office_name} 관리자 계정으로 해 주세요. 관리자에게 이 링크를 전달하면 돼요.`} />;
  }
  const { data: cid, error } = await supabase.rpc("connect_tax_office_by_code", { p_code: clean });
  if (error || !cid) return <Problem text={messageForDbError(error ?? { message: "INVALID_CONNECT_CODE" })} />;
  redirect(`/tax-office/${cid}`);
}

function Problem({ text }: { text: string }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-3 px-4 py-16 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-600">
        <Link2Off className="size-7" aria-hidden />
      </span>
      <h1 className="text-xl font-bold tracking-tight">고객사를 연결하지 못했어요</h1>
      <p className="break-keep text-sm leading-relaxed text-zinc-600">{text}</p>
      <Link href="/tax-office" className="inline-flex min-h-11 items-center rounded-xl border border-zinc-300 px-4 text-sm font-medium">
        세무사무소 화면으로
      </Link>
    </main>
  );
}
