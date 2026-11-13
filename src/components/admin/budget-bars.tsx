import { formatWon } from "@/lib/format";
import { budgetPct, budgetTone, type BudgetStatus } from "@/lib/budget/format";

// 예산 막대(D-267): 예산이 있으면 "쓴 돈 / 예산 · n%" + 색(80% 주황·100% 빨강), 없으면 쓴 만큼만(회색 막대 없음)
const TONE_BAR = { none: "bg-zinc-300", ok: "bg-brand-600", warn: "bg-amber-500", over: "bg-red-600" } as const;
const TONE_TEXT = { none: "text-zinc-700", ok: "text-zinc-800", warn: "text-amber-800", over: "text-red-700" } as const;

function Row({ name, spent, budget, strong = false }: { name: string; spent: number; budget: number | null; strong?: boolean }) {
  const pct = budgetPct(spent, budget);
  const tone = budgetTone(pct);
  return (
    <li className="flex flex-col gap-1" data-budget-row={name} data-budget-pct={pct ?? ""}>
      <span className="flex items-baseline justify-between gap-2 text-sm">
        <span className={`min-w-0 truncate ${strong ? "font-semibold text-zinc-900" : "text-zinc-800"}`}>{name}</span>
        <span className={`shrink-0 tabular-nums ${TONE_TEXT[tone]}`}>
          {formatWon(spent)}
          {budget ? (
            <>
              <span className="text-zinc-500"> / {formatWon(budget)}</span> · <b>{pct}%</b>
            </>
          ) : null}
        </span>
      </span>
      {budget ? (
        <span className="h-2 overflow-hidden rounded-full bg-zinc-100" aria-hidden>
          <span className={`block h-full rounded-full ${TONE_BAR[tone]}`} style={{ width: `${Math.min(100, pct ?? 0)}%` }} />
        </span>
      ) : null}
    </li>
  );
}

export function BudgetBars({ status, limit }: { status: BudgetStatus; limit?: number }) {
  const titles = limit ? status.titles.slice(0, limit) : status.titles;
  return (
    <ul className="flex flex-col gap-3" aria-label="예산 현황">
      <Row name="회사 전체" spent={status.total_spent} budget={status.total_budget} strong />
      {titles.map((t) => (
        <Row key={t.account_title_id} name={t.name} spent={t.spent} budget={t.budget} />
      ))}
      {!limit && status.unmapped_spent > 0 && <Row name="계정과목 미정" spent={status.unmapped_spent} budget={null} />}
    </ul>
  );
}
