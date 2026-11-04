"use client";

import { usePathname } from "next/navigation";
import { useChatUnread } from "@/components/chat/use-chat-unread";
import { useViewMode } from "@/components/workspace/view-mode-mark";
import { isAdminRole, type Membership } from "@/lib/auth/paths";
import { EmployeeTabBar } from "./employee-shell";
import { navVisibility } from "./nav-visibility";

// 직원 하단 메뉴 하나(워크스페이스 공통 레이아웃에 놓임, D-207) — 화면을 옮겨도 메뉴는 그대로라 깜빡이지 않는다.
// 어디서 보이는지는 nav-visibility.ts, 관리자 모드에서는 숨김
export function EmployeeBottomNav({
  membership,
  serverMode,
  inbox,
  chat,
}: {
  membership: Membership;
  serverMode: "admin" | "employee";
  inbox: { waiting: number } | null;
  chat: number | null;
}) {
  const pathname = usePathname();
  const mode = useViewMode(membership.company_id, isAdminRole(membership.role), serverMode);
  const chatUnread = useChatUnread(chat, membership.member_id);
  const ws = `/workspace/${membership.company_id}`;
  const where = navVisibility(pathname, ws);
  if (mode !== "employee" || where === "none") return null;
  return (
    <div className={where === "pc" ? "hidden md:block" : undefined}>
      <EmployeeTabBar ws={ws} pathname={pathname} inbox={inbox} chatUnread={chatUnread} fixed />
    </div>
  );
}
