"use client";

import { Building2 } from "lucide-react";
import Link from "next/link";
import { useParams, usePathname, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { SignOutButton } from "@/components/auth/sign-out-button";

type Company = { id: string; name: string };

// 세무사무소 워크스페이스 틀 (D-149): 위(휴대폰) 또는 왼쪽(PC)에 고객사 목록(관리자 = 전체, 세무사 = 배정된 곳).
// 누르면 화면 새로고침 없이 그 회사로 바뀐다(보던 달 유지). 관리자는 [사무소 관리]
export function TaxOfficeShell({ officeName, isAdmin, companies, children }: { officeName: string; isAdmin: boolean; companies: Company[]; children: ReactNode }) {
  const pathname = usePathname();
  const params = useParams<{ companyId?: string }>();
  const month = useSearchParams().get("month");
  const current = params?.companyId;
  const href = (id: string) => `/tax-office/${id}${month ? `?month=${month}` : ""}`;
  const item = (active: boolean) =>
    `flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm ${active ? "bg-brand-600 font-semibold text-white" : "text-zinc-700 hover:bg-zinc-100"}`;

  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-3 md:px-6">
          <Link href="/tax-office" className="flex min-w-0 items-center gap-2 font-bold">
            <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-md bg-brand-600 text-sm text-white">P</span>
            <span className="min-w-0 truncate">{officeName}</span>
          </Link>
          <div className="flex items-center gap-3 whitespace-nowrap text-sm">
            <Link href="/tax-office" aria-current={pathname === "/tax-office" ? "page" : undefined} className={top(pathname === "/tax-office")}>
              고객사
            </Link>
            {isAdmin && (
              <Link href="/tax-office/manage" aria-current={pathname === "/tax-office/manage" ? "page" : undefined} className={top(pathname === "/tax-office/manage")}>
                사무소 관리
              </Link>
            )}
            <SignOutButton />
          </div>
        </div>
        {/* 휴대폰·태블릿: 가로로 미는 회사 목록 */}
        <nav aria-label="담당 회사" className={`border-t border-zinc-100 lg:hidden ${companies.length === 0 ? "hidden" : ""}`}>
          <ul className="mx-auto flex w-full max-w-7xl gap-1 overflow-x-auto px-4 py-2">
            {companies.map((c) => (
              <li key={c.id} className="shrink-0">
                <Link href={href(c.id)} aria-current={c.id === current ? "page" : undefined} className={`${item(c.id === current)} whitespace-nowrap`}>
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <div className="mx-auto flex w-full max-w-7xl flex-1 gap-6 px-4 py-6 md:px-6">
        <aside className="hidden w-60 shrink-0 lg:block">
          <p className="px-3 pb-2 text-xs font-medium text-zinc-500">
            {isAdmin ? "고객사" : "맡은 고객사"} {companies.length}곳
          </p>
          {companies.length === 0 && <p className="px-3 text-sm text-zinc-500">아직 없어요</p>}
          <nav aria-label="담당 회사">
            <ul className="flex flex-col gap-0.5">
              {companies.map((c) => (
                <li key={c.id}>
                  <Link href={href(c.id)} aria-current={c.id === current ? "page" : undefined} className={item(c.id === current)}>
                    <Building2 className="size-4 shrink-0" aria-hidden />
                    <span className="min-w-0 truncate">{c.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </aside>
        <main className="flex min-w-0 flex-1 flex-col gap-5">{children}</main>
      </div>
    </div>
  );
}

const top = (active: boolean) => `inline-flex min-h-10 items-center ${active ? "font-semibold text-brand-700" : "text-zinc-600 hover:text-zinc-900"}`;
