"use client";

import { useState, useTransition } from "react";
import { addHolidayAction, deleteHolidayAction } from "@/app/app-admin/holidays/actions";

const WEEK = ["일", "월", "화", "수", "목", "금", "토"];

// 운영자 공휴일 표 편집 (D-161)
export function HolidayEditor({ rows }: { rows: { day: string; name: string }[] }) {
  const [day, setDay] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-4">
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          start(async () => {
            const r = await addHolidayAction(day, name);
            if (!r.ok) return setError(r.error);
            setDay("");
            setName("");
          });
        }}
      >
        <label className="flex flex-col gap-1 text-sm">
          날짜
          <input type="date" value={day} onChange={(e) => setDay(e.target.value)} required className="min-h-10 rounded-lg border border-zinc-300 px-2" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          이름
          <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={40} placeholder="예: 임시공휴일" className="min-h-10 rounded-lg border border-zinc-300 px-2" />
        </label>
        <button type="submit" disabled={pending} className="min-h-10 rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white disabled:opacity-50">
          추가
        </button>
      </form>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <ul className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((r) => (
          <li key={r.day} className="flex items-center justify-between gap-2 rounded-lg border border-zinc-100 px-3 py-2 text-sm">
            <span className="min-w-0 truncate">
              <span className="tabular-nums">{r.day}</span>({WEEK[new Date(`${r.day}T00:00:00Z`).getUTCDay()]}) · {r.name}
            </span>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (!confirm(`${r.day} ${r.name}을(를) 지울까요?`)) return;
                start(async () => {
                  const res = await deleteHolidayAction(r.day);
                  if (!res.ok) setError(res.error);
                });
              }}
              className="shrink-0 text-xs text-red-700 underline underline-offset-2"
            >
              지우기
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
