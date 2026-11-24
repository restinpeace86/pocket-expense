"use client";

import { useState, useTransition } from "react";
import { deleteMyAccountAction } from "@/app/account/delete/actions";
import { VAULT_CACHE } from "@/lib/vault/format";

// 계정 삭제 확인(D-314): 체크 → [계정 삭제] → 한 번 더 확인. 실패하면 이유를 그대로 보여 준다
export function DeleteAccountForm() {
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-3" data-account-delete-form>
      <label className="flex min-h-11 items-start gap-2 text-sm text-zinc-700">
        <input type="checkbox" className="mt-0.5 size-5 shrink-0" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} data-account-delete-agree />
        <span className="break-keep">위 내용을 확인했어요. 계정을 지우면 되돌릴 수 없어요.</span>
      </label>
      <button
        type="button"
        disabled={!agreed || pending}
        onClick={() => {
          if (!confirm("계정을 삭제할까요?\n삭제하면 되돌릴 수 없어요.")) return;
          setError(null);
          start(async () => {
            try {
              void caches.delete(VAULT_CACHE);
            } catch {}
            const r = await deleteMyAccountAction();
            if (r?.error) setError(r.error);
          });
        }}
        className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-red-600 px-4 text-base font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
        data-account-delete
      >
        {pending ? "삭제하는 중..." : "계정 삭제"}
      </button>
      {error && (
        <p role="alert" className="break-keep rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" data-account-delete-error>
          {error}
        </p>
      )}
    </div>
  );
}
