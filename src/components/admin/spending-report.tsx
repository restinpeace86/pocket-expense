"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";

export type SpendingItem = { id: string; date: string; merchant: string; member: string; amount: number; overridden: boolean };
export type SpendingGroup = { key: string; name: string; code: string | null; amount: number; items: SpendingItem[] };

const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;

// 월별 지출 현황 — 계정과목별 합계(막대) → 누르면 그 계정으로 세무사무소에 넘어간 영수증 목록. 읽기 전용(D-160, 개선사항 3)
export function SpendingReport({ groups, total }: { groups: SpendingGroup[]; total: number }) {
  const [open, setOpen] = useState<string | null>(null);
  const max = Math.max(1, ...groups.map((g) => g.amount));
  return (
    <ul className="flex flex-col divide-y divide-zinc-100">
      {groups.map((g) => {
        const pct = total ? Math.round((g.amount / total) * 1000) / 10 : 0;
        const isOpen = open === g.key;
        return (
          <li key={g.key} className="min-w-0">
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : g.key)}
              aria-expanded={isOpen}
              title={`${g.name}: ${won(g.amount)} (${pct}%, ${g.items.length}건)`}
              className="flex w-full min-w-0 flex-col gap-1.5 px-1 py-3 text-left hover:bg-zinc-50"
            >
              <span className="flex w-full min-w-0 items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-sm font-medium text-zinc-900">
                  {g.name}
                  {g.code && <span className="ml-1 text-xs font-normal text-zinc-500">({g.code})</span>}
                </span>
                <span className="flex shrink-0 items-center gap-1 text-sm tabular-nums text-zinc-900">
                  <b>{won(g.amount)}</b>
                  <span className="text-xs text-zinc-500">
                    {pct}% · {g.items.length}건
                  </span>
                  <ChevronDown className={`size-4 text-zinc-400 transition-transform ${isOpen ? "rotate-180" : ""}`} aria-hidden />
                </span>
              </span>
              <span className="block h-2 w-full overflow-hidden rounded-full bg-zinc-100" aria-hidden>
                <span className="block h-full rounded-full bg-brand-500" style={{ width: `${Math.max(2, (g.amount / max) * 100)}%` }} />
              </span>
            </button>
            {isOpen && (
              <div className="mb-3 overflow-x-auto rounded-lg border border-zinc-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-zinc-50 text-xs text-zinc-500">
                    <tr>
                      <th className="whitespace-nowrap px-2 py-1.5 text-left font-medium">사용일</th>
                      <th className="whitespace-nowrap px-2 py-1.5 text-left font-medium">사용처</th>
                      <th className="whitespace-nowrap px-2 py-1.5 text-left font-medium">사용자</th>
                      <th className="whitespace-nowrap px-2 py-1.5 text-right font-medium">금액</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.items.map((i) => (
                      <tr key={i.id} className="border-t border-zinc-100">
                        <td className="whitespace-nowrap px-2 py-1.5 tabular-nums">{i.date}</td>
                        <td className="min-w-32 px-2 py-1.5">
                          {i.merchant}
                          {i.overridden && <span className="ml-1 whitespace-nowrap rounded bg-amber-50 px-1 text-xs text-amber-800">영수증별 조정</span>}
                        </td>
                        <td className="whitespace-nowrap px-2 py-1.5">{i.member}</td>
                        <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums">{won(i.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
