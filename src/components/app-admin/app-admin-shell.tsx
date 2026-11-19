import Link from "next/link";
import type { ReactNode } from "react";
import { Wordmark } from "@/components/brand/logo";
import { AppAdminNav } from "./app-admin-nav";

// 앱관리자(운영자) 화면 틀 (D-080) — PC 기준, 읽기 전용(전체 공지 쓰기만 예외, D-116). 고객 화면 어디에도 링크하지 않는다.
export function AppAdminShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-zinc-50">
      <header className="border-b border-zinc-800 bg-zinc-900 text-white">
        {/* 넓은 화면: 로고 · 메뉴 한 줄 / 좁은 화면: 로고 아래 옆으로 밀어 보는 메뉴(D-296). 지금 보는 메뉴는 흰 칩 */}
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-4 py-2.5 md:px-6 lg:flex-row lg:items-center lg:gap-4">
          <Link href="/app-admin" className="flex min-h-9 shrink-0 items-center gap-2 whitespace-nowrap font-bold">
            <Wordmark tone="light" className="text-base" />
            <span className="rounded-md bg-amber-400 px-1.5 py-0.5 text-xs text-zinc-900">운영자</span>
          </Link>
          <AppAdminNav />
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 md:px-6">{children}</main>
    </div>
  );
}

export function Panel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="min-w-0 rounded-xl border border-zinc-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 px-4 py-3">
        <h2 className="font-semibold">{title}</h2>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

// 표는 좁은 화면에서 표만 가로로 밀어 본다(페이지는 넘치지 않게)
export function TableWrap({ children }: { children: ReactNode }) {
  return <div className="-mx-4 overflow-x-auto px-4">{children}</div>;
}

export const th = "whitespace-nowrap border-b border-zinc-200 px-2 py-2 text-left text-xs font-medium text-zinc-500";
// break-keep: 좁은 화면에서 한글이 한 글자씩 세로로 쪼개지지 않게(단어 단위 줄바꿈, 넓어지면 표만 옆으로 밀어 봄)
export const td = "break-keep border-b border-zinc-100 px-2 py-2 align-top text-sm";

export function MonthNav({ month, hrefFor }: { month: string; hrefFor: (m: string) => string }) {
  const [y, m] = month.split("-").map(Number);
  const shift = (d: number) => {
    const t = new Date(Date.UTC(y, m - 1 + d, 1));
    return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}`;
  };
  const btn = "inline-flex min-h-9 items-center rounded-lg border border-zinc-300 bg-white px-3 text-sm hover:bg-zinc-50";
  return (
    <div className="flex items-center gap-2">
      <Link href={hrefFor(shift(-1))} className={btn}>
        ← 이전 달
      </Link>
      <span className="min-w-24 text-center text-sm font-semibold">
        {y}년 {m}월
      </span>
      <Link href={hrefFor(shift(1))} className={btn}>
        다음 달 →
      </Link>
    </div>
  );
}
