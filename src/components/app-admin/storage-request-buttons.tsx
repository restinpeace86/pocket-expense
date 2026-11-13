"use client";

import { useState, useTransition } from "react";
import { grantStorageAction, rejectStorageAction } from "@/app/app-admin/storage/actions";

// 운영자: 저장 공간 신청 [켜기]·[반려](사유) — 8-103
export function StorageRequestButtons({ id, label }: { id: string; label: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  return (
    <span className="inline-flex flex-col items-end gap-1.5">
      {rejecting ? (
        <span className="flex flex-wrap justify-end gap-2">
          <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} placeholder="반려 사유" aria-label="반려 사유" className="min-h-11 w-56 rounded-lg border border-zinc-300 px-3 text-sm" />
          <button type="button" disabled={pending || !reason.trim()} onClick={() => start(async () => setError((await rejectStorageAction(id, reason)).error))} className="min-h-11 rounded-lg bg-zinc-800 px-3 text-sm font-medium text-white disabled:opacity-40" data-storage-reject-confirm>
            반려
          </button>
          <button type="button" onClick={() => setRejecting(false)} className="min-h-11 rounded-lg border border-zinc-300 px-3 text-sm">
            취소
          </button>
        </span>
      ) : (
        <span className="flex gap-2">
          <button type="button" disabled={pending} onClick={() => setRejecting(true)} className="min-h-11 rounded-lg border border-zinc-300 px-3 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-40">
            반려
          </button>
          <button type="button" disabled={pending} onClick={() => start(async () => setError((await grantStorageAction(id)).error))} className="min-h-11 rounded-lg bg-emerald-600 px-3 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50" data-storage-grant>
            {label}
          </button>
        </span>
      )}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}
