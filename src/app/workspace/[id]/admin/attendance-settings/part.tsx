import { AttendanceAdmin } from "@/components/admin/attendance-admin";
import { getAttendanceAdminView } from "@/lib/attendance/server";
import { requireWorkspace } from "@/lib/auth/guards";

// 근태 정책 탭(D-251) 공통 본문
export async function AttendancePart({ params, part }: { params: Promise<{ id: string }>; part: "rules" | "terminals" | "history" }) {
  const { id } = await params;
  await requireWorkspace(id, { admin: true });
  const view = await getAttendanceAdminView();
  return <AttendanceAdmin view={view} part={part} featuresHref={`/workspace/${id}/admin/features`} />;
}
