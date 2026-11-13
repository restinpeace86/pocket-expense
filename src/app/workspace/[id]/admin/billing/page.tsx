import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BillingView } from "@/components/admin/billing-view";
import { CreditUsageSection, type CreditUsage } from "@/components/admin/credit-usage";
import { getBillingAddons, getBillingPlans, getCreditStatus } from "@/lib/admin/billing";
import { requireWorkspace } from "@/lib/auth/guards";
import { todayKst } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { BRAND } from "@/lib/brand";
import type { StorageStatus } from "@/lib/billing/storage";

export const metadata = { title: `요금제 · ${BRAND.name}` };

// 화면 A-05 요금제 (spec/screens/admin-billing.md) + 크레딧 사용 내역(8-104)
export default function BillingPage({ params, searchParams }: PageProps<"/workspace/[id]/admin/billing">) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-zinc-100" />}>
      <Billing params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Billing({ params, searchParams }: Pick<PageProps<"/workspace/[id]/admin/billing">, "params" | "searchParams">) {
  const { id } = await params;
  const sp = await searchParams;
  const membership = await requireWorkspace(id, { admin: true });
  const thisMonth = todayKst().slice(0, 7);
  const q = typeof sp.month === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.month) && sp.month <= thisMonth ? sp.month : thisMonth;
  const supabase = await createClient();
  const [status, plans, addons, usage, storage, storageAddons] = await Promise.all([
    getCreditStatus(membership.company_id),
    getBillingPlans(),
    getBillingAddons(),
    supabase.rpc("credit_usage", { p_month: q }),
    supabase.rpc("storage_addon_status"),
    supabase.from("storage_addons").select("code, storage_gb, monthly_price").order("sort_order"),
  ]);
  if (!status) notFound();
  return (
    <div className="flex flex-col gap-6">
      <BillingView status={status} plans={plans} addons={addons} storage={(storage.data as unknown as StorageStatus) ?? null} storageAddons={storageAddons.data ?? []} />
      <CreditUsageSection base={`/workspace/${id}/admin/billing`} month={q} thisMonth={thisMonth} data={(usage.data as unknown as CreditUsage) ?? null} />
    </div>
  );
}
