"use client";

import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { EmployeeShell } from "@/components/employee/employee-shell";
import { useViewMode } from "@/components/workspace/view-mode-mark";
import { isAdminRole, type Membership } from "@/lib/auth/paths";

// 캘린더 틀(D-206·D-207): 관리자 모드면 관리자 틀(왼쪽 메뉴), 직원·직원 모드면 직원 틀(하단 메뉴). 모드는 브라우저에서 고른다
export function CalendarShell({
  membership,
  serverMode,
  inbox,
  chat,
  children,
}: {
  membership: Membership;
  serverMode: "admin" | "employee";
  inbox: { waiting: number } | null;
  chat: number | null;
  children: ReactNode;
}) {
  const mode = useViewMode(membership.company_id, isAdminRole(membership.role), serverMode);
  return mode === "admin" ? (
    <AdminShell membership={membership} chat={chat} calendar>
      {children}
    </AdminShell>
  ) : (
    <EmployeeShell membership={membership} inbox={inbox} chat={chat}>
      {children}
    </EmployeeShell>
  );
}
