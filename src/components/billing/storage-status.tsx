"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { withdrawStorageAction } from "@/app/workspace/[id]/admin/billing/actions";
import { UsageBar } from "@/components/vault/usage-bar";
import { KIND_LABEL, type StorageStatus } from "@/lib/billing/storage";
import { bytesLabel } from "@/lib/chat/format";
import { formatWon } from "@/lib/format";

// 관리자 요금제 › 저장 공간(8-103, D-262): 지금 쓰는 양 · 추가 공간 · 확인 중인 신청([신청 취소]) · 지난 결과
// 신청·바꾸기·해지는 아래 요금제 카드의 [저장 공간 추가] 체크에서
export function StorageStatusCard({ status }: { status: StorageStatus }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const p = status.pending;
  const withdraw = () =>
    start(async () => {
      setErr(null);
      const r = await withdrawStorageAction();
      if (!r.ok) return setErr(r.error);
      router.refresh();
    });
  const day = (iso: string) => new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric" }).format(new Date(iso));
  return (
    <section id="storage" className="scroll-mt-20 rounded-xl border border-zinc-200 bg-white p-5" aria-labelledby="storage-title" data-storage-status>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="storage-title" className="font-semibold text-zinc-900">
          저장 공간
        </h2>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${status.extra_gb ? "bg-brand-50 text-brand-800" : "bg-zinc-100 text-zinc-600"}`} data-extra-gb={status.extra_gb}>
          {status.extra_gb ? `추가 공간 ${status.extra_gb}GB 사용 중` : "추가 공간 없음"}
        </span>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {[
          ["채팅 사진·파일", status.chat_used, status.chat_limit],
          ["파일 보관함", status.vault_used, status.vault_limit],
        ].map(([label, used, limit]) => (
          <div key={label as string}>
            <div className="mb-1 flex justify-between text-sm text-zinc-600">
              <span>{label}</span>
              <span className="tabular-nums">
                <b className="text-zinc-900">{bytesLabel(used as number)}</b> / {bytesLabel(limit as number)}
              </span>
            </div>
            <UsageBar used={used as number} limit={limit as number} />
          </div>
        ))}
      </div>
      <p className="mt-2 break-keep text-xs text-zinc-500">
        추가 공간은 채팅과 보관함이 함께 써요. 각자 기본 공간을 먼저 쓰고, 넘는 만큼 추가 공간에서 빠져요. 공간이 모자라면 아래 요금제 카드에서 [저장 공간 추가]를 골라 신청해 주세요.
        {status.extra_gb > 0 && " 결제가 열릴 때까지는 무료로 쓰고, 열리면 요금제와 함께 매월 결제돼요(한 달 전에 알려 드려요)."}
      </p>
      {p && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-900" data-storage-pending={p.kind}>
          <span>
            <b>{p.kind === "cancel" ? "추가 공간 해지" : `${p.storage_gb}GB ${KIND_LABEL[p.kind]}`}</b> 신청함 · 확인 중
            {p.monthly_price > 0 && <span className="tabular-nums"> (월 {formatWon(p.monthly_price)})</span>}
            <span className="block text-xs text-amber-800/80">
              {day(p.created_at)} {p.by ?? "관리자"} 신청 — 운영자가 확인하고 켜 드려요(보통 1영업일)
            </span>
          </span>
          <button type="button" onClick={withdraw} disabled={busy} className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-amber-300 bg-white px-3 text-sm font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-60" data-storage-withdraw>
            {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
            신청 취소
          </button>
        </div>
      )}
      {!p && status.last?.status === "rejected" && (
        <p className="mt-3 rounded-lg bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
          지난 신청이 반려됐어요{status.last.reject_reason ? `: ${status.last.reject_reason}` : ""}
        </p>
      )}
      {err && (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {err}
        </p>
      )}
    </section>
  );
}
