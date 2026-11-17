"use client";

import { Loader2, Plus } from "lucide-react";
import { useState } from "react";
import { createDocAction } from "@/app/workspace/[id]/employee/docs/actions";
import { guarded } from "@/lib/action-guard";

// [+ 새로 쓰기]: 작성 중 문서를 만들고 쓰기 화면으로(9-33e3)
const create = guarded(createDocAction);

export function NewDocButton({ companyId, formId, label = "새로 쓰기" }: { companyId: string; formId: string; label?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          const r = await create(companyId, formId);
          setBusy(false);
          if (r && !r.ok) setError(r.error);
        }}
        className="inline-flex h-11 items-center gap-1.5 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-70"
        data-doc-new={formId}
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" aria-hidden />}
        {label}
      </button>
      {error && (
        <p role="alert" className="text-[13px] font-semibold text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
