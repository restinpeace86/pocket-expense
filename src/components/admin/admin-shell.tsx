"use client";

import {
  Banknote,
  Bell,
  BookOpen,
  Building2,
  ChevronDown,
  CreditCard,
  FileDown,
  FileText,
  LayoutDashboard,
  Menu,
  ReceiptText,
  Route,
  Settings,
  SlidersHorizontal,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { WorkspaceHeader } from "@/components/workspace/workspace-header";
import type { Membership } from "@/lib/auth/paths";

// 관리자 워크스페이스 레이아웃 (spec/screens/admin-dashboard.md 0): PC는 좌측 사이드바, 모바일은 햄버거 메뉴
// 설정은 하단 배치 + 하위 메뉴 (admin-settings.md §4)
type NavItem = { href: string; label: string; icon: LucideIcon; ready: boolean };
const NAV: NavItem[] = [
  { href: "", label: "홈", icon: LayoutDashboard, ready: true },
  { href: "/claims", label: "지출 승인 관리", icon: ReceiptText, ready: false },
  { href: "/payouts", label: "정산 지급 관리", icon: Banknote, ready: false },
  { href: "/members", label: "멤버 관리", icon: Users, ready: true },
  { href: "/export", label: "세무 마감", icon: FileDown, ready: false },
];
const SETTINGS_NAV: NavItem[] = [
  { href: "/settings", label: "지출 한도·정책", icon: SlidersHorizontal, ready: false },
  { href: "/corporate-cards", label: "법인카드", icon: CreditCard, ready: false },
  { href: "/form-template", label: "사내 양식", icon: FileText, ready: false },
  { href: "/departments", label: "부서", icon: Building2, ready: true },
  { href: "/approval-lines", label: "사전 검토 결재라인", icon: Route, ready: false },
  { href: "/account-titles", label: "계정과목", icon: BookOpen, ready: false },
  { href: "/billing", label: "요금제", icon: Wallet, ready: false },
  { href: "/notifications", label: "알림 이력", icon: Bell, ready: false },
];

function NavLink({ item, base, pathname, onNavigate }: { item: NavItem; base: string; pathname: string; onNavigate?: () => void }) {
  const { href, label, icon: Icon, ready } = item;
  const to = `${base}${href}`;
  const active = href === "" ? pathname === base : pathname.startsWith(to);
  const cls = "flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm";
  if (!ready) {
    return (
      <span className={`${cls} cursor-not-allowed text-zinc-400`} aria-disabled>
        <Icon className="size-5 shrink-0" />
        <span className="flex-1">{label}</span>
        <span className="whitespace-nowrap rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-500">준비 중</span>
      </span>
    );
  }
  return (
    <Link
      href={to}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={`${cls} ${active ? "bg-blue-50 font-semibold text-blue-700" : "text-zinc-700 hover:bg-zinc-100"}`}
    >
      <Icon className="size-5 shrink-0" />
      {label}
    </Link>
  );
}

function NavList({ base, onNavigate }: { base: string; onNavigate?: () => void }) {
  const pathname = usePathname();
  const settingsActive = SETTINGS_NAV.some((i) => pathname.startsWith(`${base}${i.href}`));
  return (
    <nav className="flex flex-col gap-1 p-3" aria-label="관리자 메뉴">
      {NAV.map((item) => (
        <NavLink key={item.label} item={item} base={base} pathname={pathname} onNavigate={onNavigate} />
      ))}
      <details className="group mt-3 border-t border-zinc-100 pt-3" open={settingsActive || undefined}>
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 rounded-xl px-3 text-sm text-zinc-700 hover:bg-zinc-100 [&::-webkit-details-marker]:hidden">
          <Settings className="size-5 shrink-0" />
          <span className="flex-1">설정</span>
          <ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" />
        </summary>
        <div className="mt-1 flex flex-col gap-1 pl-3">
          {SETTINGS_NAV.map((item) => (
            <NavLink key={item.label} item={item} base={base} pathname={pathname} onNavigate={onNavigate} />
          ))}
        </div>
      </details>
    </nav>
  );
}

export function AdminShell({ membership, children }: { membership: Membership; children: ReactNode }) {
  const base = `/workspace/${membership.company_id}/admin`;
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-dvh flex-1">
      <aside className="hidden w-64 shrink-0 border-r border-zinc-200 bg-white md:block">
        <p className="px-6 pb-2 pt-5 text-lg font-bold">PocketExpense</p>
        <NavList base={base} />
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal aria-label="관리자 메뉴">
          <button type="button" className="absolute inset-0 bg-black/40" aria-label="메뉴 닫기" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col overflow-y-auto bg-white shadow-xl">
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
