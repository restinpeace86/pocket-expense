import { notFound } from "next/navigation";
import { PushToggle } from "@/components/push/push-toggle";
import { Suspense } from "react";
import { CompanySettingsForm } from "@/components/admin/company-settings-form";
import { getCompanySettings } from "@/lib/admin/queries";
import { requireWorkspace } from "@/lib/auth/guards";
import { currentMonthKst } from "@/lib/dates";
import { claimCutoff, taxCloseDue } from "@/lib/expense/deadline";
import { getHolidays } from "@/lib/expense/holidays";

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
  const [settings, holidays] = await Promise.all([getCompanySettings(membership.company_id), getHolidays()]);
  const month = currentMonthKst();
  if (!settings) notFound();
  return (
    <>
      <PushToggle />
      <CompanySettingsForm settings={settings} closing={{ month, claimCutoff: claimCutoff(month, holidays), taxDue: taxCloseDue(month, holidays) }} />
    </>
  );
}
