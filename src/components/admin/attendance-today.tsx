"use client";

import { ChevronLeft, ChevronRight, RotateCw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { addDays } from "@/lib/attendance/leave";
import { dayLabel } from "@/lib/attendance/month";
import { kstTime } from "@/lib/attendance/rules";
import { buildDay, filterRows, type DayAdminData, type DayFilter, type DayStatus } from "@/lib/attendance/today";

// [근태] 탭(D-242): 오늘 출근 · 승인 대기 · 처리 끝 — 주소의 ?tab= 으로 고른다
export function AttendanceTabs({ active, pending, settingsHref }: { active: "today" | "pending" | "done"; pending: number; settingsHref: string }) {
  const cls = (on: boolean) => `-mb-px border-b-2 px-3 py-2.5 text-[15px] whitespace-nowrap ${on ? "border-brand-600 font-bold text-brand-700" : "border-transparent text-zinc-600 hover:text-zinc-900"}`;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <nav role="tablist" aria-label="근태" className="flex min-w-0 flex-1 gap-1 overflow-x-auto border-b border-zinc-200">
        <Link role="tab" aria-selected={active === "today"} href="?tab=today" className={cls(active === "today")} data-tab="today">
          오늘 출근
        </Link>
        <Link role="tab" aria-selected={active === "pending"} href="?tab=pending" className={cls(active === "pending")} data-tab="pending">
          승인 대기 {pending}
        </Link>
        <Link role="tab" aria-selected={active === "done"} href="?tab=done" className={cls(active === "done")} data-tab="done">
          처리 끝 <span className="text-xs">(최근 3개월)</span>
        </Link>
      </nav>
      <Link href={settingsHref} className="inline-flex h-10 items-center rounded-xl border border-zinc-300 bg-white px-3.5 text-sm text-zinc-800 hover:bg-zinc-50">
        근태 설정
      </Link>
    </div>
  );
}

const BADGE: Record<DayStatus, string> = {
  working: "bg-green-100 text-green-800",
  out: "bg-zinc-200 text-zinc-800",
  before: "bg-orange-100 text-orange-800",
  none: "bg-orange-100 text-orange-800",
  leave: "bg-teal-100 text-teal-800",
  off: "bg-zinc-100 text-zinc-600",
  not_yet: "bg-zinc-100 text-zinc-500",
};

