import type { ReactNode } from "react";

// 직원·가입 화면 공통 모바일 폭 컨테이너 (spec/common/ui-rules.md §1)
export function PageShell({ children }: { children: ReactNode }) {
  return <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-10">{children}</main>;
}

export function Card({ children }: { children: ReactNode }) {
  return <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">{children}</section>;
}

export const buttonPrimary =
  "inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-blue-600 px-4 text-base font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50";
export const buttonSecondary =
  "inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-zinc-300 bg-white px-4 text-base font-medium text-zinc-800 hover:bg-zinc-50";
export const inputClass =
  "min-h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 text-base text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none";
