import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChatApp } from "@/components/chat/chat-app";
import { requireWorkspace } from "@/lib/auth/guards";
import { viewMode } from "@/lib/auth/view-mode";
import { chatEnabled } from "@/lib/chat/server";

export const metadata = { title: "채팅 · WORKON" };

// 사내 메신저(D-203, spec/features/messenger.md): 같은 회사 승인 멤버만. 회사 스위치가 꺼져 있으면 주소도 404
export default function ChatLayout({ children, params }: LayoutProps<"/workspace/[id]/chat">) {
  return (
    <Suspense fallback={<div className="fixed inset-0 bg-white" />}>
      <Guarded params={params}>{children}</Guarded>
    </Suspense>
  );
}

async function Guarded({ params, children }: { params: LayoutProps<"/workspace/[id]/chat">["params"]; children: React.ReactNode }) {
  const { id } = await params;
  const membership = await requireWorkspace(id);
  if (!(await chatEnabled())) notFound();
  // 모드(관리자/직원)는 ChatApp이 브라우저에서 고른다(D-207), 여기는 처음 그릴 값. 직원 하단 메뉴는 워크스페이스 공통 레이아웃에
  const serverMode = await viewMode(membership);
  return (
    <ChatApp membership={membership} serverMode={serverMode}>
      {children}
    </ChatApp>
  );
}
