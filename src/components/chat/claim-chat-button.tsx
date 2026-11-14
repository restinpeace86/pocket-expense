"use client";

import { Loader2, MessageCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { openClaimChatAction as openClaimChatActionRaw } from "@/app/workspace/[id]/chat/actions";
import { guarded } from "@/lib/action-guard";

// 인터넷 끊김·서버 응답 없음에도 화면 전체가 오류로 바뀌지 않게(비정상 사용 점검 2026-11-14)
const openClaimChatAction = guarded(openClaimChatActionRaw);

// 소명서 화면 [대화하기](D-203): 이 소명서에 붙은 대화방으로(없으면 만들고 나 + 작성자가 들어감)
export function ClaimChatButton({ companyId, claimId }: { companyId: string; claimId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col items-end">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const r = await openClaimChatAction(claimId);
            if ("error" in r) return setError(r.error);
            router.push(`/workspace/${companyId}/chat/${r.roomId}`);
          })
        }
        className="inline-flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-xl border border-[var(--chat-mine-border)] bg-[var(--chat-mine)] px-3 text-sm font-semibold text-[var(--chat-mine-fg)] hover:brightness-95 disabled:opacity-60"
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : <MessageCircle className="size-4" />}이 건으로 대화
      </button>
      {error && <span role="alert" className="mt-1 text-xs text-red-600">{error}</span>}
    </span>
  );
}
