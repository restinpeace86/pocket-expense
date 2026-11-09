"use client";

import { Loader2, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { keepChatFileAction } from "@/app/workspace/[id]/employee/vault/actions";
import { bytesLabel, fileSizeLabel } from "@/lib/chat/format";
import type { createClient } from "@/lib/supabase/client";
import { fileBadge, usagePct, type VaultScope, type VaultStatus } from "@/lib/vault/format";
import { UsageBar } from "./usage-bar";

// 영구 보관 시트(D-245, 시안 ②⑤): 누가 볼 수 있나(나만 보기 기본) · 개인정보 경고 · 회사 보관 공간 · 다 찼을 때 안내
export function KeepSheet({
  supabase,
  ws,
  msg,
  onClose,
  onKept,
}: {
  supabase: ReturnType<typeof createClient>;
  ws: string;
  msg: { id: string; kind: "image" | "file"; name: string; size: number; from: string };
  onClose: () => void;
  onKept: (scope: VaultScope) => void;
}) {
  const [status, setStatus] = useState<VaultStatus | null>(null);
  const [days, setDays] = useState<number | null>(null);
  const [scope, setScope] = useState<VaultScope>("private");
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  useEffect(() => {
    void supabase.rpc("vault_status").then(({ data }) => data && setStatus(data as unknown as VaultStatus));
    void supabase.rpc("chat_storage_status").then(({ data }) => data && setDays(Number((data as { days?: number }).days) || null));
  }, [supabase]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const full = !!status && status.used + msg.size > status.limit;
  const save = () =>
    start(async () => {
      setError(null);
      const r = await keepChatFileAction(msg.id, scope);
      if (!r.ok) return setError(r.error);
      onKept(scope);
    });
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 md:items-center" onClick={onClose}>
      <section role="dialog" aria-modal="true" aria-labelledby="keep-title" onClick={(e) => e.stopPropagation()} className="flex max-h-[90dvh] w-full max-w-md flex-col gap-3 overflow-y-auto rounded-t-3xl bg-white px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-5 md:rounded-3xl" data-keep-sheet>
        <div className="flex items-center">
          <h2 id="keep-title" className="text-lg font-bold">
            영구 보관
          </h2>
          <button type="button" onClick={onClose} aria-label="닫기" className="ml-auto flex size-10 items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-100">
            <X className="size-5" />
          </button>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-zinc-200 px-3 py-2.5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-[11px] font-bold text-zinc-700">{fileBadge(msg.name, msg.kind)}</span>
          <span className="min-w-0 flex-1">
            <b className="block truncate text-sm">{msg.name}</b>
            <span className="text-xs text-zinc-600">
              {fileSizeLabel(msg.size)} · {msg.from}
            </span>
          </span>
        </div>
        {full ? (
          <div role="alert" className="flex flex-col gap-2 rounded-2xl border border-red-200 bg-red-50 p-3.5" data-keep-full>
            <b className="text-[15px] text-red-800">회사 보관 공간({bytesLabel(status!.limit)})이 다 찼어요</b>
            <UsageBar used={status!.used} limit={status!.limit} />
            <p className="text-[13px] leading-relaxed text-red-900">
              이 파일({fileSizeLabel(msg.size)})을 보관하려면 [파일 보관함]에서 필요 없는 파일을 지워 공간을 비워 주세요. 보관한 파일은 <b>자동으로 지워지지 않아요.</b>
            </p>
            <Link href={`${ws}/employee/vault`} className="flex h-11 items-center justify-center rounded-xl bg-brand-600 text-sm font-semibold text-white hover:bg-brand-700">
              파일 보관함에서 정리하기
            </Link>
          </div>
        ) : (
          <>
            <p className="text-[14px] leading-relaxed text-zinc-800">
              채팅의 사진·파일은 {days ? <b>{days}일</b> : "보관 기간"}이 지나면 자동으로 지워져요. 보관하면 [파일 보관함]에 복사돼 <b>지울 때까지</b> 남아요.
            </p>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-sm font-bold">누가 볼 수 있나요?</legend>
              {(
                [
                  ["private", "나만 보기", "나만 열 수 있어요. 나중에 회사 공유로 바꿀 수 있어요."],
                  ["company", "회사 공유", "우리 회사 직원 모두가 보고 받을 수 있어요."],
                ] as const
              ).map(([v, label, sub]) => (
                <label key={v} className={`flex cursor-pointer items-start gap-2.5 rounded-2xl border p-3 ${scope === v ? "border-2 border-brand-600 bg-brand-50" : "border-zinc-200"}`}>
                  <input type="radio" name="vault-scope" value={v} checked={scope === v} onChange={() => setScope(v)} className="mt-1 accent-brand-600" data-scope={v} />
                  <span>
                    <b className="text-[15px]">{label}</b>
                    <span className="block text-[13px] text-zinc-600">{sub}</span>
                  </span>
                </label>
              ))}
            </fieldset>
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[13px] leading-relaxed text-amber-950">
              진단서·급여명세서처럼 <b>개인정보가 있는 파일</b>은 회사 공유로 올리지 말아 주세요. 나만 보기 파일도 회사 공간을 함께 써서, 관리자는 <b>사람별 개수·용량</b>만 볼 수 있어요(파일 이름·내용은 못 봐요).
            </p>
            {status && (
              <div>
                <div className="mb-1 flex justify-between text-xs text-zinc-600">
                  <span>회사 보관 공간</span>
                  <span>
                    <b className="text-zinc-900">{bytesLabel(status.used)}</b> / {bytesLabel(status.limit)} ({usagePct(status.used, status.limit)}%)
                  </span>
                </div>
                <UsageBar used={status.used} limit={status.limit} />
              </div>
            )}
            {error && (
              <p role="alert" className="text-sm font-semibold text-red-700">
                {error}
              </p>
            )}
            <button type="button" onClick={save} disabled={busy} className="flex h-12 items-center justify-center gap-1.5 rounded-xl bg-brand-600 font-semibold text-white hover:bg-brand-700 disabled:opacity-70" data-keep-save>
              {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
              {scope === "private" ? "나만 보기로 보관" : "회사에 공유해 보관"}
            </button>
          </>
        )}
      </section>
    </div>
  );
}
