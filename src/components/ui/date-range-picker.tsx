"use client";

import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

// 날짜 범위 고르기 (trip-expense.md §2, D-085). 달력 하나에서 시작일 → 종료일을 차례로 누른다(날짜 창을 두 번 열지 않음).
// 같은 날을 두 번 누르면 당일 출장. 시작일보다 앞을 누르면 그날부터 다시 고른다. 시간은 다루지 않는다(연월일만).
// D-258(휴가 신청): inline = 늘 펼친 달력, single = 하루만(반차), min = 그 전 날은 못 고름,
// off = 쉬는 날(주말·공휴일)은 흐리게, marks = 이미 낸 휴가 등 점 표시(값 = 읽어 줄 이름), count = 요약 뒤 글(기본 'n박 n일')
const DOW = ["일", "월", "화", "수", "목", "금", "토"];
const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
const dow = (s: string) => DOW[new Date(`${s}T00:00:00Z`).getUTCDay()];
const dot = (s: string) => s.replaceAll("-", ".");

export function nightsDays(start: string, end: string): string {
  const days = Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000) + 1;
  return days <= 1 ? "당일" : `${days - 1}박 ${days}일`;
}

export function DateRangePicker({
  start,
  end,
  onChange,
  label = "기간",
  required = false,
  inline = false,
  single = false,
  min,
  off,
  marks,
  count,
}: {
  start: string;
  end: string;
  onChange: (start: string, end: string) => void;
  label?: string;
  required?: boolean;
  inline?: boolean;
  single?: boolean;
  min?: string;
  off?: (date: string) => string | null; // 쉬는 날이면 이유(예: "토요일", "공휴일")
  marks?: Record<string, string>;
  count?: (start: string, end: string) => string;
}) {
  const [opened, setOpen] = useState(false);
  const open = inline || opened;
  const [picking, setPicking] = useState(false); // 시작일을 누르고 종료일을 기다리는 중
  const base = start || new Date().toISOString().slice(0, 10);
  const [view, setView] = useState({ y: Number(base.slice(0, 4)), m: Number(base.slice(5, 7)) - 1 });

  const first = new Date(Date.UTC(view.y, view.m, 1)).getUTCDay();
  const daysIn = new Date(Date.UTC(view.y, view.m + 1, 0)).getUTCDate();
  const cells: (string | null)[] = [...Array(first).fill(null), ...Array.from({ length: daysIn }, (_, i) => ymd(view.y, view.m, i + 1))];
  const move = (delta: number) => setView((v) => ({ y: v.y + Math.floor((v.m + delta) / 12), m: (((v.m + delta) % 12) + 12) % 12 }));

  function pick(d: string) {
    if (single) {
      onChange(d, d);
      setPicking(false);
      return;
    }
    if (!picking || !start || d < start) {
      onChange(d, "");
      setPicking(true);
      return;
    }
    onChange(start, d);
    setPicking(false);
    setOpen(false);
  }

  const tail = (s: string, e: string) => (count ? count(s, e) : nightsDays(s, e));
  const summary =
    start && (end || single) ? (single || start === end ? `${dot(start)} (${dow(start)}) · ${tail(start, start)}` : `${dot(start)} (${dow(start)}) ~ ${dot(end).slice(5)} (${dow(end)}) · ${tail(start, end)}`) : start ? `${dot(start)} (${dow(start)}) ~ 끝나는 날을 골라 주세요` : "날짜를 골라 주세요";

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-zinc-800">
        {label}
        {required && <span className="ml-0.5 text-red-600">*</span>}
      </span>
      {inline ? (
        <p className="flex min-h-11 items-center gap-2 rounded-xl bg-zinc-50 px-3 text-[15px] font-semibold tabular-nums" aria-live="polite" data-cal-summary>
          <CalendarDays className="size-5 shrink-0 text-zinc-500" aria-hidden />
          {summary}
        </p>
      ) : (
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          setOpen((o) => !o);
          setPicking(!!start && !end);
        }}
        className={`flex min-h-11 w-full items-center gap-2 rounded-xl border bg-white px-3 text-left text-base ${open ? "border-brand-500" : "border-zinc-300"} ${start ? "text-zinc-900" : "text-zinc-400"}`}
      >
        <CalendarDays className="size-5 shrink-0 text-zinc-500" />
        <span className="min-w-0 flex-1 py-2 tabular-nums">{summary}</span>
      </button>
      )}
      {open && (
        <div className="rounded-xl border border-zinc-200 bg-white p-2 shadow-sm" role="group" aria-label={`${label} 달력`}>
          <div className="flex items-center justify-between">
            <button type="button" onClick={() => move(-1)} disabled={!!min && ymd(view.y, view.m, 1) <= min} className="inline-flex size-11 items-center justify-center rounded-lg hover:bg-zinc-100 disabled:opacity-30" aria-label="이전 달" data-cal-prev>
              <ChevronLeft className="size-5" />
            </button>
            <span className="font-semibold tabular-nums" aria-live="polite">
              {view.y}년 {view.m + 1}월
            </span>
            <button type="button" onClick={() => move(1)} className="inline-flex size-11 items-center justify-center rounded-lg hover:bg-zinc-100" aria-label="다음 달" data-cal-next>
              <ChevronRight className="size-5" />
            </button>
          </div>
          <p className="px-1 pb-1 text-center text-xs text-zinc-500">{single ? "날짜를 눌러 주세요" : picking ? "끝나는 날을 눌러 주세요 (하루면 같은 날)" : "시작하는 날을 눌러 주세요"}</p>
          <div className="grid grid-cols-7 text-center text-xs text-zinc-500">
            {DOW.map((d, i) => (
              <span key={d} className={`py-1 ${i === 0 ? "text-red-500" : i === 6 ? "text-sky-600" : ""}`}>
                {d}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-y-0.5">
            {cells.map((d, i) => {
              if (!d) return <span key={`e${i}`} />;
              const isStart = d === start;
              const isEnd = d === end;
              const inRange = start && end && d > start && d < end;
              const before = !!min && d < min;
              const offWhy = off?.(d) ?? null;
              const mark = marks?.[d];
              const sel = isStart || isEnd;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => pick(d)}
                  disabled={before}
                  aria-label={`${Number(d.slice(0, 4))}년 ${Number(d.slice(5, 7))}월 ${Number(d.slice(8))}일${offWhy ? ` ${offWhy}` : ""}${mark ? ` · ${mark}` : ""}`}
                  aria-pressed={sel || !!inRange}
                  data-cal-day={d}
                  data-off={offWhy ? "" : undefined}
                  data-mark={mark ? "" : undefined}
                  className={`relative h-11 text-sm tabular-nums disabled:text-zinc-300 ${sel ? "rounded-lg bg-brand-600 font-semibold text-white" : inRange ? `bg-brand-50 ${offWhy ? "text-brand-800/50" : "text-brand-800"}` : `rounded-lg hover:bg-zinc-100 ${offWhy ? "text-zinc-400" : ""}`}`}
                >
                  {Number(d.slice(8))}
                  {mark && <span className={`absolute bottom-1.5 left-1/2 size-1.5 -translate-x-1/2 rounded-full ${sel ? "bg-white" : "bg-amber-500"}`} aria-hidden />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
