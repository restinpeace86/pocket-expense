import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ReferralForm } from "@/components/onboarding/referral-form";
import { Card, PageShell } from "@/components/ui/page-shell";
import { requireLogin } from "@/lib/auth/guards";
import { workspaceHome } from "@/lib/auth/paths";
import { getMembership } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "추천 정보 · PocketExpense" };

// 회사 등록 다음 단계(선택): 추천 회사 또는 추천인 (D-147). 회사를 만든 최고 관리자만, 회사당 한 번
export default function ReferralPage() {
  return (
    <PageShell>
      <div className="pt-6">
        <p className="text-sm font-medium text-blue-600">회사 등록 · 마지막 단계(선택)</p>
        <h1 className="text-balance break-keep text-2xl font-bold tracking-tight">PocketExpense를 추천받으셨나요?</h1>
        <p className="mt-1 break-keep text-sm text-zinc-600">소개해 준 회사나 사람이 있으면 알려 주세요. 없으면 건너뛰어도 돼요.</p>
      </div>
      <Card>
        <Suspense fallback={<div className="h-72 animate-pulse rounded-xl bg-zinc-100" />}>
          <Guarded />
        </Suspense>
      </Card>
    </PageShell>
  );
}

async function Guarded() {
  await requireLogin("/onboarding/referral");
  const membership = await getMembership();
  if (!membership) redirect("/onboarding");
  const home = workspaceHome(membership);
  if (membership.status !== "approved" || membership.role !== "super_admin") redirect(home);
  const supabase = await createClient();
  const { data } = await supabase.from("company_referrals").select("company_id").maybeSingle();
  if (data) redirect(home);
  return <ReferralForm skipHref={home} />;
}
