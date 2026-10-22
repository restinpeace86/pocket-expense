import { Suspense } from "react";
import { VehiclesHeading, VehiclesView } from "@/components/admin/vehicles-view";
import { getCompanyVehicles } from "@/lib/admin/queries";
import { requireWorkspace } from "@/lib/auth/guards";
import { currentMonthKst, monthRange } from "@/lib/dates";

export const metadata = { title: "회사차량 · PocketExpense" };

// 회사차량 (D-105, spec/features/company-vehicles.md)
export default function VehiclesPage({ params }: PageProps<"/workspace/[id]/admin/vehicles">) {
  return (
    <>
      <VehiclesHeading />
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-zinc-100" />}>
        <Content params={params} />
      </Suspense>
    </>
  );
}

async function Content({ params }: { params: PageProps<"/workspace/[id]/admin/vehicles">["params"] }) {
  const { id } = await params;
  const membership = await requireWorkspace(id, { admin: true });
  const { start, end } = monthRange(currentMonthKst());
  const vehicles = await getCompanyVehicles(membership.company_id, start, end);
  return <VehiclesView vehicles={vehicles} />;
}
