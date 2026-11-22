import type { ReactNode } from "react";

// "우리 회사에 적용하면" 한 칸(D-304, B-3): 바꾸는 칸 바로 아래, 모든 화면에서 같은 모양. 두 줄까지
export function ApplyPreview({ lines, title = "우리 회사에 적용하면", name }: { lines: ReactNode[]; title?: string; name: string }) {
  if (lines.length === 0) return null;
  return (
    <div className="flex flex-col gap-0.5 rounded-xl bg-brand-50 px-3 py-2.5 text-[13px] leading-relaxed text-brand-900" data-apply-preview={name} aria-live="polite">
      <span className="text-[11px] font-bold tracking-wide text-brand-700">{title}</span>
      {lines.slice(0, 2).map((l, i) => (
        <span key={i} className="break-words">
          {l}
        </span>
      ))}
    </div>
  );
}
