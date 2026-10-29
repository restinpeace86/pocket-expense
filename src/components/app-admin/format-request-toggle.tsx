"use client";

import { useState, useTransition } from "react";
import { setFormatRequestDoneAction } from "@/app/app-admin/format-requests/actions";

// 회계 양식 접수 '준비 완료' 표시·되돌리기 (D-180)
export function FormatRequestToggle({ id, done }: { id: string; done: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await setFormatRequestDoneAction(id, !done);
            setError(r.error);
          })
        }
        className={`min-h-11 whitespace-nowrap rounded-lg px-3 text-sm font-medium disabled:opacity-50 ${done ? "border border-zinc-300 text-zinc-700 hover:bg-zinc-50" : "bg-emerald-600 text-white hover:bg-emerald-700"}`}
      >
        {done ? "접수됨으로 되돌리기" : "준비 완료로 표시"}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}
