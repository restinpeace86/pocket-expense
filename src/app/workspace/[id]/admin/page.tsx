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
import { currentMonthKst, todayKst } from "@/lib/dates";
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
  const [{ company }, credit, dashboard, notices, { count: titleChanges }, { count: openRequests }, { data: office }, { count: closedMonths }] = await Promise.all([
    getCompanySummary(membership.company_id),
    getCreditStatus(membership.company_id),
    getDashboard(currentMonthKst()),
    getRecentNotices(),
    // 세무사무소가 최근 7일 안에 계정과목을 바꿨으면 알림(D-152)
    supabase.from("account_title_changes").select("id", { count: "exact", head: true }).gte("created_at", weekAgo),
    // 세무사무소 확인 요청: 안 읽은 것 또는 답할 차례(D-169 → D-196)
    supabase.from("tax_office_requests").select("id", { count: "exact", head: true }).or("unread_for.eq.company,and(origin.eq.office,status.eq.open)"),
    supabase.rpc("my_company_tax_office"),
    // 첫 세무 마감을 했는지(후기 요청 시점, D-201)
    supabase.from("monthly_closings").select("company_id", { count: "exact", head: true }).eq("status", "closed"),
  ]);
  // 후기 요청(D-201): 첫 마감을 마쳤거나 무료 기간이 3일 안으로 남았을 때, 아직 후기를 안 남긴 회사만
  const trialSoon = !!credit?.trialEndsOn && Date.parse(credit.trialEndsOn) - Date.parse(todayKst()) <= 3 * 86400000;
  // 무료 종료일이 없는 회사 = 예외 회사(우리 회사, D-202) → 기간 끝 없음·후기 요청 안 함(자기 후기 방지)
  const askReview = !!credit?.trialEndsOn && !credit.surveyDone && ((closedMonths ?? 0) > 0 || trialSoon);
  const officeInfo = office as { registered?: boolean; registered_name?: string | null } | null;
  if (!company || !dashboard) return null;
  return (
    <>
      {/* 이벤트 추가 지급 뒤 처음 접속하면 상단 배너 (pricing-policy.md §5) */}
      {credit?.showEventBanner && <EventBonusBanner amount={credit.eventAmount} count={credit.eventCount} total={credit.eventTotal} />}
      {askReview && (
        <Link
          href={`/workspace/${membership.company_id}/admin/billing`}
          className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900 hover:bg-rose-100"
        >
          <span className="break-keep">
            {(closedMonths ?? 0) > 0 ? "첫 월말 마감을 마쳤어요!" : "무료 기간이 곧 끝나요."} 1분 후기를 남기면 첫 결제 50% 할인 쿠폰을 드려요.
          </span>
          <span className="shrink-0 font-semibold">후기 남기기 →</span>
        </Link>
      )}
      {!!openRequests && (
        <Link
          href={`/workspace/${membership.company_id}/admin/export#tax-requests`}
          className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 hover:bg-amber-100"
        >
          <span className="break-keep">세무사무소 확인 요청 {openRequests}건 — 새 답변이 왔거나 답할 차례예요.</span>
          <span className="shrink-0 font-semibold">보러 가기 →</span>
        </Link>
      )}
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
      trialEndsOn={credit?.trialEndsOn ?? null}
      policyToConfirm={company.policy_confirmed_at ? null : describePolicy(company)}
      basePath={`/workspace/${membership.company_id}/admin`}
      titlesManagedBy={officeInfo?.registered ? (officeInfo.registered_name ?? "세무사무소") : null}
      notices={<NoticeStrip notices={notices} />}
      />
    </>
  );
}
