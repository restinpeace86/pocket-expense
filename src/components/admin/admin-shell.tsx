"use client";

import {
  Banknote,
  Bell,
  BookOpen,
  Building2,
  ChevronDown,
  Car,
  Megaphone,
  Repeat,
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
import { ThemeOptionsInline } from "@/components/workspace/theme-switcher";
import type { ThemeKey } from "@/lib/theme";
import { WorkspaceHeader } from "@/components/workspace/workspace-header";
import type { Membership } from "@/lib/auth/paths";

// 관리자 워크스페이스 레이아웃 (spec/screens/admin-dashboard.md 0): PC는 좌측 사이드바, 모바일은 햄버거 메뉴
// 설정은 하단 배치 + 하위 메뉴 (admin-settings.md §4)
type NavItem = { href: string; label: string; icon: LucideIcon; ready: boolean };
const NAV: NavItem[] = [
  { href: "", label: "홈", icon: LayoutDashboard, ready: true },
  { href: "/claims", label: "지출 승인 관리", icon: ReceiptText, ready: true },
  { href: "/payouts", label: "정산 지급 관리", icon: Banknote, ready: true },
  { href: "/members", label: "멤버 관리", icon: Users, ready: true },
  { href: "/export", label: "세무 마감", icon: FileDown, ready: true },
];
const SETTINGS_NAV: NavItem[] = [
  { href: "/settings", label: "지출 한도·정책", icon: SlidersHorizontal, ready: true },
  { href: "/corporate-cards", label: "법인카드", icon: CreditCard, ready: true },
  { href: "/vehicles", label: "회사차량", icon: Car, ready: true },
  { href: "/recurring", label: "정기 결제", icon: Repeat, ready: true },
  { href: "/form-template", label: "사내 양식", icon: FileText, ready: false },
  { href: "/departments", label: "부서", icon: Building2, ready: true },
  { href: "/approval-lines", label: "사전 검토 결재라인", icon: Route, ready: true },
  { href: "/account-titles", label: "계정과목", icon: BookOpen, ready: true },
  { href: "/billing", label: "요금제", icon: Wallet, ready: true },
  { href: "/announcements", label: "사내 공지", icon: Megaphone, ready: true },
  { href: "/notifications", label: "알림 이력", icon: Bell, ready: true },
];

function NavLink({ item, base, pathname, onNavigate }: { item: NavItem; base: string; pathname: string; onNavigate?: () => void }) {
  const { href, label, icon: Icon, ready } = item;
  const to = `${base}${href}`;
  const active = href === "" ? pathname === base : pathname.startsWith(to);
  const cls = "flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm";
  if (!ready) {
    return (
      <span className={`${cls} cursor-not-allowed text-sidebar-muted`} aria-disabled>
        <Icon className="size-5 shrink-0" />
        <span className="flex-1">{label}</span>
        <span className="whitespace-nowrap rounded-full bg-sidebar-hover px-2 py-0.5 text-[11px] text-sidebar-muted">준비 중</span>
      </span>
    );
  }
  return (
    <Link
      href={to}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={`${cls} ${active ? "bg-sidebar-active font-semibold text-sidebar-active-fg" : "text-sidebar-fg hover:bg-sidebar-hover"}`}
    >
      <Icon className="size-5 shrink-0" />
      {label}
    </Link>
  );
}

// settingsOpen: 휴대폰 메뉴(서랍)에서는 설정 하위 메뉴를 펼친 채로 연다(개선사항 1-1) — 화면 이름이 바로 보이게
function NavList({ base, onNavigate, previewPath, settingsOpen = false }: { base: string; onNavigate?: () => void; previewPath?: string; settingsOpen?: boolean }) {
  const realPath = usePathname();
  const pathname = previewPath ? `${base}${previewPath}` : realPath;
  const settingsActive = SETTINGS_NAV.some((i) => pathname.startsWith(`${base}${i.href}`));
  return (
    <nav className="flex flex-col gap-1 p-3" aria-label="관리자 메뉴">
      {NAV.map((item) => (
        <NavLink key={item.label} item={item} base={base} pathname={pathname} onNavigate={onNavigate} />
      ))}
      <details className="group mt-3 border-t border-sidebar-border pt-3" open={settingsOpen || settingsActive || undefined}>
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 rounded-xl px-3 text-sm text-sidebar-fg hover:bg-sidebar-hover [&::-webkit-details-marker]:hidden">
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

function Brand() {
  return (
    <span className="flex items-center gap-2.5">
      <span className="inline-flex size-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white shadow-sm">P</span>
      <span className="text-[15px] font-bold tracking-tight">PocketExpense</span>
    </span>
  );
}

// theme: 미리보기(/dev/preview?theme=)에서 색상을 고정해 보기 위한 값. 실제 화면은 헤더의 [색상]이 <html data-theme>로 정한다(D-066).
export type ShellTheme = ThemeKey;

// previewPath: 미리보기(/dev/preview)에서 선택된 메뉴를 보여 주기 위한 값. 실제 화면에서는 쓰지 않는다.
export function AdminShell({
  membership,
  children,
  theme,
  previewPath,
}: {
  membership: Membership;
  children: ReactNode;
  theme?: ShellTheme;
  previewPath?: string;
}) {
  const base = `/workspace/${membership.company_id}/admin`;
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-dvh flex-1 bg-page" data-theme={theme}>
      <aside className="hidden w-64 shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-fg md:block">
        <p className="px-6 pb-3 pt-5">
          <Brand />
        </p>
        <NavList base={base} previewPath={previewPath} />
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal aria-label="관리자 메뉴">
          <button type="button" className="absolute inset-0 bg-black/40" aria-label="메뉴 닫기" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col overflow-y-auto bg-sidebar text-sidebar-fg shadow-xl">
            <div className="flex items-center justify-between px-4 py-3">
              <Brand />
              <button type="button" onClick={() => setOpen(false)} aria-label="메뉴 닫기" className="inline-flex size-11 items-center justify-center rounded-xl hover:bg-sidebar-hover">
                <X className="size-5" />
              </button>
            </div>
            <NavList base={base} onNavigate={() => setOpen(false)} previewPath={previewPath} settingsOpen />
            <div className="mt-auto sm:hidden">
              <ThemeOptionsInline />
            </div>
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
