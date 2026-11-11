"use client";

import { ChevronDown, Info } from "lucide-react";
import type { ReactNode } from "react";

// 화면 설명(도움말) — spec/common/ui-rules.md §6 (D-065 → D-251)
// ① 한 줄 요약은 항상, ② 자세한 설명은 [ⓘ …]을 눌러 그 자리에서 펼침, ③ 예시는 선택한 항목에만(각 화면에서).
// D-251: 설명이 길어 설정할 칸이 아래로 밀려서, 처음에도 펼치지 않고 늘 접어 둔다. 대신 펼칠 수 있다는 게 눈에 띄게 알약 버튼으로
export function HelpDetails({ id, label = "설명 보기", children }: { id: string; label?: string; children: ReactNode }) {
  return (
    <details className="group mt-1.5" data-help={id}>
      <summary className="inline-flex min-h-9 cursor-pointer list-none items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-sm font-semibold text-brand-700 hover:bg-brand-100 [&::-webkit-details-marker]:hidden">
        <Info className="size-4 shrink-0" />
        {label}
        <ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" />
      </summary>
      <div className="mt-2 flex flex-col gap-2 rounded-xl bg-zinc-50 p-4 text-sm leading-relaxed text-zinc-700">{children}</div>
    </details>
  );
}

export function SectionHeading({
  title,
  summary,
  helpId,
  helpLabel,
  help,
  as: As = "h2",
}: {
  title: ReactNode;
  summary: ReactNode;
  helpId?: string;
  helpLabel?: string;
  help?: ReactNode;
  as?: "h1" | "h2";
}) {
  return (
    <div>
      <As className={As === "h1" ? "text-2xl font-bold tracking-tight" : "font-semibold"}>{title}</As>
      <p className={`mt-1 text-sm ${As === "h1" ? "text-zinc-600" : "text-zinc-700"}`}>{summary}</p>
      {help && helpId && (
        <HelpDetails id={helpId} label={helpLabel}>
          {help}
        </HelpDetails>
      )}
    </div>
  );
}
