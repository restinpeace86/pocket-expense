"use client";

import { FileSpreadsheet, Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

// 서류 → 엑셀 변환 확인(8-104 A②). 크레딧은 보여 주지 않는다(2026-11-11 사용자 결정) — 파일·업무 서류 안내·[변환하기]만
export function ConvertSheet({
  ws,
  name,
  from,
  run,
  onClose,
}: {
  ws: string;
  name: string;
  from: string;
  run: () => Promise<{ ok: true; id: string } | { ok: false; error: string }>;
  onClose: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, busy]);
  const go = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await run();
      if (!r.ok) {
        setError(r.error);
        setBusy(false);
        return;
      }
      router.push(`${ws}/employee/convert/${r.id}`);
    } catch {
      setError("잠시 후 다시 시도해 주세요.");
      setBusy(false);
    }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 md:items-center" onClick={() => !busy && onClose()}>
      <section role="dialog" aria-modal="true" aria-labelledby="convert-title" onClick={(e) => e.stopPropagation()} className="flex w-full max-w-md flex-col gap-3.5 rounded-t-3xl bg-white px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-5 md:rounded-3xl" data-convert-sheet>
        <div className="flex items-center">
          <h2 id="convert-title" className="text-lg font-bold">
            엑셀로 변환
          </h2>
          <button type="button" onClick={onClose} disabled={busy} aria-label="닫기" className="ml-auto flex size-10 items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-100 disabled:opacity-40">
            <X className="size-5" />
          </button>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-zinc-200 px-3 py-2.5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-brand-700">
            <FileSpreadsheet className="size-5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <b className="block truncate text-sm">{name}</b>
            <span className="block truncate text-xs text-zinc-600">{from}</span>
          </span>
        </div>
        {busy ? (
          <p role="status" className="flex items-center gap-2 rounded-2xl bg-brand-50 px-3.5 py-3 text-[14px] text-brand-900" data-convert-busy>
            <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
            AI가 표로 바꾸는 중이에요. 10~30초쯤 걸려요.
          </p>
        ) : (
          <>
            <p className="text-[14px] leading-relaxed text-zinc-800">
              AI가 <b>표 모양 그대로</b> 엑셀로 바꿔요. 바꾼 뒤 앱에서 확인하고 글자를 고칠 수 있어요(고치기는 PC). 칸 합치기·서식까지 손보려면 [엑셀 받기] 후 엑셀에서 고치면 돼요.
            </p>
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[13px] text-amber-900">회사 업무 서류만 변환해 주세요. 개인 서류는 피해 주세요.</p>
          </>
        )}
        {error && (
          <p role="alert" className="rounded-xl bg-red-50 px-3 py-2.5 text-[13px] text-red-800" data-convert-error>
            {error}
          </p>
        )}
        <button type="button" onClick={() => void go()} disabled={busy} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-brand-600 text-[15px] font-bold text-white hover:bg-brand-700 disabled:opacity-60" data-convert-go>
          {busy ? "바꾸는 중…" : "변환하기"}
        </button>
      </section>
    </div>
  );
}
