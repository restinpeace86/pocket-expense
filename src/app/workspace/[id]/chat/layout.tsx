import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChatApp } from "@/components/chat/chat-app";
import { requireWorkspace } from "@/lib/auth/guards";
import { isAdminRole, workspaceHome } from "@/lib/auth/paths";
import { getInboxBadge } from "@/lib/claims/inbox";
import { chatEnabled, chatUnreadTotal } from "@/lib/chat/server";

export const metadata = { title: "채팅 · PocketExpense" };

// 사내 메신저(D-203, spec/features/messenger.md): 같은 회사 승인 멤버만. 회사 스위치가 꺼져 있으면 주소도 404
export default function ChatLayout({ children, params }: LayoutProps<"/workspace/[id]/chat">) {
  return (
    <Suspense fallback={<div className="m-4 h-64 flex-1 animate-pulse rounded-xl bg-zinc-100" />}>
      <Guarded params={params}>{children}</Guarded>
    </Suspense>
  );
}

async function Guarded({ params, children }: { params: LayoutProps<"/workspace/[id]/chat">["params"]; children: React.ReactNode }) {
  const { id } = await params;
  const membership = await requireWorkspace(id);
  if (!(await chatEnabled())) notFound();
  const admin = isAdminRole(membership.role);
  const profileHref = admin ? `/workspace/${id}/admin/settings` : `/workspace/${id}/employee/profile`;
  // 직원은 채팅 목록에서도 하단 메뉴(홈·정산·결재함·채팅·내 정보)를 그대로
  const employeeNav = admin ? null : await Promise.all([getInboxBadge(membership), chatUnreadTotal()]).then(([inbox, chat]) => ({ inbox, chat }));
  return (
    <ChatApp membership={membership} homeHref={workspaceHome(membership)} profileHref={profileHref} employeeNav={employeeNav}>
      {children}
    </ChatApp>
  );
}
