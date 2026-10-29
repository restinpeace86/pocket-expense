"use client";

import { useRouter } from "next/navigation";

// 달 고르기 — 바꾸면 화면 새로고침 없이 그 달로
export function MonthPicker({ months, value, base, label = "기장할 달" }: { months: string[]; value: string; base: string; label?: string }) {
  const router = useRouter();
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => router.push(`${base}?month=${e.target.value}`)}
      className="min-h-11 rounded-xl border border-zinc-300 bg-white px-3 text-base font-semibold text-zinc-900"
    >
      {months.map((m) => {
        const [y, mm] = m.split("-").map(Number);
        return (
          <option key={m} value={m}>
            {y}년 {mm}월
          </option>
        );
      })}
    </select>
  );
}
