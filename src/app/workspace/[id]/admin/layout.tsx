import { Suspense } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { requireWorkspace } from "@/lib/auth/guards";
import { attendancePendingCount } from "@/lib/attendance/server";
import { calendarEnabled } from "@/lib/calendar/server";
import { chatUnreadTotal } from "@/lib/chat/server";
import { adminDocsBadge } from "@/lib/approval-docs/server";
import { getSetupState, setupBarOn } from "@/lib/admin/setup-wizard-server";

// 관리자 워크스페이스 공통 레이아웃. 세션 읽기는 Suspense 안에서 (cacheComponents 규칙)
export default function AdminLayout({ children, params }: LayoutProps<"/workspace/[id]/admin">) {
  return (
    <Suspense fallback={<div className="m-4 h-64 flex-1 animate-pulse rounded-xl bg-zinc-100" />}>
      <Guarded params={params}>{children}</Guarded>
    </Suspense>
  );
}

async function Guarded({ params, children }: { params: LayoutProps<"/workspace/[id]/admin">["params"]; children: React.ReactNode }) {
  const { id } = await params;
  const membership = await requireWorkspace(id, { admin: true });
  const [chat, calendar, attendance, docs, setupState, setupOn] = await Promise.all([chatUnreadTotal(), calendarEnabled(), attendancePendingCount(), adminDocsBadge(membership.member_id), getSetupState(), setupBarOn()]);
  // 최초 1회 설정 진행 띠·메뉴 표시(D-300)
  const setup = { state: setupState, attendanceOn: attendance !== null, on: setupOn };
  return (
    <AdminShell membership={membership} chat={chat} calendar={calendar} attendance={attendance} docs={docs} setup={setup}>
      {children}
    </AdminShell>
  );
}
