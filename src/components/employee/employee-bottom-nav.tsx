"use client";

import { usePathname } from "next/navigation";
import { useChatPopup } from "@/components/chat/popup";
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
  chat,
  calendar,
}: {
  membership: Membership;
  serverMode: "admin" | "employee";
  chat: number | null;
  calendar: boolean; // 캘린더 스위치(D-209: 직원은 하단 [캘린더] 탭으로 들어간다)
}) {
  const pathname = usePathname();
  const mode = useViewMode(membership.company_id, isAdminRole(membership.role), serverMode);
  const chatUnread = useChatUnread(chat, membership.member_id);
  const ws = `/workspace/${membership.company_id}`;
  const where = navVisibility(pathname, ws);
  // 채팅 새 창(PC, D-211)은 채팅만 — 하단 메뉴 없음
  const popup = useChatPopup();
  if (mode !== "employee" || where === "none" || popup) return null;
  return (
    <div className={where === "pc" ? "hidden md:block" : undefined}>
      <EmployeeTabBar ws={ws} pathname={pathname} chatUnread={chatUnread} calendar={calendar} fixed />
    </div>
  );
}
