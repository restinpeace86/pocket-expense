"use client";

import { useState, useTransition } from "react";
import { setReviewDisplayedAction, setReviewFeaturedAction } from "@/app/app-admin/reviews/actions";

// 랜딩 후기 대표로 올리기/내리기(D-135) · 보이기/숨기기(D-130). eligible: 랜딩에 보일 수 있는 후기(10자 이상)
export function ReviewToggle({ id, displayed, featured, eligible }: { id: string; displayed: boolean; featured: boolean; eligible: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col items-end gap-1">
      {displayed && eligible && (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await setReviewFeaturedAction(id, !featured);
              setError(r.error);
            })
          }
          className={`min-h-11 whitespace-nowrap rounded-lg px-3 text-sm font-medium disabled:opacity-50 ${featured ? "bg-amber-100 text-amber-800 hover:bg-amber-200" : "border border-amber-300 text-amber-800 hover:bg-amber-50"}`}
        >
          {featured ? "★ 대표 후기 해제" : "☆ 대표 후기로 올리기"}
        </button>
      )}
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
