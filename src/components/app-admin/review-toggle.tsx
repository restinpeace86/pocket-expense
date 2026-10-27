"use client";

import { useState, useTransition } from "react";
import { setReviewDisplayedAction } from "@/app/app-admin/reviews/actions";

// 랜딩 후기 보이기/숨기기 (D-130)
export function ReviewToggle({ id, displayed }: { id: string; displayed: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await setReviewDisplayedAction(id, !displayed);
            setError(r.error);
          })
        }
        className={`min-h-11 whitespace-nowrap rounded-lg px-3 text-sm font-medium disabled:opacity-50 ${displayed ? "border border-red-200 text-red-700 hover:bg-red-50" : "border border-zinc-300 text-zinc-700 hover:bg-zinc-50"}`}
      >
        {displayed ? "랜딩에서 숨기기" : "다시 보이기"}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}
