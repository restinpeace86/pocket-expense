import { Suspense } from "react";
import { SettingsSectionPage } from "./section";
import { CompanyLocationCard } from "@/components/admin/company-location-card";
import { requireWorkspace } from "@/lib/auth/guards";
import { getCompanyNearby } from "@/lib/bus/server";
import { BRAND } from "@/lib/brand";

export const metadata = { title: `회사정보 · ${BRAND.name}` };

type Params = PageProps<"/workspace/[id]/admin/settings">["params"];

// 설정 › 회사 기본정보 › 회사정보(D-251, spec/screens/admin-settings.md §1·§4)
// 회사 위치도 회사 기본정보라 같은 탭 아래 카드로(사용자 2026-11-21, 옛 '회사 위치' 탭 합침)
export default function SettingsPage({ params }: PageProps<"/workspace/[id]/admin/settings">) {
  return (
    <SettingsSectionPage
      title="회사정보"
      params={params}
      show={["company"]}
      extra={
        <Suspense fallback={<div className="h-48 animate-pulse rounded-xl bg-zinc-100" />}>
          <Location params={params} />
        </Suspense>
      }
    />
  );
}

async function Location({ params }: { params: Params }) {
  const { id } = await params;
  await requireWorkspace(id, { admin: true });
  return <CompanyLocationCard current={await getCompanyNearby()} />;
}
