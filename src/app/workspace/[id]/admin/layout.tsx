import { Suspense } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { requireWorkspace } from "@/lib/auth/guards";
import { calendarEnabled } from "@/lib/calendar/server";
import { chatUnreadTotal } from "@/lib/chat/server";

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
  const [chat, calendar] = await Promise.all([chatUnreadTotal(), calendarEnabled()]);
  return (
    <AdminShell membership={membership} chat={chat} calendar={calendar}>
      {children}
    </AdminShell>
  );
}
