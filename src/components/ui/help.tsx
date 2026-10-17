"use client";

import { ChevronDown, Info } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

// 화면 설명(도움말) — spec/common/ui-rules.md §6 (D-065)
// ① 한 줄 요약은 항상, ② 자세한 설명은 [ⓘ …]을 눌러 그 자리에서 펼침, ③ 예시는 선택한 항목에만(각 화면에서).
// 처음 보는 브라우저에서는 ②를 한 번 펼쳐 보여 주고, 이후에는 접힌 상태로 둔다.
const SEEN_PREFIX = "pe-help-seen:";

export function HelpDetails({ id, label = "왜 필요한가요?", children }: { id: string; label?: string; children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    try {
      const key = SEEN_PREFIX + id;
      if (!window.localStorage.getItem(key)) {
        if (ref.current) ref.current.open = true;
        window.localStorage.setItem(key, "1");
      }
    } catch {
      // 저장소를 쓸 수 없으면 접힌 상태 그대로
    }
  }, [id]);

  return (
    <details ref={ref} className="group mt-1">
      <summary className="inline-flex min-h-9 cursor-pointer list-none items-center gap-1 rounded-lg text-sm font-medium text-blue-700 hover:text-blue-800 [&::-webkit-details-marker]:hidden">
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
