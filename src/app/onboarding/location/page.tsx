import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { CompanyLocationCard } from "@/components/admin/company-location-card";
import { PageShell, buttonPrimary } from "@/components/ui/page-shell";
import { requireLogin } from "@/lib/auth/guards";
import { workspaceHome } from "@/lib/auth/paths";
import { getMembership } from "@/lib/auth/session";
import { getCompanyNearby } from "@/lib/bus/server";
import { BRAND } from "@/lib/brand";

export const metadata = { title: `회사 위치 · ${BRAND.name}` };

// 회사 등록 다음 단계(선택, 사용자 2026-11-21): 회사 위치를 처음에 넣어 두면 나중에 설정에서 할 일이 하나 줄어든다
// 회사를 만든 최고 관리자만. 건너뛰어도 설정 › 회사 기본정보 › 회사정보 아래에서 언제든 넣을 수 있다
export default function OnboardingLocationPage() {
  return (
    <PageShell>
      <div className="pt-6">
        <p className="text-sm font-medium text-blue-600">회사 등록 · 다음 단계(선택)</p>
        <h1 className="text-balance break-keep text-2xl font-bold tracking-tight">회사 주소를 넣어 둘까요?</h1>
        <p className="mt-1 break-keep text-sm leading-relaxed text-zinc-600">
          넣어 두면 직원 홈에 회사 근처 버스 도착 정보가 보여요. 지금 안 해도 나중에 설정 › 회사 기본정보에서 넣을 수 있어요.
        </p>
      </div>
      <Suspense fallback={<div className="h-56 animate-pulse rounded-xl bg-zinc-100" />}>
        <Guarded />
      </Suspense>
    </PageShell>
  );
}

async function Guarded() {
  await requireLogin("/onboarding/location");
  const membership = await getMembership();
  if (!membership) redirect("/onboarding");
  if (membership.status !== "approved" || membership.role !== "super_admin") redirect(workspaceHome(membership));
  const current = await getCompanyNearby();
  return (
    <>
      <CompanyLocationCard current={current} />
      <div className="flex flex-col gap-2">
        <Link href="/onboarding/referral" className={buttonPrimary} data-onboarding-next>
          다음
        </Link>
        <p className="text-center text-xs text-zinc-500">주소를 고르지 않고 [다음]을 누르면 건너뛰어요.</p>
      </div>
    </>
  );
}
