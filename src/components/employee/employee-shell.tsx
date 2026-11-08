"use client";

import { CalendarDays, Home, Loader2, MessageCircle, Plus, UserRound, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { createDraftClaimAction } from "@/app/workspace/[id]/employee/actions";
import { guardAction } from "@/lib/action-guard";
import { measureAction } from "@/lib/perf/client";
import { navVisibility } from "./nav-visibility";
import { useChatUnread } from "@/components/chat/use-chat-unread";
import { WorkspaceHeader } from "@/components/workspace/workspace-header";
import type { Membership } from "@/lib/auth/paths";
import type { ThemeKey } from "@/lib/theme";

// 직원 워크스페이스 레이아웃 (worker-dashboard.md §5, D-067 모바일 우선)
// 휴대폰 폭 기준 가운데 정렬, 하단 메뉴는 엄지가 닿는 아래에 고정.
// 결의서 편집·상세, 결재 화면에서는 하단 메뉴를 숨긴다(그 화면의 하단 버튼을 쓰기 때문).
type Tab = { href: string; label: string; icon: LucideIcon; ready: boolean; badge?: number };

export function EmployeeShell({
  membership,
  children,
  theme,
  previewPath,
  chat,
}: {
  membership: Membership;
  children: ReactNode;
  theme?: ThemeKey;
  previewPath?: string; // 미리보기 전용: 워크스페이스 기준 경로(예: "/employee", "/approvals")
  chat?: number | null; // 채팅 탭: 회사 메신저 스위치가 켜졌을 때만, 안 읽은 메시지 수(D-203)
}) {
  const ws = `/workspace/${membership.company_id}`;
  const realPath = usePathname();
  const preview = previewPath !== undefined;
  // 실제 화면의 하단 메뉴는 워크스페이스 공통 레이아웃의 EmployeeBottomNav 하나(D-207, 깜빡임 방지). 여기서는 미리보기에서만 그린다
  const chatUnread = useChatUnread(preview ? chat : null, membership.member_id);
  const pathname = preview ? `${ws}${previewPath}` : realPath;
  const showNav = navVisibility(pathname, ws) !== "none";

  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-page" data-theme={theme}>
      <WorkspaceHeader membership={membership} mode="employee" />
      <div className={`flex flex-1 flex-col ${showNav ? "pb-[calc(4rem+env(safe-area-inset-bottom))]" : ""}`}>{children}</div>
      {preview && showNav && <EmployeeTabBar ws={ws} pathname={pathname} chatUnread={chatUnread} fixed />}
    </div>
  );
}

// 직원 하단 메뉴(worker-dashboard.md §5, D-235): 홈 · 캘린더 · [+ 결의서 쓰기] · 채팅 · 내 정보
// 캘린더·채팅은 회사 스위치가 켜졌을 때만. 정산·결재함은 홈 메뉴 칸으로 옮겼다
export function EmployeeTabBar({
  ws,
  pathname,
  chatUnread,
  calendar = false,
  fixed = false,
}: {
  ws: string;
  pathname: string;
  chatUnread?: number | null;
  calendar?: boolean; // [캘린더] 탭(D-209): 회사 캘린더 스위치가 켜졌을 때만
  fixed?: boolean;
}) {
  const left: Tab[] = [
    { href: `${ws}/employee`, label: "홈", icon: Home, ready: true },
    ...(calendar ? [{ href: `${ws}/calendar`, label: "캘린더", icon: CalendarDays, ready: true }] : []),
  ];
  const right: Tab[] = [
    ...(chatUnread !== null && chatUnread !== undefined ? [{ href: `${ws}/chat`, label: "채팅", icon: MessageCircle, ready: true, badge: chatUnread }] : []),
    { href: `${ws}/employee/profile`, label: "내 정보", icon: UserRound, ready: true },
  ];
  const cols = left.length + right.length + 1;
  const tab = ({ href, label, icon: Icon, badge }: Tab) => {
    const active = href === `${ws}/employee` ? pathname === href : pathname.startsWith(href);
    return (
      <li key={label}>
        <Link href={href} aria-current={active ? "page" : undefined} className={`relative flex h-full flex-col items-center justify-center gap-0.5 text-xs ${active ? "font-semibold text-brand-700" : "text-zinc-600"}`}>
          <Icon className="size-6" />
          {label}
          {!!badge && <span className="absolute right-[calc(50%-1.5rem)] top-1.5 min-w-5 rounded-full bg-red-600 px-1 text-center text-[11px] font-semibold leading-5 text-white">{badge > 99 ? "99+" : badge}</span>}
        </Link>
      </li>
    );
  };
  return (
    <nav aria-label="직원 메뉴" className={`kb-hide ${fixed ? "fixed inset-x-0 bottom-0 z-30" : "shrink-0"} border-t border-zinc-200 bg-white pb-[env(safe-area-inset-bottom)]`}>
      <ul className="mx-auto grid h-16 max-w-md" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {left.map(tab)}
        <li>
          <NewClaimButton />
        </li>
        {right.map(tab)}
      </ul>
    </nav>
  );
}

// 가운데 큰 [+ 결의서 쓰기]: 어느 화면에서든 새 결의서를 만들고 바로 촬영/선택 시트로(worker-dashboard.md §3)
function NewClaimButton() {
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const create = () =>
    start(async () => {
      setError(null);
      const res = await guardAction(() => measureAction("employee.create_claim", () => createDraftClaimAction()));
      if (res && "error" in res) setError(res.error);
    });
  return (
    <div className="relative flex h-full flex-col items-center justify-end pb-1.5">
      {error && (
        <p role="alert" className="absolute bottom-[calc(100%+2.5rem)] left-1/2 w-[min(20rem,calc(100vw-2rem))] -translate-x-1/2 rounded-xl bg-zinc-900 px-3 py-2 text-center text-sm text-white shadow-lg" onClick={() => setError(null)}>
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={create}
        disabled={busy}
        aria-label="결의서 쓰기"
        className="absolute -top-5 inline-flex size-14 items-center justify-center rounded-full border-4 border-white bg-brand-600 text-white shadow-[0_4px_12px_rgba(79,70,229,0.35)] hover:bg-brand-700 disabled:opacity-80"
      >
        {busy ? <Loader2 className="size-6 animate-spin" /> : <Plus className="size-7" strokeWidth={2.2} />}
      </button>
      <span aria-hidden className="text-xs font-semibold text-brand-700">
        결의서 쓰기
      </span>
    </div>
  );
}
