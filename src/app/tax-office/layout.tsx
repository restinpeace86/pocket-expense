import type { Metadata } from "next";
import { Landmark } from "lucide-react";
import { Suspense } from "react";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { TaxOfficeShell } from "@/components/tax-office/tax-office-shell";
import { requireLogin } from "@/lib/auth/guards";
import { getMyTaxCompanies } from "@/lib/tax-office/queries";

// 세무사 화면 (D-148): 회사 멤버가 아닌 외부 열람자. 담당 회사는 각 회사 관리자가 이메일로 연결한다
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
  const companies = await getMyTaxCompanies();
  if (companies.length === 0) return <NoCompanies />;
  return <TaxOfficeShell companies={companies.map((c) => ({ id: c.company_id, name: c.company_name }))}>{children}</TaxOfficeShell>;
}

function NoCompanies() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-3 px-4 py-16 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-600">
        <Landmark className="size-7" aria-hidden />
      </span>
      <h1 className="text-xl font-bold tracking-tight">연결된 회사가 아직 없어요</h1>
      <p className="break-keep text-sm leading-relaxed text-zinc-600">
        고객사 관리자가 PocketExpense [설정 › 담당 세무사]에 지금 로그인한 계정의 이메일을 넣으면 여기에 회사가 보여요. 다른 이메일로 등록됐다면 로그아웃한 뒤 그
        계정으로 로그인해 주세요.
      </p>
      <SignOutButton />
    </main>
  );
}
