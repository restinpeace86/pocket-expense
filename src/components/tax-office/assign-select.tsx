"use client";

import { useState, useTransition } from "react";
import { assignTaxAgentAction } from "@/app/tax-office/actions";
import { guardAction } from "@/lib/action-guard";

// 고객사 담당 세무사 배정(사무소 관리자) — 고르면 바로 저장
export function AssignSelect({ companyId, companyName, value, staff }: { companyId: string; companyName: string; value: string | null; staff: { id: string; name: string }[] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  return (
    <div className="flex flex-col gap-1">
      <label className="flex flex-wrap items-center gap-2 text-sm">
        <span className="shrink-0 text-zinc-500">담당 세무사</span>
        <select
          aria-label={`${companyName} 담당 세무사`}
          value={value ?? ""}
          disabled={pending}
          onChange={(e) => {
            const next = e.target.value || null;
            setError(null);
            setSaved(false);
            startTransition(async () => {
              const r = await guardAction(() => assignTaxAgentAction(companyId, next));
              if (r.error) setError(r.error);
              else setSaved(true);
            });
          }}
          className="min-h-11 min-w-0 flex-1 rounded-xl border border-zinc-300 bg-white px-3 text-base text-zinc-900 disabled:opacity-50"
        >
          <option value="">배정 안 함</option>
          {staff.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </label>
      {pending && <p className="text-xs text-zinc-500">저장하는 중…</p>}
      {saved && !pending && <p className="text-xs text-emerald-700">배정했어요.</p>}
      {error && (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
