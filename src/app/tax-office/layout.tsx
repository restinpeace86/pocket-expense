import type { Metadata } from "next";
import { Ban } from "lucide-react";
import { Suspense } from "react";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { TaxOfficeOnboarding } from "@/components/tax-office/tax-office-onboarding";
import { TaxOfficeShell } from "@/components/tax-office/tax-office-shell";
import { requireLogin } from "@/lib/auth/guards";
import { getMyTaxOffice, getTaxOfficeClients } from "@/lib/tax-office/queries";

// 세무사무소 워크스페이스 (D-149): 회사 멤버와 별개. 구성원이 아니면 사무소 등록·합류 화면
export const metadata: Metadata = { title: "세무사무소 · PocketExpense", robots: { index: false, follow: false } };

export default function TaxOfficeLayout({ children }: LayoutProps<"/tax-office">) {
  return (
    <Suspense fallback={<div className="m-6 h-64 flex-1 animate-pulse rounded-xl bg-zinc-100" />}>
      <Guarded>{children}</Guarded>
    </Suspense>
  );
}

async function Guarded({ children }: { children: React.ReactNode }) {
  await requireLogin("/tax-office");
  const state = await getMyTaxOffice();
  if (!state || state.member_id === null) return <TaxOfficeOnboarding email={state?.email ?? null} requests={state?.requests ?? []} />;
  if (state.status !== "active") return <Stopped office={state.office_name} />;
  const clients = await getTaxOfficeClients();
  return (
    <TaxOfficeShell officeName={state.office_name} isAdmin={state.role === "admin"} companies={clients.map((c) => ({ id: c.company_id, name: c.company_name }))}>
      {children}
    </TaxOfficeShell>
  );
}

function Stopped({ office }: { office: string }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-3 px-4 py-16 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-600">
        <Ban className="size-7" aria-hidden />
      </span>
      <h1 className="text-xl font-bold tracking-tight">이용이 중지된 계정이에요</h1>
      <p className="break-keep text-sm leading-relaxed text-zinc-600">{office} 관리자가 이 계정의 이용을 중지했어요. 다시 쓰려면 사무소 관리자에게 요청해 주세요.</p>
      <SignOutButton />
    </main>
  );
}
