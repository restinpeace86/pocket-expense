"use client";

import { BookOpenCheck, FileDown, FileSpreadsheet, LayoutDashboard, Library, Menu, Users, X, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { SignOutButton } from "@/components/auth/sign-out-button";

type Company = { id: string; name: string };
type Item = { href: string; label: string; icon: LucideIcon; active: boolean };

const LAST_KEY = "pe-tax-office-company";
const noopSubscribe = () => () => {};
function readLast(): string | null {
  try {
    return window.localStorage.getItem(LAST_KEY);
  } catch {
    return null;
  }
}

// 세무사무소 워크스페이스 틀 (D-149, D-184): 관리자 워크스페이스와 같은 구조 — PC는 왼쪽 메뉴, 휴대폰은 ☰ 서랍.
// 고객사는 위쪽 [고객사] 고르기로 바꾸고(관리자 = 전체, 세무사 = 배정된 곳), 메뉴는 그대로 둔 채 내용만 그 회사로 바뀐다(보던 달 유지).
// 고객사 화면 밖(현황·양식·사무소)에서는 마지막으로 본 고객사(없으면 첫 고객사)를 메뉴에 건다
export function TaxOfficeShell({ officeName, isAdmin, companies, children }: { officeName: string; isAdmin: boolean; companies: Company[]; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const params = useParams<{ companyId?: string }>();
  const month = useSearchParams().get("month");
  const [open, setOpen] = useState(false);
  const last = useSyncExternalStore(noopSubscribe, readLast, () => null);
  const current = params?.companyId;
  const selected = companies.find((c) => c.id === current) ?? companies.find((c) => c.id === last) ?? companies[0] ?? null;

  useEffect(() => {
    if (!current) return;
    try {
      window.localStorage.setItem(LAST_KEY, current);
    } catch {
      // 저장이 막힌 브라우저 — 첫 고객사로 돌아갈 뿐
    }
  }, [current]);

  const q = month ? `?month=${month}` : "";
  const companyBase = selected ? `/tax-office/${selected.id}` : null;
  const companyItems: Item[] = companyBase
    ? [
        { href: `${companyBase}${q}`, label: "세무 자료", icon: FileDown, active: pathname === companyBase },
        { href: `${companyBase}/account-titles`, label: "계정과목", icon: BookOpenCheck, active: pathname === `${companyBase}/account-titles` },
      ]
    : [];
  const officeItems: Item[] = [
    ...(isAdmin ? [{ href: "/tax-office/default-titles", label: "기본 계정과목", icon: Library, active: pathname === "/tax-office/default-titles" }] : []),
    { href: "/tax-office/templates", label: "결산 양식", icon: FileSpreadsheet, active: pathname === "/tax-office/templates" },
    { href: "/tax-office/manage", label: isAdmin ? "사무소 관리" : "내 사무소", icon: Users, active: pathname === "/tax-office/manage" },
  ];

  // 고객사를 바꾸면 보던 메뉴(세무 자료·계정과목)를 그대로 그 회사로
  function switchTo(id: string) {
    const sub = current && pathname.endsWith("/account-titles") ? "/account-titles" : "";
    router.push(`/tax-office/${id}${sub}${sub ? "" : q}`);
  }

  const nav = (onNavigate?: () => void) => (
    <nav className="flex flex-col gap-1 p-3" aria-label="세무사무소 메뉴">
      <NavItem item={{ href: "/tax-office", label: "고객사 현황", icon: LayoutDashboard, active: pathname === "/tax-office" }} onNavigate={onNavigate} />
      <p className="mt-3 truncate border-t border-sidebar-border px-3 pb-1 pt-3 text-xs text-sidebar-muted">{selected ? selected.name : isAdmin ? "고객사" : "맡은 고객사"}</p>
      {companyItems.length > 0 ? (
        companyItems.map((item) => <NavItem key={item.label} item={item} onNavigate={onNavigate} />)
      ) : (
        <p className="px-3 py-2 text-sm text-sidebar-muted">고객사가 연결되면 보여요</p>
      )}
      <p className="mt-3 border-t border-sidebar-border px-3 pb-1 pt-3 text-xs text-sidebar-muted">사무소</p>
      {officeItems.map((item) => (
        <NavItem key={item.label} item={item} onNavigate={onNavigate} />
      ))}
    </nav>
  );

  return (
    <div className="flex min-h-dvh flex-1 bg-page">
      <aside className="hidden w-64 shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-fg md:block">
        <div className="px-6 pb-3 pt-5">
          <Brand officeName={officeName} />
        </div>
        {nav()}
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal aria-label="세무사무소 메뉴">
          <button type="button" className="absolute inset-0 bg-black/40" aria-label="메뉴 닫기" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col overflow-y-auto bg-sidebar text-sidebar-fg shadow-xl">
            <div className="flex items-center justify-between gap-2 px-4 py-3">
              <Brand officeName={officeName} />
              <button type="button" onClick={() => setOpen(false)} aria-label="메뉴 닫기" className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl hover:bg-sidebar-hover">
                <X className="size-5" />
              </button>
            </div>
            {nav(() => setOpen(false))}
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex min-h-14 items-center gap-2 border-b border-zinc-200 bg-white px-2 md:px-6">
          <button type="button" onClick={() => setOpen(true)} aria-label="메뉴 열기" className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl hover:bg-zinc-100 md:hidden">
            <Menu className="size-5" />
          </button>
          {selected ? (
            <label className="flex min-w-0 flex-1 items-center gap-2 text-sm">
              <span className="hidden shrink-0 text-zinc-500 sm:inline">고객사</span>
              <select
                value={selected.id}
                onChange={(e) => switchTo(e.target.value)}
                aria-label="고객사 고르기"
                className="min-h-10 w-full min-w-0 max-w-sm truncate rounded-lg border border-zinc-300 bg-white px-3 font-medium text-zinc-900"
              >
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <span className="min-w-0 flex-1 truncate text-sm text-zinc-500">고객사 없음</span>
          )}
          <SignOutButton />
        </header>
        <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 px-4 py-6 md:px-8">{children}</main>
      </div>
    </div>
  );
}

function NavItem({ item, onNavigate }: { item: Item; onNavigate?: () => void }) {
  const { href, label, icon: Icon, active } = item;
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm ${active ? "bg-sidebar-active font-semibold text-sidebar-active-fg" : "text-sidebar-fg hover:bg-sidebar-hover"}`}
    >
      <Icon className="size-5 shrink-0" />
      {label}
    </Link>
  );
}

function Brand({ officeName }: { officeName: string }) {
  return (
    <Link href="/tax-office" className="flex min-w-0 items-center gap-2.5">
      <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white shadow-sm">P</span>
      <span className="min-w-0">
        <span className="block truncate text-[15px] font-bold tracking-tight text-white">{officeName}</span>
        <span className="block text-[11px] text-sidebar-muted">세무사무소</span>
      </span>
    </Link>
  );
}
