import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CompanySettingsForm } from "@/components/admin/company-settings-form";
import { getCompanySettings } from "@/lib/admin/queries";
import { requireWorkspace } from "@/lib/auth/guards";

export const metadata = { title: "지출 한도·정책 · PocketExpense" };

// 회사·정책 설정 (spec/screens/admin-settings.md): 회사 정보, 정산 정책 (직원 초대는 홈·멤버 관리에서, D-068)
export default function SettingsPage({ params }: PageProps<"/workspace/[id]/admin/settings">) {
  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">지출 한도·정책</h1>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-zinc-100" />}>
        <Settings params={params} />
      </Suspense>
    </>
  );
}

async function Settings({ params }: { params: PageProps<"/workspace/[id]/admin/settings">["params"] }) {
  const { id } = await params;
  const membership = await requireWorkspace(id, { admin: true });
  const settings = await getCompanySettings(membership.company_id);
  if (!settings) notFound();
  return <CompanySettingsForm settings={settings} />;
}