// 오늘 출근 현황(D-242): 날짜 이동 · 요약 칸으로 걸러 보기 · 지각·조퇴는 판단하지 않음 · 이름 → 그 직원 월 근태
export function AttendanceToday({ data, memberHref }: { data: DayAdminData; memberHref: string }) {
  const router = useRouter();
  const { rows, summary } = useMemo(() => buildDay(data), [data]);
  const [filter, setFilter] = useState<DayFilter>("all");
  const isToday = data.date === data.today;
  // 오늘이면 1분마다 새로 불러온다
  useEffect(() => {
    if (!isToday) return;
    const t = setInterval(() => router.refresh(), 60_000);
    return () => clearInterval(t);
  }, [isToday, router]);
  const min = addDays(data.today, -92);
  const max = addDays(data.today, 31);
  const prev = addDays(data.date, -1);
  const next = addDays(data.date, 1);
  const shown = filterRows(rows, filter);
  const stat = (key: DayFilter, label: string, n: number, color: string) => (
    <button type="button" aria-pressed={filter === key} onClick={() => setFilter(filter === key && key !== "all" ? "all" : key)} className={`flex min-w-0 flex-col items-start rounded-xl border bg-white px-3 py-2 text-left ${filter === key ? "border-2 border-brand-600" : "border-zinc-200 hover:bg-zinc-50"}`} data-stat={key}>
      <span className="text-xs text-zinc-600">{label}</span>
      <b className={`text-xl ${color}`}>{n}명</b>
    </button>
  );
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <div className="flex items-center">
          {prev >= min ? (
            <Link href={`?tab=today&date=${prev}`} aria-label="전날" className="flex size-10 items-center justify-center rounded-lg text-zinc-700 hover:bg-zinc-100">
              <ChevronLeft className="size-5" />
            </Link>
          ) : (
            <span className="size-10" />
          )}
          <b className="min-w-28 text-center text-[17px]" data-date={data.date}>
            {dayLabel(data.date)}
            {isToday && <span className="ml-1 text-xs font-semibold text-brand-700">오늘</span>}
          </b>
          {next <= max ? (
            <Link href={`?tab=today&date=${next}`} aria-label="다음 날" className="flex size-10 items-center justify-center rounded-lg text-zinc-700 hover:bg-zinc-100">
              <ChevronRight className="size-5" />
            </Link>
          ) : (
            <span className="size-10" />
          )}
        </div>
        <span className="text-[13px] text-zinc-600">
          정규 {data.work_start} ~ {data.work_end}(참고)
          {isToday && ` · ${kstTime(data.now)} 기준`}
          {!data.workday && ` · ${data.holiday_name ?? "근무 요일이 아니에요"}`}
        </span>
        <span className="ml-auto flex items-center gap-2">
          {!isToday && (
            <Link href="?tab=today" className="text-[13px] font-semibold text-brand-700 hover:underline">
              오늘로
            </Link>
          )}
          <button type="button" onClick={() => router.refresh()} className="flex h-10 items-center gap-1 rounded-lg px-2 text-[13px] font-semibold text-brand-700 hover:bg-brand-50">
            <RotateCw className="size-4" aria-hidden /> 새로고침
          </button>
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5" role="group" aria-label="상태로 걸러 보기">
        {stat("all", "전체", summary.total, "text-zinc-900")}
        {stat("working", "근무 중", summary.working, "text-green-800")}
        {stat("out", "퇴근", summary.out, "text-zinc-900")}
        {stat("before", isToday ? "출근 전" : "기록 없음", summary.before, "text-orange-800")}
        {stat("leave", "휴가", summary.leave, "text-teal-800")}
      </div>

      {shown.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-zinc-300 bg-white px-4 py-8 text-center text-sm text-zinc-500">해당하는 사람이 없어요.</p>
      ) : (
        <ul aria-label="직원별 출근" className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
          {shown.map((r) => (
            <li key={r.id} data-person={r.id} data-status={r.status} className="border-b border-zinc-100 last:border-b-0">
              <Link href={`${memberHref}/${r.id}?month=${data.date.slice(0, 7)}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 hover:bg-zinc-50 md:grid md:grid-cols-[9rem_9.5rem_4rem_4rem_7rem_minmax(0,1fr)] md:gap-4">
                <span className="min-w-0">
                  <b className="text-[15px]">{r.name}</b>
                  <span className="block text-xs text-zinc-500">{r.department ?? (r.role === "super_admin" ? "대표" : r.role === "admin" ? "관리자" : "부서 없음")}</span>
                </span>
                <span className={`ml-auto rounded-md px-1.5 py-0.5 text-xs font-semibold md:ml-0 md:justify-self-start ${BADGE[r.status]}`}>{r.label}</span>
                <span className="w-full text-sm tabular-nums md:w-auto">
                  <span className="text-zinc-500 md:hidden">출근 </span>
                  {r.inTime ?? <span className="text-zinc-400">—</span>}
                  <span className="text-zinc-500 md:hidden"> · 퇴근 {r.outTime ?? "—"}</span>
                </span>
                <span className="hidden text-sm tabular-nums md:block">{r.outTime ?? <span className="text-zinc-400">—</span>}</span>
                <span className="hidden truncate text-[13px] text-zinc-600 md:block">{r.terminal ?? <span className="text-zinc-400">—</span>}</span>
                <span className="w-full min-w-0 text-[13px] text-zinc-700 md:w-auto">{r.memo}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs leading-relaxed text-zinc-600">찍힌 시각만 보여 줘요. 지각·조퇴는 판단하지 않아요(정규 시각은 참고). 휴가는 승인된 것만 보여요. 이름을 누르면 그 직원의 월 근태를 볼 수 있어요.</p>
    </div>
  );
}
