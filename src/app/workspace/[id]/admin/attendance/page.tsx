import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { AttendanceApprovals } from "@/components/admin/attendance-approvals";
import { AttendanceApprovalGuide } from "@/components/admin/attendance-guide";
import { AttendanceTabs, AttendanceToday } from "@/components/admin/attendance-today";
import { SectionHeading } from "@/components/ui/help";
import { addDays } from "@/lib/attendance/leave";
import { attendanceEnabled, attendancePendingCount, getAttendanceAdminView, getAttendanceRequestsAdmin, getLeavesAdmin } from "@/lib/attendance/server";
import type { DayAdminData } from "@/lib/attendance/today";
import { requireWorkspace } from "@/lib/auth/guards";
import { todayKst } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "근태 · Moa-on" };

// [근태](D-242): 오늘 출근 · 승인 대기 · 처리 끝(D-239·D-241 승인 포함). 탭 없이 들어오면 처리할 승인이 있으면 승인 대기, 없으면 오늘 출근
export default function AttendanceAdminPage({ params, searchParams }: PageProps<"/workspace/[id]/admin/attendance">) {
  return (
    <>
      <SectionHeading
        as="h1"
        title="근태"
        summary="오늘 누가 출근했는지 보고, 정정 신청·휴일 근무 상신·휴가 신청을 승인하거나 반려해요. 원래 기록은 지워지지 않아요."
        helpId="admin.attendance-approvals"
        helpLabel="승인하면 이렇게 돼요 (예시 화면)"
        help={<AttendanceApprovalGuide />}
      />
      <Suspense fallback={<div className="mt-6 h-64 animate-pulse rounded-xl bg-zinc-100" />}>
        <Content params={params} searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Content({ params, searchParams }: Pick<PageProps<"/workspace/[id]/admin/attendance">, "params" | "searchParams">) {
  const { id } = await params;
  const sp = await searchParams;
  await requireWorkspace(id, { admin: true });
  if (!(await attendanceEnabled())) notFound();
  const tab = sp.tab === "today" || sp.tab === "pending" || sp.tab === "done" ? sp.tab : null;
  if (!tab) {
    const canDecide = (await attendancePendingCount()) ?? 0;
    redirect(`/workspace/${id}/admin/attendance?tab=${canDecide > 0 ? "pending" : "today"}`);
  }
  const settingsHref = `/workspace/${id}/admin/attendance-settings`;

  if (tab === "today") {
    const today = todayKst();
    const asked = typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : today;
    const date = asked < addDays(today, -92) || asked > addDays(today, 31) ? today : asked;
    const supabase = await createClient();
    const [{ data, error }, req, leaves] = await Promise.all([supabase.rpc("attendance_day_admin", { p_date: date }), getAttendanceRequestsAdmin(), getLeavesAdmin()]);
    if (error || !data) throw new Error(error?.message ?? "attendance_day_admin");
    return (
      <div className="flex flex-col gap-4">
        <AttendanceTabs active="today" pending={req.pending.length + leaves.pending.length} settingsHref={settingsHref} />
        <AttendanceToday data={data as unknown as DayAdminData} memberHref={`/workspace/${id}/admin/attendance/member`} />
      </div>
    );
  }

  const [data, leaves, settings] = await Promise.all([getAttendanceRequestsAdmin(), getLeavesAdmin(), getAttendanceAdminView()]);
  return (
    <div className="flex flex-col gap-4">
      <AttendanceTabs active={tab} pending={data.pending.length + leaves.pending.length} settingsHref={settingsHref} />
      <AttendanceApprovals tab={tab} pending={data.pending} done={data.done} leavesPending={leaves.pending} leavesDone={leaves.done} dailyHours={settings.settings.daily_hours} />
    </div>
  );
}
