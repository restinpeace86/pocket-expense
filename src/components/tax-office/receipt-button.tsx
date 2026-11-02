"use client";

import { ExternalLink, FileImage, X } from "lucide-react";
import { useEffect, useState } from "react";

// 지출 표·카드의 [영수증 보기] — 새 탭이 아니라 화면 위 팝업(D-194와 같은 모양, D-197). PDF도 팝업 안에서. Esc·바깥 누르면 닫힘
export function ReceiptButton({ url, title, variant = "link" }: { url: string; title: string; variant?: "link" | "button" }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  const pdf = /\.pdf(\?|$)/i.test(url);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          variant === "button"
            ? "mt-1 inline-flex min-h-10 w-fit items-center gap-1.5 rounded-lg border border-zinc-300 px-3 text-sm"
            : "mt-0.5 inline-flex items-center gap-1 text-xs text-brand-700 underline underline-offset-2"
        }
      >
        <FileImage className={variant === "button" ? "size-4" : "size-3.5"} aria-hidden />
        영수증 보기
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950 text-white" role="dialog" aria-modal aria-label={`${title} 영수증`}>
          <div className="flex items-center gap-2 px-3 pb-2 pt-[calc(0.75rem+env(safe-area-inset-top))]">
            <span className="min-w-0 flex-1 truncate text-sm">{title}</span>
            <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-1 rounded-lg px-2 text-xs text-white/70 hover:bg-white/10" aria-label="새 창으로 열기">
              <ExternalLink className="size-4" aria-hidden />
              <span className="hidden sm:inline">새 창</span>
            </a>
            <button type="button" onClick={() => setOpen(false)} className="inline-flex size-11 items-center justify-center rounded-xl hover:bg-white/10" aria-label="닫기">
              <X className="size-5" />
            </button>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center px-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))]" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
            {pdf ? (
              <iframe src={url} title={`${title} 영수증`} className="size-full max-w-3xl rounded-lg bg-white" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- 서명 주소(10분) 원본을 그대로
              <img src={url} alt={`${title} 영수증`} className="max-h-full max-w-full rounded-lg object-contain" />
            )}
          </div>
        </div>
      )}
    </>
  );
}
