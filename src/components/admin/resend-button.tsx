"use client";

import { Loader2, RotateCw } from "lucide-react";
import { useState, useTransition } from "react";
import { resendNotificationAction } from "@/app/workspace/[id]/admin/notifications/actions";
import { measureAction } from "@/lib/perf/client";

// 실패한 알림 [재발송] (T11-4)
export function ResendButton({ logId }: { logId: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <span className="mt-2 flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await measureAction("admin.resend_notification", () => resendNotificationAction(logId));
            setMsg(r.ok ? { ok: r.result === "sent", text: r.result === "sent" ? "다시 보냈어요. 위에 새 기록이 생겼어요." : "다시 보냈지만 또 실패했어요. 받는 사람 번호를 확인해 주세요." } : { ok: false, text: r.error });
          })
        }
        className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-zinc-300 bg-white px-3 text-sm font-medium hover:bg-zinc-50 disabled:opacity-50"
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : <RotateCw className="size-4" />}
        재발송
      </button>
      {msg && <span className={`text-xs ${msg.ok ? "text-green-700" : "text-red-700"}`}>{msg.text}</span>}
    </span>
  );
}
