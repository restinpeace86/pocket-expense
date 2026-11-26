import { CalendarCheck, ChevronRight } from "lucide-react";
import Link from "next/link";

// 관리자 홈: 지난달 마감 전이면 월 마감 도우미로(D-315). 마감일이 지나면 주황
export function ClosingHomeCard({ href, month, done, total, due, overdue }: { href: string; month: string; done: number; total: number; due: string; overdue: boolean }) {
  const m = `${Number(month.slice(5, 7))}월`;
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <Link
      href={href}
      className={`group flex flex-col gap-2 rounded-xl border p-4 shadow-sm ${overdue ? "border-amber-300 bg-amber-50 hover:bg-amber-100" : "border-brand-200 bg-brand-50 hover:bg-brand-100"}`}
      data-closing-home
    >
      <span className="flex items-center gap-2">
        <CalendarCheck className={`size-5 shrink-0 ${overdue ? "text-amber-700" : "text-brand-700"}`} aria-hidden />
        <b className="min-w-0 flex-1 break-keep text-zinc-900">
          {overdue ? `${m} 세무 마감일(${due})이 지났어요` : `${m} 마감 기간이에요 · 마감일 ${due}`}
        </b>
        <ChevronRight className="size-4 shrink-0 text-zinc-500 group-hover:text-zinc-900" aria-hidden />
      </span>
      <span className="break-keep text-sm text-zinc-700">
        결재 정리 → {total === 4 ? "카드 대조 → " : ""}홈택스 자료 → 세무사무소에 넘기기, 순서대로 안내해 드려요.
      </span>
      <span className="flex items-center gap-2 text-xs tabular-nums text-zinc-600">
        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white">
          <span className="block h-full rounded-full bg-brand-600" style={{ width: `${pct}%` }} />
        </span>
        {total}단계 중 {done}단계 끝
      </span>
    </Link>
  );
}
