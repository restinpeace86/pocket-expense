"use client";

import { VAULT_CACHE } from "@/lib/vault/format";

// 로그아웃: 기기에 저장한 보관 파일(D-245)도 지운다 — 같은 기기를 다른 사람이 쓸 수 있으므로
export function SignOutButton({ className }: { className?: string }) {
  return (
    <form
      action="/auth/signout"
      method="post"
      onSubmit={() => {
        try {
          void caches.delete(VAULT_CACHE);
        } catch {}
      }}
    >
      <button type="submit" className={className ?? "min-h-11 whitespace-nowrap px-1 text-sm text-zinc-500 underline underline-offset-2 hover:text-zinc-700"}>
        로그아웃
      </button>
    </form>
  );
}
