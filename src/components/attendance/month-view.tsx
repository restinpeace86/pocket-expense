"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { minutesLabel, monthLabel, type MonthRow, type MonthSummary } from "@/lib/attendance/month";

// 월 근태 현황(spec/features/attendance.md §5, D-237): 요약 + 날짜 목록(최근 위) + 날짜 누르면 그날 상세
const BADGE: Record<string, { text: string; cls: string } | undefined> = {
  auto: { text: "자동 퇴근", cls: "bg-orange-100 text-orange-800" },
  holiday: { text: "휴일", cls: "bg-red-50 text-red-700" },
  none: { text: "기록 없음", cls: "bg-zinc-100 text-zinc-700" },
  open: { text: "퇴근 전", cls: "bg-green-100 text-green-800" },
  noout: { text: "퇴근 없음", cls: "bg-orange-100 text-orange-800" },
  before: { text: "출근 전", cls: "bg-zinc-100 text-zinc-700" },
};
const tone = { weekday: "text-zinc-900", sat: "text-blue-700", red: "text-red-700" } as const;

export function MonthView({ base, month, prev, next, rows, summary }: { base: string; month: string; prev: string; next: string | null; rows: MonthRow[]; summary: MonthSummary }) {
  const [open, setOpen] = useState<MonthRow | null>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-3 px-4 pb-28 pt-3 md:max-w-3xl md:px-6 md:pt-6">
      <div className="flex flex-wrap items-center gap-1">
        <Link href={base} aria-label="홈으로" className="flex size-10 items-center justify-center rounded-lg text-zinc-700 hover:bg-zinc-100">
          <ChevronLeft className="size-6" />
        </Link>
        <h1 className="text-xl font-bold md:text-2xl">근태</h1>
        <div className="ml-auto flex items-center">
          <Link href={`${base}/attendance?month=${prev}`} aria-label="이전 달" className="flex size-11 items-center justify-center rounded-lg text-zinc-700 hover:bg-zinc-100">
            <ChevronLeft className="size-5" />
          </Link>
          <b className="min-w-28 text-center text-[17px]">{monthLabel(month)}</b>
          {next ? (
            <Link href={`${base}/attendance?month=${next}`} aria-label="다음 달" className="flex size-11 items-center justify-center rounded-lg text-zinc-700 hover:bg-zinc-100">
              <ChevronRight className="size-5" />
            </Link>
          ) : (
            <span aria-hidden className="flex size-11 items-center justify-center text-zinc-300">
              <ChevronRight className="size-5" />
            </span>
          )}
        </div>
      </div>

      <section aria-label="이번 달 요약" className="grid grid-cols-2 gap-x-2 gap-y-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3.5 md:grid-cols-4 md:px-5">
        <div>
          <p className="text-xs text-zinc-600">출근한 날</p>
          <b className="text-lg">{summary.worked}일</b>
          {summary.holidayWorked > 0 && <span className="ml-1 text-xs text-red-700">휴일 {summary.holidayWorked}일 포함</span>}
        </div>
        <div>
          <p className="text-xs text-zinc-600">머문 시간 합계</p>
          <b className="text-lg">{minutesLabel(summary.minutes)}</b>
        </div>
        <div>
          <p className="text-xs text-zinc-600">자동 퇴근</p>
          <b className={`text-lg ${summary.auto ? "text-orange-700" : ""}`}>{summary.auto}번</b>
        </div>
        <div>
          <p className="text-xs text-zinc-600">기록 없는 근무일</p>
          <b className="text-lg text-zinc-600">{summary.missing}일</b>
        </div>
      </section>

      {rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-zinc-300 bg-white px-4 py-8 text-center text-sm text-zinc-500">이 달에는 출퇴근 기록이 없어요.</p>
      ) : (
        <ul aria-label="날짜별 출퇴근" className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
          {rows.map((r) => {
            const b = BADGE[r.kind];
            return (
              <li key={r.date} className="border-b border-zinc-100 last:border-b-0">
                <button type="button" onClick={() => setOpen(r)} data-day={r.date} data-kind={r.kind} className="flex min-h-14 w-full items-center gap-2.5 px-3.5 text-left hover:bg-zinc-50">
                  <span className={`w-[4.25rem] shrink-0 text-sm font-semibold ${tone[r.dayTone]}`}>{r.label}</span>
                  <span className="min-w-0 flex-1">
                    <span className={`block text-sm ${r.inTime ? "text-zinc-900" : "text-zinc-500"}`}>
                      {r.inTime ? `${r.inTime} – ${r.outTime ?? "퇴근 전"}` : r.kind === "before" ? "아직 출근 전" : "출퇴근 기록 없음"}
                    </span>
                    {r.stay && <span className="block text-xs text-zinc-600">{r.stay}</span>}
                  </span>
                  {b && <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-xs font-semibold ${b.cls}`}>{b.text}</span>}
                  <ChevronRight className="size-4 shrink-0 text-zinc-400" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-xs leading-relaxed text-zinc-600">기록 없는 휴일은 목록에 나오지 않아요. 날짜를 누르면 그날 출퇴근 단말과 자세한 시각을 볼 수 있어요.</p>

      {open && <DaySheet row={open} onClose={() => setOpen(null)} />}
    </main>
  );
}

function DaySheet({ row, onClose }: { row: MonthRow; onClose: () => void }) {
  const r = row.record;
  const b = BADGE[row.kind];
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center" onClick={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="day-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-t-3xl bg-white px-5 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-4 md:rounded-3xl md:pb-6"
      >
        <div className="flex items-center gap-2">
          <h2 id="day-title" className="text-xl font-bold">
            {row.label}
          </h2>
          {b && <span className={`rounded-md px-1.5 py-0.5 text-xs font-semibold ${b.cls}`}>{b.text}</span>}
          <button type="button" onClick={onClose} aria-label="닫기" className="ml-auto flex size-10 items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-100">
            <X className="size-5" />
          </button>
        </div>
        {r ? (
          <dl className="mt-3 grid grid-cols-[5.5rem_1fr] gap-y-3 text-[15px]">
            <dt className="text-zinc-600">출근</dt>
            <dd>
              <b>{row.inTime}</b>
              {r.in_terminal && <span className="text-zinc-600"> · {r.in_terminal}</span>}
            </dd>
            <dt className="text-zinc-600">퇴근</dt>
            <dd>
              {row.outTime ? (
                <>
                  <b>{row.outTime}</b>
                  <span className="text-zinc-600"> · {r.out_method === "auto" ? "자동" : (r.out_terminal ?? "")}</span>
                  {r.out_method === "auto" && <span className="block text-[13px] text-orange-800">자정까지 안 찍어 정규 퇴근 시각({r.sched_end})으로 자동 기록됐어요</span>}
                </>
              ) : (
                <span className="text-zinc-600">{row.kind === "open" ? "아직 퇴근 전이에요" : "퇴근 기록이 없어요"}</span>
              )}
            </dd>
            <dt className="text-zinc-600">머문 시간</dt>
            <dd>
              <b>{row.stay ?? "-"}</b>
            </dd>
            <dt className="text-zinc-600">구분</dt>
            <dd>{r.holiday ? `휴일${row.holidayName ? ` (${row.holidayName})` : ""}` : "근무일"}</dd>
          </dl>
        ) : (
          <p className="mt-3 text-[15px] text-zinc-700">{row.kind === "before" ? "오늘은 아직 출근 기록이 없어요." : "이 근무일에는 출퇴근 기록이 없어요."}</p>
        )}
        <p className="mt-4 rounded-xl bg-zinc-100 px-3.5 py-3 text-[13px] leading-relaxed text-zinc-700">실제 시각이 다르면 정정 신청으로 고칠 수 있어요. 관리자가 승인하면 바뀌고, 원래 기록은 남아요.</p>
        <button type="button" disabled className="mt-3 h-12 w-full rounded-xl bg-zinc-200 font-semibold text-zinc-600">
          정정 신청 (곧 열려요)
        </button>
      </section>
    </div>
  );
}
