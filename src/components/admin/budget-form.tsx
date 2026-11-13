"use client";

import { Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { saveBudgetAction } from "@/app/workspace/[id]/admin/settings/budget/actions";
import { parseBudgetInput } from "@/lib/budget/format";

type Title = { id: string; name: string; budget: number | null; spent: number };

const fmt = (n: number | null) => (n ? n.toLocaleString("ko-KR") : "");

// 예산 정하기(D-267): 회사 전체 월 예산 + 계정과목별(넣고 싶은 것만). 빈 칸 = 그 예산 없음
export function BudgetForm({ total, titles, disabled }: { total: number | null; titles: Title[]; disabled: boolean }) {
  const [totalText, setTotalText] = useState(fmt(total));
  const [texts, setTexts] = useState<Record<string, string>>(() => Object.fromEntries(titles.map((t) => [t.id, fmt(t.budget)])));
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, start] = useTransition();

  const tv = parseBudgetInput(totalText);
  const bad = new Set<string>([...(tv === "invalid" ? ["total"] : []), ...titles.filter((t) => parseBudgetInput(texts[t.id] ?? "") === "invalid").map((t) => t.id)]);

  const save = () =>
    start(async () => {
      setMsg(null);
      if (bad.size) return setMsg({ ok: false, text: "금액은 숫자로 적어 주세요(예: 4,000,000). 빈 칸은 예산 없음이에요." });
      const list = titles.flatMap((t) => {
        const v = parseBudgetInput(texts[t.id] ?? "");
        return typeof v === "number" ? [{ account_title_id: t.id, amount: v }] : [];
      });
      const r = await saveBudgetAction(tv as number | null, list);
      setMsg(r.ok ? { ok: true, text: "예산을 저장했어요. 이번 달부터 80%·100%에서 알려 드려요." } : { ok: false, text: r.error ?? "저장하지 못했어요." });
    });

  const input = (invalid: boolean) =>
    `h-11 w-full rounded-lg border px-3 text-right text-base tabular-nums md:text-sm ${invalid ? "border-red-400 bg-red-50" : "border-zinc-300 bg-white"} disabled:bg-zinc-100`;

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm md:p-5" aria-labelledby="budget-form-title" data-budget-form>
      <h2 id="budget-form-title" className="font-semibold">
        예산 정하기
      </h2>
      <p className="mt-1 text-sm text-zinc-600">빈 칸은 예산 없음이에요. 예산이 없는 항목은 쓴 만큼만 보여 주고 알림은 가지 않아요.</p>
      <label className="mt-4 flex flex-col gap-1.5">
        <span className="text-sm font-semibold text-zinc-900">회사 전체 월 예산</span>
        <span className="flex items-center gap-2">
          <input inputMode="numeric" value={totalText} onChange={(e) => setTotalText(e.target.value)} placeholder="예: 4,000,000" disabled={disabled} className={input(bad.has("total"))} aria-invalid={bad.has("total")} data-budget-total />
          <span className="shrink-0 text-sm text-zinc-600">원</span>
        </span>
      </label>
      <p className="mt-5 text-sm font-semibold text-zinc-900">계정과목별 월 예산 (넣고 싶은 것만)</p>
      {titles.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-500">계정과목이 아직 없어요. 계정과목을 먼저 정하면 여기에 나와요.</p>
      ) : (
        <ul className="mt-2 grid gap-2 md:grid-cols-2">
          {titles.map((t) => (
            <li key={t.id}>
              <label className="flex items-center gap-2">
                <span className="w-28 shrink-0 truncate text-sm text-zinc-800 md:w-32" title={t.name}>
                  {t.name}
                </span>
                <input
                  inputMode="numeric"
                  value={texts[t.id] ?? ""}
                  onChange={(e) => setTexts((x) => ({ ...x, [t.id]: e.target.value }))}
                  placeholder={t.spent ? `이번 달 ${t.spent.toLocaleString("ko-KR")}원 씀` : "예산 없음"}
                  disabled={disabled}
                  className={input(bad.has(t.id))}
                  aria-invalid={bad.has(t.id)}
                  aria-label={`${t.name} 월 예산`}
                  data-budget-title={t.name}
                />
                <span className="shrink-0 text-sm text-zinc-600">원</span>
              </label>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button type="button" onClick={save} disabled={disabled || busy} className="flex min-h-11 items-center gap-1.5 rounded-xl bg-brand-600 px-5 font-semibold text-white hover:bg-brand-700 disabled:opacity-50" data-budget-save>
          {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
          저장
        </button>
        {msg && (
          <p role={msg.ok ? "status" : "alert"} className={`text-sm ${msg.ok ? "text-emerald-700" : "text-red-700"}`}>
            {msg.text}
          </p>
        )}
      </div>
    </section>
  );
}
