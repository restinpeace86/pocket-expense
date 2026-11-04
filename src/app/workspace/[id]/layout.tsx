import { Suspense } from "react";
import { EmployeeBottomNav } from "@/components/employee/employee-bottom-nav";
import { getMembership } from "@/lib/auth/session";
import { viewMode } from "@/lib/auth/view-mode";
import { getInboxBadge } from "@/lib/claims/inbox";
import { calendarEnabled } from "@/lib/calendar/server";
import { chatUnreadTotal } from "@/lib/chat/server";

// 워크스페이스 공통: 직원 하단 메뉴(홈·정산·결재함·채팅·내 정보)를 화면 틀 밖 여기 한 곳에 둔다(D-207).
// 홈·정산·내 정보와 채팅은 서로 다른 화면 틀이라, 틀마다 메뉴를 따로 그리면 채팅으로 갈 때 메뉴가 지워졌다 다시 그려져 깜빡였다.
// 로그인·소속 확인은 각 화면 틀(requireWorkspace)이 한다 — 여기서는 맞는 회사의 승인 멤버일 때만 메뉴를 그린다
export default function WorkspaceLayout({ children, params }: LayoutProps<"/workspace/[id]">) {
  return (
    <>
      {children}
      <Suspense fallback={null}>
        <NavSlot params={params} />
      </Suspense>
    </>
  );
}

async function NavSlot({ params }: { params: LayoutProps<"/workspace/[id]">["params"] }) {
  const { id } = await params;
  const membership = await getMembership();
  if (!membership || membership.status !== "approved" || membership.company_id !== id) return null;
  const [serverMode, inbox, chat, calendar] = await Promise.all([viewMode(membership), getInboxBadge(membership), chatUnreadTotal(), calendarEnabled()]);
  return <EmployeeBottomNav membership={membership} serverMode={serverMode} inbox={inbox} chat={chat} calendar={calendar} />;
}
