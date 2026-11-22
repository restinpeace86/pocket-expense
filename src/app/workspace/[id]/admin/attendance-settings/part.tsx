import { AttendanceAdmin } from "@/components/admin/attendance-admin";
import { getAttendanceAdminView, getLeaveAdmin } from "@/lib/attendance/server";
import { todayKst } from "@/lib/dates";
import { requireWorkspace } from "@/lib/auth/guards";

// 근태 정책 탭(D-251) 공통 본문
export async function AttendancePart({ params, part }: { params: Promise<{ id: string }>; part: "rules" | "terminals" | "history" }) {
  const { id } = await params;
  await requireWorkspace(id, { admin: true });
  const view = await getAttendanceAdminView();
  // 근무 기준: 연차 기준·5인 미만을 바꾸면 추천 연차가 달라지는 직원 수(D-304 B-3)
  const leave = part === "rules" && view.enabled ? await getLeaveAdmin(Number(todayKst().slice(0, 4))).catch(() => null) : null;
  return <AttendanceAdmin view={view} part={part} featuresHref={`/workspace/${id}/admin/features`} leave={leave} />;
}
