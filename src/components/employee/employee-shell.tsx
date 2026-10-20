"use client";

import { Home, Inbox, UserRound, Wallet, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { WorkspaceHeader } from "@/components/workspace/workspace-header";
import type { Membership } from "@/lib/auth/paths";
import type { ThemeKey } from "@/lib/theme";

// 직원 워크스페이스 레이아웃 (worker-dashboard.md §5, D-067 모바일 우선)
// 휴대폰 폭 기준 가운데 정렬, 하단 메뉴는 엄지가 닿는 아래에 고정.
// 소명서 편집·상세, 결재 화면에서는 하단 메뉴를 숨긴다(그 화면의 하단 버튼을 쓰기 때문).
type Tab = { href: string; label: string; icon: LucideIcon; ready: boolean; badge?: number };

export function EmployeeShell({
  membership,
  children,
  theme,
  previewPath,
  inbox,
}: {
  membership: Membership;
  children: ReactNode;
  theme?: ThemeKey;
  previewPath?: string; // 미리보기 전용: 워크스페이스 기준 경로(예: "/employee", "/approvals")
  inbox?: { waiting: number } | null; // 결재함 탭: 사전 검토자·관리자 이상일 때만 (worker-dashboard.md §5)
}) {
  const ws = `/workspace/${membership.company_id}`;
  const realPath = usePathname();
  const pathname = previewPath !== undefined ? `${ws}${previewPath}` : realPath;
  const tabs: Tab[] = [
    { href: `${ws}/employee`, label: "홈", icon: Home, ready: true },
    { href: `${ws}/employee/settlements`, label: "정산", icon: Wallet, ready: false },
    ...(inbox ? [{ href: `${ws}/approvals`, label: "결재함", icon: Inbox, ready: true, badge: inbox.waiting }] : []),
    { href: `${ws}/employee/me`, label: "내 정보", icon: UserRound, ready: false },
  ];
  const showNav = !pathname.includes("/employee/claims/") && !/\/approvals\/[^/]+/.test(pathname);

  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-page" data-theme={theme}>
      <WorkspaceHeader membership={membership} mode="employee" />
      <div className={`flex flex-1 flex-col ${showNav ? "pb-[calc(4rem+env(safe-area-inset-bottom))]" : ""}`}>{children}</div>
      {showNav && (
        <nav aria-label="직원 메뉴" className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200 bg-white pb-[env(safe-area-inset-bottom)]">
          <ul className="mx-auto grid h-16 max-w-md" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
            {tabs.map(({ href, label, icon: Icon, ready, badge }) => {
              const active = href === `${ws}/employee` ? pathname === href : pathname.startsWith(href);
              const cls = "relative flex h-full flex-col items-center justify-center gap-0.5 text-xs";
              return (
                <li key={label}>
                  {ready ? (
                    <Link href={href} aria-current={active ? "page" : undefined} className={`${cls} ${active ? "font-semibold text-brand-700" : "text-zinc-600"}`}>
                      <Icon className="size-6" />
                      {label}
                      {!!badge && <span className="absolute right-[calc(50%-1.5rem)] top-1.5 min-w-5 rounded-full bg-red-600 px-1 text-center text-[10px] font-semibold leading-5 text-white">{badge > 99 ? "99+" : badge}</span>}
                    </Link>
                  ) : (
                    <span className={`${cls} cursor-not-allowed text-zinc-400`} aria-disabled>
                      <Icon className="size-6" />
                      <span className="text-center leading-tight">
                        {label}
                        <span className="block text-[10px]">(준비 중)</span>
                      </span>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </div>
  );
}
