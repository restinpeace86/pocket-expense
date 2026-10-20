import { Suspense } from "react";
import { EmployeeShell } from "@/components/employee/employee-shell";
import { requireWorkspace } from "@/lib/auth/guards";
import { getInboxBadge } from "@/lib/claims/inbox";

// 결재함·결재 화면 (approver.md) — 직원 화면과 같은 틀(모바일 우선, 하단 메뉴)
export default function ApprovalsLayout({ children, params }: LayoutProps<"/workspace/[id]/approvals">) {
  return (
    <Suspense fallback={<div className="m-4 h-64 flex-1 animate-pulse rounded-xl bg-zinc-100" />}>
      <Guarded params={params}>{children}</Guarded>
    </Suspense>
  );
}

async function Guarded({ params, children }: { params: LayoutProps<"/workspace/[id]/approvals">["params"]; children: React.ReactNode }) {
  const { id } = await params;
  const membership = await requireWorkspace(id);
  const inbox = await getInboxBadge(membership);
  return (
    <EmployeeShell membership={membership} inbox={inbox}>
      {children}
    </EmployeeShell>
  );
}
