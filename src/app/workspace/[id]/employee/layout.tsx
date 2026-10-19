import { Suspense } from "react";
import { EmployeeShell } from "@/components/employee/employee-shell";
import { requireWorkspace } from "@/lib/auth/guards";

// 직원 워크스페이스 공통 레이아웃. 세션 읽기는 Suspense 안에서 (cacheComponents 규칙)
export default function EmployeeLayout({ children, params }: LayoutProps<"/workspace/[id]/employee">) {
  return (
    <Suspense fallback={<div className="m-4 h-64 flex-1 animate-pulse rounded-xl bg-zinc-100" />}>
      <Guarded params={params}>{children}</Guarded>
    </Suspense>
  );
}

async function Guarded({ params, children }: { params: LayoutProps<"/workspace/[id]/employee">["params"]; children: React.ReactNode }) {
  const { id } = await params;
  const membership = await requireWorkspace(id);
  return <EmployeeShell membership={membership}>{children}</EmployeeShell>;
}
