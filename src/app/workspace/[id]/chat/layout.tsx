import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChatApp } from "@/components/chat/chat-app";
import { requireWorkspace } from "@/lib/auth/guards";
import { isAdminRole, workspaceHome } from "@/lib/auth/paths";
import { chatEnabled } from "@/lib/chat/server";

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
  const profileHref = isAdminRole(membership.role) ? `/workspace/${id}/admin/settings` : `/workspace/${id}/employee/profile`;
  return (
    <ChatApp membership={membership} homeHref={workspaceHome(membership)} profileHref={profileHref}>
      {children}
    </ChatApp>
  );
}
