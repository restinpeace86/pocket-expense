"use client";

import type { ReactNode } from "react";

// 라디오 선택 카드. 도움말 규칙(ui-rules.md §6) ③: 예시·추가 입력은 선택한 카드에만 보여 준다.
export type Choice<T extends string> = {
  value: T;
  label: string;
  description: string;
  badge?: string;
  example?: ReactNode; // 선택했을 때만
  extra?: ReactNode; // 선택했을 때만 (예: N일 입력칸)
};

export function ChoiceCards<T extends string>({
  name,
  label,
  choices,
  value,
  onChange,
}: {
  name: string;
  label: string;
  choices: Choice<T>[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-col gap-2" role="radiogroup" aria-label={label}>
      {choices.map((c) => {
        const selected = value === c.value;
        return (
          <div key={c.value} className={`rounded-xl border ${selected ? "border-brand-500 bg-brand-50/60" : "border-zinc-200 hover:bg-zinc-50"}`}>
            <label className="flex cursor-pointer gap-3 p-3">
              <input
                type="radio"
                name={name}
                value={c.value}
                checked={selected}
                onChange={() => onChange(c.value)}
                className="mt-1 size-4 shrink-0 accent-brand-600"
              />
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-zinc-900">
                  {c.label}
                  {c.badge && <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[11px] font-semibold text-white">{c.badge}</span>}
                </span>
                <span className="mt-0.5 block text-sm text-zinc-600">{c.description}</span>
                {selected && c.example && <span className="mt-1.5 block text-sm text-brand-800">{c.example}</span>}
              </span>
            </label>
            {selected && c.extra && <div className="px-3 pb-3 pl-10">{c.extra}</div>}
          </div>
        );
      })}
    </div>
  );
}
