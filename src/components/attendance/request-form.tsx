"use client";

import { ChevronLeft, Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { createAttendanceRequest } from "@/app/workspace/[id]/employee/attendance/actions";
import { minutesLabel, type MonthRow } from "@/lib/attendance/month";
import { applyChip, minutesBetween, REASON_CHIPS, REASON_MAX, validateRequest } from "@/lib/attendance/request";
import { kstTime } from "@/lib/attendance/rules";

// 정정 신청 · 휴일 근무 상신 쓰기(spec/features/attendance.md §6, D-239 → D-257: [근태] 그날 상세 창 안에서)
// D-258: 시각 칸 위에 [정규 출근/퇴근 09:00]·[지금](그날이 오늘일 때만) 한 번 누르기, 다른 시각은 시각 칸에서
export function RequestPanel({
  kind,
  row,
  today,
  defaults,
  onBack,
  onDone,
}: {
  kind: "correction" | "holiday";
  row: MonthRow;
  today: string;
  defaults: { in: string; out: string };
  onBack: () => void;
  onDone: (selfApproved: boolean) => void;
}) {
  const holiday = kind === "holiday";
  const title = holiday ? "휴일 근무 상신" : "정정 신청";
  const [newIn, setNewIn] = useState(row.inTime ?? defaults.in);
  const [newOut, setNewOut] = useState(row.outTime ?? defaults.out);
  const [editTimes, setEditTimes] = useState(!holiday);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const before = { inTime: row.inTime, outTime: row.outTime };
  const validTimes = /^\d{2}:\d{2}$/.test(newIn) && /^\d{2}:\d{2}$/.test(newOut) && newIn < newOut;
  const oldMins = row.inTime && row.outTime ? minutesBetween(row.inTime, row.outTime) : null;
  const submit = () => {
    const input = { date: row.date, kind, newIn, newOut, reason };
    const msg = validateRequest(input, before, today, kstTime(new Date()));
    if (msg) return setError(msg);
    setError(null);
    start(async () => {
      const res = await createAttendanceRequest(input);
      if (!res.ok) return setError(res.error);
      onDone(!!res.selfApproved);
    });
  };

  const [clock] = useState(() => (row.date === today ? kstTime(new Date()).slice(0, 5) : null)); // 창을 연 때의 지금
  const timeField = (label: string, value: string, set: (v: string) => void, now: string | null, nowLabel: string | null, id: string, regular: string) => {
    const changed = now !== value;
    const quick = [
      ...(/^\d{2}:\d{2}$/.test(regular) ? [{ key: "regular", text: `정규 ${label} ${regular}`, v: regular }] : []),
      ...(clock ? [{ key: "now", text: `지금 ${clock}`, v: clock }] : []),
    ];
    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={id} className="text-sm font-semibold">
          {label} <span className="font-normal text-zinc-600">· 지금 {nowLabel ?? "기록 없음"}</span>
        </label>
        {quick.length > 0 && (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={`${label} 시각 빠른 선택`}>
            {quick.map((q) => (
              <button
                key={q.key}
                type="button"
                aria-pressed={value === q.v}
                onClick={() => set(q.v)}
                className={`h-9 rounded-full border px-3 text-[13px] tabular-nums ${value === q.v ? "border-brand-600 bg-brand-50 font-semibold text-brand-800" : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"}`}
                data-time-chip={`${id}-${q.key}`}
              >
                {q.text}
              </button>
            ))}
          </div>
        )}
        <div className={`flex h-13 items-center gap-2 rounded-xl border-2 bg-white px-3.5 ${changed ? "border-brand-600" : "border-zinc-300"}`}>
          <input id={id} type="time" step={60} value={value} onChange={(e) => set(e.target.value)} className="min-w-0 flex-1 bg-transparent text-lg font-bold tabular-nums outline-none" />
          {changed && <span className="text-xs font-semibold text-brand-700">바꿈</span>}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-3.5" data-request-panel={kind}>
      <div className="flex items-center gap-1">
        <button type="button" onClick={onBack} aria-label="그날 기록으로" className="-ml-2 flex size-10 items-center justify-center rounded-lg text-zinc-700 hover:bg-zinc-100">
          <ChevronLeft className="size-6" />
        </button>
        <h2 id="day-title" className="text-xl font-bold">
          {title}
        </h2>
        <span className="ml-1 text-[15px] font-semibold text-zinc-600">{row.label}</span>
        {row.kind === "auto" && <span className="rounded-md bg-orange-100 px-1.5 py-0.5 text-xs font-semibold text-orange-800">자동 퇴근</span>}
      </div>

      {holiday && (
        <section className="grid grid-cols-[5rem_1fr] gap-y-2.5 rounded-2xl border border-zinc-200 bg-white px-4 py-3.5 text-[15px]">
          <span className="text-zinc-600">출근</span>
          <span>
            <b>{row.inTime}</b> <span className="text-zinc-600">· {row.record?.in_terminal ?? ""}</span>
          </span>
          <span className="text-zinc-600">퇴근</span>
          <span>
            <b>{row.outTime}</b> <span className="text-zinc-600">· {row.record?.out_terminal ?? ""}</span>
          </span>
          <span className="text-zinc-600">머문 시간</span>
          <b>{row.stay}</b>
        </section>
      )}
      {holiday && !editTimes && (
        <button type="button" onClick={() => setEditTimes(true)} className="self-start text-sm font-semibold text-brand-700 hover:underline">
          시각이 다르면 함께 고치기 ›
        </button>
      )}

      {editTimes && (
        <>
          {timeField("출근", newIn, setNewIn, row.inTime, row.inTime, "req-in", defaults.in)}
          {timeField("퇴근", newOut, setNewOut, row.outTime, row.outTime && row.kind === "auto" ? `${row.outTime} (자동)` : row.outTime, "req-out", defaults.out)}
          {validTimes && (
            <p className="-mt-1 text-[13px] text-zinc-600" data-stay-preview>
              머문 시간 {oldMins !== null ? `${minutesLabel(oldMins)} → ` : ""}
              <b className="text-zinc-900">{minutesLabel(minutesBetween(newIn, newOut))}</b>
            </p>
          )}
        </>
      )}

      <div className="flex flex-col gap-2">
        <label htmlFor="req-reason" className="text-sm font-semibold">
          {holiday ? "한 일" : "사유"} <span className="text-red-700">(필수)</span>
        </label>
        {!holiday && (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="빠른 선택">
            {REASON_CHIPS.map((c) => {
              const on = reason === c || reason.startsWith(`${c} — `);
              return (
                <button
                  key={c}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setReason(applyChip(reason, c))}
                  className={`h-9 rounded-full border px-3 text-[13px] ${on ? "border-brand-600 bg-brand-50 font-semibold text-brand-800" : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"}`}
                >
                  {c}
                </button>
              );
            })}
          </div>
        )}
        <textarea
          id="req-reason"
          value={reason}
          maxLength={REASON_MAX}
          rows={3}
          onChange={(e) => setReason(e.target.value)}
          placeholder={holiday ? "예: 월말 재고 실사 — 창고 정리·수량 확인" : "예: 거래처 견적 마감 대응"}
          className="rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-[15px] leading-relaxed outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
        />
        <span className="self-end text-xs text-zinc-500">
          {reason.length} / {REASON_MAX}
        </span>
      </div>

      {holiday ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-[13px] leading-relaxed text-red-900">
          관리자가 승인하면 <b>근무한 날</b>로 인정돼요. 수당 계산은 하지 않아요 — 기록과 승인만 남겨요.
        </p>
      ) : (
        <p className="text-xs leading-relaxed text-zinc-600">
          정정 신청은 <b>이번 달 기록만</b> 할 수 있어요(말일까지). 자정 넘은 시각은 넣을 수 없어요(23:59까지). 관리자가 승인하면 바뀌고, 원래 기록은 그대로 남아요.
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm font-semibold text-red-700">
          {error}
        </p>
      )}
      <div className="sticky bottom-0 -mx-5 border-t border-zinc-200 bg-white px-5 pt-3">
        <button type="button" onClick={submit} disabled={busy} className="flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-brand-600 text-base font-semibold text-white hover:bg-brand-700 disabled:opacity-80" data-request-submit>
          {busy && <Loader2 className="size-5 animate-spin" aria-hidden />}
          {holiday ? "상신하기" : "정정 신청 보내기"}
        </button>
      </div>
    </div>
  );
}
