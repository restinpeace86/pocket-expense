"use client";

import { CalendarDays, ChevronRight, DoorOpen, FileText, Inbox, TreePalm, Wrench } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { formatWon } from "@/lib/format";
import type { RequestItem, RequestKind, RequestStatus } from "@/lib/employee/requests";

// 나의 신청함(D-251 개선사항 6): 홈 메뉴 아래. 오늘 출근 · 오늘 내 회의실 예약 · 휴가/근태 신청 · 지출결의서 · 사비 정산 대기금
// 필터 전체 / 대기중 / 승인(최근 7일) / 반려. "오늘" 줄(출근·회의실)은 전체에서만
export type TodayRoom = { id: string; time: string; title: string; room: string; href: string };
type Filter = "all" | RequestStatus;
const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "wait", label: "대기중" },
  { key: "ok", label: "승인" },
  { key: "bad", label: "반려" },
];
const BADGE: Record<RequestStatus, string> = {
  wait: "bg-amber-100 text-amber-900",
  ok: "bg-green-100 text-green-800",
  bad: "bg-red-100 text-red-800",
};
const ICON: Record<RequestKind, typeof FileText> = { leave: TreePalm, fix: Wrench, claim: FileText };
const row = "flex min-h-12 items-center gap-2.5 rounded-lg px-1 text-sm hover:bg-zinc-50";

export function MyRequests({
  ws,
  title,
  attendance,
  rooms,
  otherEvents,
  calendarHref,
  requests,
  pendingPayout,
}: {
  ws: string;
  title: string;
  attendance: ReactNode; // 근태 꺼진 회사는 null
  rooms: TodayRoom[] | null; // 캘린더 꺼진 회사는 null
  otherEvents: number; // 회의실 아닌 오늘 일정 수
  calendarHref: string;
  requests: RequestItem[];
  pendingPayout: number;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const count = (f: Filter) => (f === "all" ? requests.length + (rooms?.length ?? 0) + (attendance ? 1 : 0) : requests.filter((r) => r.status === f).length);
  const shown = filter === "all" ? requests : requests.filter((r) => r.status === filter);
  const empty = filter === "all" ? requests.length === 0 && !rooms?.length && !attendance : shown.length === 0;
  return (
    <section aria-labelledby="my-requests-title" className="rounded-2xl border border-zinc-200 bg-white px-4 py-2 shadow-sm md:px-5" data-my-requests>
      <div className="flex items-baseline justify-between gap-2 pb-1 pt-2">
        <h2 id="my-requests-title" className="text-[15px] font-bold">
          나의 신청함
        </h2>
        <span className="text-xs text-zinc-500">{title}</span>
      </div>
      <div role="tablist" aria-label="상태로 보기" className="flex flex-wrap gap-1.5 pb-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            role="tab"
            aria-selected={filter === f.key}
            onClick={() => setFilter(f.key)}
            className={`min-h-9 rounded-full border px-3 text-[13px] font-medium ${filter === f.key ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"}`}
            data-filter={f.key}
          >
            {f.label} {count(f.key)}
          </button>
        ))}
      </div>

      {filter === "all" && attendance}
      {filter === "all" &&
        rooms?.map((r) => (
          <Link key={r.id} href={r.href} className={row} data-today-room>
            <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
              <DoorOpen className="size-4" aria-hidden />
            </span>
            <span className="min-w-0 flex-1 truncate">
              <b className="font-semibold">{r.time}</b> {r.room} · {r.title}
            </span>
            <span className="shrink-0 rounded-md bg-brand-50 px-1.5 py-0.5 text-[11px] font-semibold text-brand-700">오늘</span>
          </Link>
        ))}

      <ul className="flex flex-col">
        {shown.map((r) => {
          const Icon = ICON[r.kind];
          return (
            <li key={r.key}>
              <Link href={r.href} className={row} data-request={r.kind} data-status={r.status}>
                <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-600">
                  <Icon className="size-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-zinc-900">{r.title}</span>
                  <span className="block text-xs text-zinc-500">{r.sub}</span>
                </span>
                <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${BADGE[r.status]}`}>{r.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>

      {empty && (
        <p className="flex min-h-12 items-center gap-2 px-1 text-sm text-zinc-500" data-requests-empty>
          <Inbox className="size-4 shrink-0" aria-hidden />
          {filter === "all" ? "지금 진행 중인 신청이 없어요" : `${FILTERS.find((f) => f.key === filter)!.label} 신청이 없어요`}
        </p>
      )}

      {filter === "all" && (
        <>
          <div className="my-1.5 h-px bg-zinc-100" />
          {rooms && otherEvents > 0 && (
            <Link href={calendarHref} className={`${row} text-zinc-700`}>
              <CalendarDays className="size-4 shrink-0 text-zinc-400" aria-hidden />
              <span className="flex-1">오늘 다른 일정 {otherEvents}건</span>
              <ChevronRight className="size-4 shrink-0 text-zinc-400" aria-hidden />
            </Link>
          )}
          <Link href={`${ws}/employee/settlements`} className={`${row} text-zinc-700`}>
            <span className="flex-1">사비 정산 대기금</span>
            <b className="text-[15px] font-bold text-zinc-900">{formatWon(pendingPayout)}</b>
            <ChevronRight className="size-4 shrink-0 text-zinc-400" aria-hidden />
          </Link>
        </>
      )}
    </section>
  );
}
