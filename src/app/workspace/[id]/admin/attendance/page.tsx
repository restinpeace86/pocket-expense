import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AttendanceApprovals } from "@/components/admin/attendance-approvals";
import { AttendanceApprovalGuide } from "@/components/admin/attendance-guide";
import { SectionHeading } from "@/components/ui/help";
import { attendanceEnabled, getAttendanceAdminView, getAttendanceRequestsAdmin, getLeavesAdmin } from "@/lib/attendance/server";
import { requireWorkspace } from "@/lib/auth/guards";

export const metadata = { title: "근태 승인 · WORKON" };

// 근태 승인(D-239, spec/features/attendance.md §6-3): 정정 신청 · 휴일 근무 상신을 승인 · 반려. 근태 꺼진 회사는 404
export default function AttendanceApprovalsPage({ params }: PageProps<"/workspace/[id]/admin/attendance">) {
  return (
    <>
      <SectionHeading
        as="h1"
        title="근태 승인"
        summary="직원의 정정 신청·휴일 근무 상신·휴가 신청을 승인하거나 반려해요. 원래 기록은 지워지지 않아요."
        helpId="admin.attendance-approvals"
        helpLabel="승인하면 이렇게 돼요 (예시 화면)"
        help={<AttendanceApprovalGuide />}
      />
      <Suspense fallback={<div className="mt-6 h-64 animate-pulse rounded-xl bg-zinc-100" />}>
        <Content params={params} />
      </Suspense>
    </>
  );
}

async function Content({ params }: { params: PageProps<"/workspace/[id]/admin/attendance">["params"] }) {
  const { id } = await params;
  await requireWorkspace(id, { admin: true });
  if (!(await attendanceEnabled())) notFound();
  const [data, leaves, settings] = await Promise.all([getAttendanceRequestsAdmin(), getLeavesAdmin(), getAttendanceAdminView()]);
  return (
    <AttendanceApprovals
      settingsHref={`/workspace/${id}/admin/attendance-settings`}
      pending={data.pending}
      done={data.done}
      leavesPending={leaves.pending}
      leavesDone={leaves.done}
      dailyHours={settings.settings.daily_hours}
    />
  );
}
