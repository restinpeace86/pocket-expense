import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { EmployeeShell } from "@/components/employee/employee-shell";
import { requireWorkspace } from "@/lib/auth/guards";
import { viewMode } from "@/lib/auth/view-mode";
import { calendarEnabled } from "@/lib/calendar/server";
import { getInboxBadge } from "@/lib/claims/inbox";
import { chatUnreadTotal } from "@/lib/chat/server";

export const metadata = { title: "캘린더 · PocketExpense" };

// 사내 캘린더(D-206, spec/features/calendar.md): 직원·관리자 같은 화면. 관리자 모드면 관리자 틀(왼쪽 메뉴), 직원·직원 모드면 직원 틀(하단 메뉴)
// 회사 스위치가 꺼져 있으면 주소도 404
export default function CalendarLayout({ children, params }: LayoutProps<"/workspace/[id]/calendar">) {
  return (
    <Suspense fallback={<div className="m-4 h-64 flex-1 animate-pulse rounded-xl bg-zinc-100" />}>
      <Guarded params={params}>{children}</Guarded>
    </Suspense>
  );
}

async function Guarded({ params, children }: { params: LayoutProps<"/workspace/[id]/calendar">["params"]; children: React.ReactNode }) {
  const { id } = await params;
  const membership = await requireWorkspace(id);
  if (!(await calendarEnabled())) notFound();
  if ((await viewMode(membership)) === "admin") {
    const chat = await chatUnreadTotal();
    return (
      <AdminShell membership={membership} chat={chat} calendar>
        {children}
      </AdminShell>
    );
  }
  const [inbox, chat] = await Promise.all([getInboxBadge(membership), chatUnreadTotal()]);
  return (
    <EmployeeShell membership={membership} inbox={inbox} chat={chat}>
      {children}
    </EmployeeShell>
  );
}
