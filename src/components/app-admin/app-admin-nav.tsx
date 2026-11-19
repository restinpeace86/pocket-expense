"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

// 운영자 메뉴. 넓은 화면은 한 줄, 좁은 화면(휴대폰·태블릿)은 아래 줄에서 옆으로 밀어 보는 칩 — 글자가 화면 밖으로 나가 페이지를 밀지 않게
const MENU = [
  { href: "/app-admin", label: "회사" },
  { href: "/app-admin/announcements", label: "전체 공지" },
  { href: "/app-admin/feedback", label: "의견" },
  { href: "/app-admin/reviews", label: "후기" },
  { href: "/app-admin/format-requests", label: "양식 접수" },
  { href: "/app-admin/form-slots", label: "양식 칸 신청" },
  { href: "/app-admin/storage", label: "저장 공간 신청" },
  { href: "/app-admin/referrals", label: "추천" },
  { href: "/app-admin/notifications", label: "알림 이력" },
  { href: "/app-admin/holidays", label: "공휴일" },
  { href: "/app-admin/help", label: "도움말 글" },
] as const;

const isActive = (path: string, href: string) =>
  href === "/app-admin" ? path === href || path.startsWith("/app-admin/companies") || path.startsWith("/app-admin/receipts") : path === href || path.startsWith(`${href}/`);

export function AppAdminNav() {
  const path = usePathname();
  const ref = useRef<HTMLElement>(null);
  // 좁은 화면: 지금 메뉴가 보이게 칩 줄을 옆으로 옮겨 둔다
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>("[aria-current=page]")?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [path]);
  return (
    <nav
      ref={ref}
      aria-label="운영자 메뉴"
      className="-mx-4 flex w-[calc(100%+2rem)] gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:-mx-6 md:w-[calc(100%+3rem)] md:px-6 lg:mx-0 lg:w-auto lg:flex-wrap lg:gap-1 lg:overflow-visible lg:p-0 [&::-webkit-scrollbar]:hidden"
      data-app-admin-nav
    >
      {MENU.map((m) => {
        const on = isActive(path, m.href);
        return (
          <Link
            key={m.href}
            href={m.href}
            aria-current={on ? "page" : undefined}
            className={`inline-flex min-h-9 shrink-0 items-center whitespace-nowrap rounded-lg px-2.5 text-sm ${on ? "bg-white font-semibold text-zinc-900" : "text-zinc-300 hover:bg-zinc-800 hover:text-white"}`}
          >
            {m.label}
          </Link>
        );
      })}
    </nav>
  );
}
