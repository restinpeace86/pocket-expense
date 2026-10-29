import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getRecentNotices } from "@/lib/push/notices";
import { NoticeStrip } from "@/components/push/notice-strip";
import { AdminHomeView } from "@/components/admin/admin-home-view";
import { EventBonusBanner } from "@/components/admin/event-bonus-banner";
import { getCreditStatus } from "@/lib/admin/billing";
import { describePolicy } from "@/lib/admin/policy";
import { getDashboard } from "@/lib/admin/dashboard-query";
import { getCompanySummary } from "@/lib/admin/queries";
import { currentMonthKst } from "@/lib/dates";
import { requireWorkspace } from "@/lib/auth/guards";

export const metadata = { title: "관리자 · PocketExpense" };

export default function AdminHomePage({ params }: PageProps<"/workspace/[id]/admin">) {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-zinc-100" />}>
      <AdminHome params={params} />
    </Suspense>
  );
}

// 세무사무소 계정과목 변경 알림 기준(최근 7일) — 요청 시각 기준
function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 86400_000).toISOString();
}

async function AdminHome({ params }: { params: PageProps<"/workspace/[id]/admin">["params"] }) {
  const { id } = await params;
  const membership = await requireWorkspace(id, { admin: true });
  const supabase = await createClient();
  const weekAgo = daysAgoIso(7);
  const [{ company }, credit, dashboard, notices, { count: titleChanges }] = await Promise.all([
    getCompanySummary(membership.company_id),
    getCreditStatus(membership.company_id),
    getDashboard(currentMonthKst()),
    getRecentNotices(),
    // 세무사무소가 최근 7일 안에 계정과목을 바꿨으면 알림(D-152)
    supabase.from("account_title_changes").select("id", { count: "exact", head: true }).gte("created_at", weekAgo),
  ]);
  if (!company || !dashboard) return null;
  return (
    <>
      {/* 이벤트 추가 지급 뒤 처음 접속하면 상단 배너 (pricing-policy.md §5) */}
      {credit?.showEventBanner && <EventBonusBanner amount={credit.eventAmount} count={credit.eventCount} total={credit.eventTotal} />}
      {!!titleChanges && (
        <Link
          href={`/workspace/${membership.company_id}/admin/spending`}
          className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-900 hover:bg-brand-100"
        >
          <span className="break-keep">세무사무소가 최근 7일 동안 계정과목을 {titleChanges}건 바꿨어요.</span>
          <span className="shrink-0 font-semibold">이력 보기 →</span>
        </Link>
      )}
      <AdminHomeView
      adminName={membership.name}
      companyName={company.name}
      inviteCode={company.invite_code}
      dashboard={dashboard}
      creditsLeft={company.receipt_credits_granted - company.receipt_credits_used}
      creditsGranted={company.receipt_credits_granted}
      policyToConfirm={company.policy_confirmed_at ? null : describePolicy(company)}
      basePath={`/workspace/${membership.company_id}/admin`}
      notices={<NoticeStrip notices={notices} />}
      />
    </>
  );
}
