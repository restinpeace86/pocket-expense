"use client";

import { Search, SlidersHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ClaimFilters } from "@/lib/claims/filters";
import { CATEGORY_LABEL, type ExpenseCategory } from "@/lib/expense/categories";

// 지출 승인 관리 공통 필터 (admin-expense-approvals.md §4.A): 월(항목 사용일자), 부서, 직원, 카테고리, 검색(제목·가맹점명)
const sel = "min-h-10 w-full rounded-lg border border-zinc-300 bg-white px-2 text-sm";

export function ClaimFiltersBar({
  filters,
  tab,
  base,
  departments,
  members,
}: {
  filters: ClaimFilters;
  tab: string;
  base: string;
  departments: { id: string; name: string }[];
  members: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [f, setF] = useState(filters);
  const active = Object.values(filters).filter(Boolean).length;
  const go = (next: ClaimFilters) => {
    const p = new URLSearchParams({ tab });
    for (const [k, v] of Object.entries(next)) if (v) p.set(k, v);
    router.push(`${base}?${p.toString()}`);
  };
  const set = <K extends keyof ClaimFilters>(k: K, v: ClaimFilters[K]) => setF((x) => ({ ...x, [k]: v }));

  return (
    <details className="group rounded-xl border border-zinc-200 bg-white" open={active > 0 || undefined}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
        <SlidersHorizontal className="size-4" />
        필터{active > 0 && <span className="rounded-full bg-brand-600 px-1.5 text-xs text-white">{active}</span>}
        <span className="ml-auto text-xs font-normal text-zinc-500 group-open:hidden">월·부서·직원·카테고리·검색</span>
      </summary>
      <form
        className="grid gap-2 border-t border-zinc-100 p-3"
        onSubmit={(e) => {
          e.preventDefault();
          go(f);
        }}
      >
        <label className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
          <input
            value={f.q ?? ""}
            onChange={(e) => set("q", e.target.value || null)}
            placeholder="제목·가맹점명 검색"
            aria-label="제목·가맹점명 검색"
            className="min-h-10 w-full rounded-lg border border-zinc-300 bg-white pl-8 pr-2 text-sm"
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <input type="month" aria-label="사용 월" value={f.month ?? ""} onChange={(e) => set("month", e.target.value || null)} className={`${sel} col-span-2`} />
          <select aria-label="카테고리" value={f.category ?? ""} onChange={(e) => set("category", (e.target.value || null) as ExpenseCategory | null)} className={sel}>
            <option value="">모든 카테고리</option>
            {(Object.keys(CATEGORY_LABEL) as ExpenseCategory[]).map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
          <select aria-label="부서" value={f.department ?? ""} onChange={(e) => set("department", e.target.value || null)} className={sel}>
            <option value="">모든 부서</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <select aria-label="직원" value={f.member ?? ""} onChange={(e) => set("member", e.target.value || null)} className={sel}>
            <option value="">모든 직원</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              const empty = { month: null, department: null, member: null, category: null, q: null };
              setF(empty);
              go(empty);
            }}
            className="min-h-10 rounded-lg border border-zinc-300 bg-white text-sm"
          >
            초기화
          </button>
          <button type="submit" className="min-h-10 rounded-lg bg-brand-600 text-sm font-semibold text-white">
            적용
          </button>
        </div>
        <p className="text-[11px] text-zinc-500">월은 영수증 사용일자 기준이에요.</p>
      </form>
    </details>
  );
}
