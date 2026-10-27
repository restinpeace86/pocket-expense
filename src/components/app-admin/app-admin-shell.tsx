import Link from "next/link";
import type { ReactNode } from "react";

// 앱관리자(운영자) 화면 틀 (D-080) — PC 기준, 읽기 전용(전체 공지 쓰기만 예외, D-116). 고객 화면 어디에도 링크하지 않는다.
export function AppAdminShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-zinc-50">
      <header className="border-b border-zinc-800 bg-zinc-900 text-white">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3 md:px-6">
          <Link href="/app-admin" className="flex items-center gap-2 font-bold">
            <span className="inline-flex size-7 items-center justify-center rounded-md bg-amber-400 text-sm text-zinc-900">P</span>
            PocketExpense 운영자
          </Link>
          <nav className="flex items-center gap-3 text-sm">
            <Link href="/app-admin" className="text-zinc-300 hover:text-white">회사</Link>
            <Link href="/app-admin/announcements" className="text-zinc-300 hover:text-white">전체 공지</Link>
            <Link href="/app-admin/reviews" className="text-zinc-300 hover:text-white">후기</Link>
            <span className="hidden rounded-full bg-zinc-800 px-2.5 py-1 text-xs text-zinc-300 sm:inline">공지·후기 숨김 외 읽기 전용</span>
          </nav>
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
export const td = "border-b border-zinc-100 px-2 py-2 align-top text-sm";

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
