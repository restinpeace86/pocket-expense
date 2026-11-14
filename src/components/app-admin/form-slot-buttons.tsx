"use client";

import { useState, useTransition } from "react";
import { grantFormSlotAction as grantFormSlotActionRaw } from "@/app/app-admin/form-slots/actions";
import { guarded } from "@/lib/action-guard";

// 인터넷 끊김·서버 응답 없음에도 화면 전체가 오류로 바뀌지 않게(비정상 사용 점검 2026-11-14)
const grantFormSlotAction = guarded(grantFormSlotActionRaw);

// 회사 양식 추가 칸 +1 / −1 (8-104 B-4)
export function FormSlotButtons({ companyId, extra }: { companyId: string; extra: number }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (add: 1 | -1) => start(async () => setError((await grantFormSlotAction(companyId, add)).error));
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <span className="flex gap-2">
        <button type="button" disabled={pending || extra <= 0} onClick={() => run(-1)} className="min-h-11 rounded-lg border border-zinc-300 px-3 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-40">
          −1장
        </button>
        <button type="button" disabled={pending} onClick={() => run(1)} className="min-h-11 rounded-lg bg-emerald-600 px-3 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
          +1장 늘려 주기
        </button>
      </span>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}
