import { usagePct, usageTone } from "@/lib/vault/format";

// 보관 공간 막대: 70% 노랑·90% 빨강
export function UsageBar({ used, limit }: { used: number; limit: number }) {
  const pct = usagePct(used, limit);
  const tone = usageTone(pct);
  return (
    <div role="meter" aria-label="보관 공간 사용량" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} className="h-2 overflow-hidden rounded-full bg-zinc-200">
      <div className={`h-full ${tone === "full" ? "bg-red-600" : tone === "warn" ? "bg-amber-500" : "bg-brand-600"}`} style={{ width: `${pct}%` }} />
    </div>
  );
}
