"use client";

import { Banknote, FileDown, LayoutDashboard, Menu, ReceiptText, Settings, Users, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { WorkspaceHeader } from "@/components/workspace/workspace-header";
import type { Membership } from "@/lib/auth/paths";

// 관리자 워크스페이스 레이아웃 (spec/screens/admin-dashboard.md 0): PC는 좌측 사이드바, 모바일은 햄버거 메뉴
const NAV = [
  { href: "", label: "홈", icon: LayoutDashboard, ready: true },
  { href: "/claims", label: "지출 승인 관리", icon: ReceiptText, ready: false },
  { href: "/payouts", label: "정산 지급 관리", icon: Banknote, ready: false },
  { href: "/members", label: "멤버 관리", icon: Users, ready: true },
  { href: "/export", label: "세무 마감", icon: FileDown, ready: false },
  { href: "/settings", label: "설정", icon: Settings, ready: false },
];

function NavList({ base, onNavigate }: { base: string; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1 p-3" aria-label="관리자 메뉴">
      {NAV.map(({ href, label, icon: Icon, ready }) => {
        const to = `${base}${href}`;
        const active = href === "" ? pathname === base : pathname.startsWith(to);
        const cls = "flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm";
        if (!ready) {
          return (
            <span key={label} className={`${cls} cursor-not-allowed text-zinc-400`} aria-disabled>
              <Icon className="size-5 shrink-0" />
              <span className="flex-1">{label}</span>
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-500">준비 중</span>
            </span>
          );
        }
        return (
          <Link
            key={label}
            href={to}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={`${cls} ${active ? "bg-blue-50 font-semibold text-blue-700" : "text-zinc-700 hover:bg-zinc-100"}`}
          >
            <Icon className="size-5 shrink-0" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AdminShell({ membership, children }: { membership: Membership; children: ReactNode }) {
  const base = `/workspace/${membership.company_id}/admin`;
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-dvh flex-1">
      <aside className="hidden w-60 shrink-0 border-r border-zinc-200 bg-white md:block">
        <p className="px-6 pb-2 pt-5 text-lg font-bold">PocketExpense</p>
        <NavList base={base} />
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal aria-label="관리자 메뉴">
          <button type="button" className="absolute inset-0 bg-black/40" aria-label="메뉴 닫기" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-lg font-bold">PocketExpense</span>
              <button type="button" onClick={() => setOpen(false)} aria-label="메뉴 닫기" className="inline-flex size-11 items-center justify-center rounded-xl hover:bg-zinc-100">
                <X className="size-5" />
              </button>
            </div>
            <NavList base={base} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center border-b border-zinc-200 bg-white">
          <button type="button" onClick={() => setOpen(true)} aria-label="메뉴 열기" className="ml-2 inline-flex size-11 shrink-0 items-center justify-center rounded-xl hover:bg-zinc-100 md:hidden">
            <Menu className="size-5" />
          </button>
          <div className="min-w-0 flex-1 [&>header]:border-b-0">
            <WorkspaceHeader membership={membership} mode="admin" />
          </div>
        </div>
        <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-4 py-6 md:px-8">{children}</main>
      </div>
    </div>
  );
}
