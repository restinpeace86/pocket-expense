import { Suspense } from "react";
import { ChatVisualAlert } from "@/components/chat/visual-alert";
import { EmployeeBottomNav } from "@/components/employee/employee-bottom-nav";
import { PushAutoPrompt } from "@/components/push/push-auto-prompt";
import { getMembership } from "@/lib/auth/session";
import { viewMode } from "@/lib/auth/view-mode";
import { attendanceEnabled } from "@/lib/attendance/server";
import { hasDocForms } from "@/lib/approval-docs/server";
import { calendarEnabled } from "@/lib/calendar/server";
import { chatUnreadTotal } from "@/lib/chat/server";
import { createClient } from "@/lib/supabase/server";
import { PUSH_PROMPT_KEY, promptAllowed } from "@/lib/push/prompt";

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
  const [serverMode, chat, calendar, attendance, docs, askPush] = await Promise.all([viewMode(membership), chatUnreadTotal(), calendarEnabled(), attendanceEnabled(), hasDocForms(), pushPromptFor(membership.member_id)]);
  return (
    <>
      <EmployeeBottomNav membership={membership} serverMode={serverMode} chat={chat} calendar={calendar} attendance={attendance} docs={docs} />
      {/* PC 무소음 시각 알림(D-246): 메신저가 켜진 회사, 관리자·직원 모두 */}
      {chat !== null && <ChatVisualAlert memberId={membership.member_id} companyId={membership.company_id} initialOn={membership.chat_visual_alert !== false} />}
      {/* 알림 기본 켜기 안내(D-213): 관리자·직원 모두 */}
      <PushAutoPrompt ask={askPush} />
    </>
  );
}

// 알림 안내를 띄울지 — 계정 기준(D-318): 알림 켠 기기·설치 앱이 없고, 계정에 적힌 '다음에 물을 날'이 지났을 때만
async function pushPromptFor(memberId: string): Promise<boolean> {
  const supabase = await createClient();
  const [{ count: web }, { count: app }, { data: u }] = await Promise.all([
    supabase.from("push_subscriptions").select("id", { count: "exact", head: true }).eq("member_id", memberId),
    supabase.from("push_app_tokens").select("id", { count: "exact", head: true }).eq("member_id", memberId),
    supabase.auth.getUser(),
  ]);
  return promptAllowed({ devices: (web ?? 0) + (app ?? 0), until: u.user?.user_metadata?.[PUSH_PROMPT_KEY], now: new Date() });
}
