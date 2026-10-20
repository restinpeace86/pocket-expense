"use client";

import { Gift, Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { acknowledgeEventBonusAction } from "@/app/workspace/[id]/admin/billing/actions";

// 이벤트 추가 지급 안내 (pricing-policy.md §5): 관리자 홈·요금제 화면 상단. [확인]하면 다음 지급 때까지 숨김
export function EventBonusBanner({ amount, count, total, preview = false }: { amount: number; count: number; total: number; preview?: boolean }) {
  const [hidden, setHidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (hidden) return null;
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 sm:flex-row sm:items-center" role="status">
      <Gift className="size-5 shrink-0 text-emerald-700" />
      <div className="flex-1">
        <p className="font-semibold">무료 영수증 {amount}장을 모두 사용했습니다. 현재 이벤트 기간이라 추가 {amount}장을 무료로 더 드립니다.</p>
        <p className="mt-0.5 text-emerald-800">
          이벤트 추가 지급 {count}회 (총 {total.toLocaleString("ko-KR")}장)
        </p>
        {error && <p className="mt-1 text-red-700">{error}</p>}
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            if (preview) return setHidden(true);
            const res = await acknowledgeEventBonusAction();
            if (res.error) setError(res.error);
            else setHidden(true);
          })
        }
        className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-emerald-700 px-4 font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
      >
        {pending && <Loader2 className="size-4 animate-spin" />}확인
      </button>
    </div>
  );
}
