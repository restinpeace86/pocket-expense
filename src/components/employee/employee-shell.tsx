"use client";

import { Home, UserRound, Wallet, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { WorkspaceHeader } from "@/components/workspace/workspace-header";
import type { Membership } from "@/lib/auth/paths";
import type { ThemeKey } from "@/lib/theme";

// 직원 워크스페이스 레이아웃 (worker-dashboard.md §5, D-067 모바일 우선)
// 휴대폰 폭 기준 가운데 정렬, 하단 메뉴는 엄지가 닿는 아래에 고정. 소명서 편집 화면에서는 하단 메뉴를 숨긴다(편집 화면 자체의 하단 버튼을 쓰기 때문).
type Tab = { href: string; label: string; icon: LucideIcon; ready: boolean };
const TABS: Tab[] = [
  { href: "", label: "홈", icon: Home, ready: true },
  { href: "/timeline", label: "정산", icon: Wallet, ready: false },
  { href: "/me", label: "내 정보", icon: UserRound, ready: false },
];

export const BOTTOM_NAV_HEIGHT = "4rem";

export function EmployeeShell({
  membership,
  children,
  theme,
  previewPath,
}: {
  membership: Membership;
  children: ReactNode;
  theme?: ThemeKey;
  previewPath?: string;
}) {
  const base = `/workspace/${membership.company_id}/employee`;
  const realPath = usePathname();
  const pathname = previewPath !== undefined ? `${base}${previewPath}` : realPath;
  const showNav = !pathname.startsWith(`${base}/claims/`);

  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-page" data-theme={theme}>
      <WorkspaceHeader membership={membership} mode="employee" />
      <div className={`flex flex-1 flex-col ${showNav ? "pb-[calc(4rem+env(safe-area-inset-bottom))]" : ""}`}>{children}</div>
      {showNav && (
        <nav
          aria-label="직원 메뉴"
          className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200 bg-white pb-[env(safe-area-inset-bottom)]"
        >
          <ul className="mx-auto grid h-16 max-w-md grid-cols-3">
            {TABS.map(({ href, label, icon: Icon, ready }) => {
              const to = `${base}${href}`;
              const active = href === "" ? pathname === base : pathname.startsWith(to);
              const cls = "flex h-full flex-col items-center justify-center gap-0.5 text-xs";
              return (
                <li key={label}>
                  {ready ? (
                    <Link href={to} aria-current={active ? "page" : undefined} className={`${cls} ${active ? "font-semibold text-brand-700" : "text-zinc-600"}`}>
                      <Icon className="size-6" />
                      {label}
                    </Link>
                  ) : (
                    <span className={`${cls} cursor-not-allowed text-zinc-400`} aria-disabled>
                      <Icon className="size-6" />
                      <span>
                        {label} <span className="text-[10px]">(준비 중)</span>
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
