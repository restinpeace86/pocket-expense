import { Suspense } from "react";
import { CompanyLocationCard } from "@/components/admin/company-location-card";
import { requireWorkspace } from "@/lib/auth/guards";
import { getCompanyNearby } from "@/lib/bus/server";
import { BRAND } from "@/lib/brand";

export const metadata = { title: `회사 위치 · ${BRAND.name}` };

// 설정 › 회사 기본정보 › 회사 위치(D-243 → D-251)
export default function Page({ params }: PageProps<"/workspace/[id]/admin/settings/location">) {
  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">회사 위치</h1>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-zinc-100" />}>
        <Content params={params} />
      </Suspense>
    </>
  );
}

async function Content({ params }: { params: PageProps<"/workspace/[id]/admin/settings/location">["params"] }) {
  const { id } = await params;
  await requireWorkspace(id, { admin: true });
  return <CompanyLocationCard current={await getCompanyNearby()} />;
}
