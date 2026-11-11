import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CompanySettingsForm, type SettingsSection } from "@/components/admin/company-settings-form";
import { FixedClosingSection } from "@/components/admin/fixed-closing-section";
import { getCompanySettings } from "@/lib/admin/queries";
import { requireWorkspace } from "@/lib/auth/guards";
import { currentMonthKst } from "@/lib/dates";
import { claimCutoff, taxCloseDue } from "@/lib/expense/deadline";
import { getHolidays } from "@/lib/expense/holidays";

// 설정 탭(D-251) 공통: 회사정보·식대·유류비·일비는 같은 저장(update_company_settings)을 영역만 나눠 보여 준다
type Params = PageProps<"/workspace/[id]/admin/settings">["params"];

export function SettingsSectionPage({ title, params, show }: { title: string; params: Params; show: SettingsSection[] | "closing" }) {
  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-zinc-100" />}>
        <Content params={params} show={show} />
      </Suspense>
    </>
  );
}

async function Content({ params, show }: { params: Params; show: SettingsSection[] | "closing" }) {
  const { id } = await params;
  const membership = await requireWorkspace(id, { admin: true });
  if (show === "closing") {
    const holidays = await getHolidays();
    const month = currentMonthKst();
    return <FixedClosingSection dates={{ month, claimCutoff: claimCutoff(month, holidays), taxDue: taxCloseDue(month, holidays) }} />;
  }
  const settings = await getCompanySettings(membership.company_id);
  if (!settings) notFound();
  return <CompanySettingsForm settings={settings} show={show} />;
}
