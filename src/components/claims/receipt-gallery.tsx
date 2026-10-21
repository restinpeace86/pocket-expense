"use client";

import { ChevronLeft, ChevronRight, FileText, Images, Loader2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { receiptOriginalUrlsAction } from "@/lib/claims/actions";
import type { DetailItem } from "@/lib/claims/types";
import { formatWon } from "@/lib/format";
import { classLabel, editedFields, itemName } from "./claim-items";

// [영수증 모아보기] (approver.md ①): 모든 영수증을 가로로 넘기며 확인. 각 장 아래에 핵심 값(가맹점·일자·금액·세부 유형)과 "직원 수정".
// 휴대폰은 손가락으로 밀어 넘기고(scroll-snap), PC는 [이전]·[다음] 버튼·키보드 ←→.
export function ReceiptGallery({ claimId, items, onClose }: { claimId: string; items: DetailItem[]; onClose: () => void }) {
  const [urls, setUrls] = useState<Record<string, string | null> | null>(null);
  const [index, setIndex] = useState(0);
  const track = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    receiptOriginalUrlsAction(claimId).then((r) => alive && setUrls(r.ok ? r.urls : {}));
    return () => {
      alive = false;
    };
  }, [claimId]);

  const go = (n: number) => {
    const el = track.current;
    if (!el) return;
    const i = Math.max(0, Math.min(items.length - 1, n));
    el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") go(index + 1);
      if (e.key === "ArrowLeft") go(index - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950 text-white" role="dialog" aria-modal aria-label="영수증 모아보기">
      <div className="flex items-center justify-between gap-2 px-4 pb-2 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <span className="text-sm tabular-nums" aria-live="polite">
          영수증 {index + 1} / {items.length}
        </span>
        <button type="button" onClick={onClose} className="inline-flex size-11 items-center justify-center rounded-xl hover:bg-white/10" aria-label="닫기">
          <X className="size-5" />
        </button>
      </div>
      <div
        ref={track}
        className="flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none]"
        onScroll={(e) => {
          const el = e.currentTarget;
          setIndex(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
        }}
      >
        {items.map((i) => {
          const url = urls?.[i.id] ?? null;
          const edited = editedFields(i);
          const isPdf = !!i.receipt_path?.endsWith(".pdf");
          return (
            <section key={i.id} className="flex w-full shrink-0 snap-center flex-col" aria-label={`${itemName(i, "항목")} 영수증`}>
              <div className="flex min-h-0 flex-1 items-center justify-center px-3">
                {!urls ? (
                  <Loader2 className="size-6 animate-spin text-white/60" />
                ) : !url ? (
                  <p className="text-sm text-white/70">{i.routeLabel ? "경로 요약은 상신 뒤에 만들어져요." : "영수증 없이 추가한 항목이에요."}</p>
                ) : isPdf ? (
                  <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-medium text-zinc-900">
                    <FileText className="size-5" /> PDF 영수증 새 창으로 열기
                  </a>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element -- 10분짜리 서명 링크
                  <img src={url} alt={`${itemName(i, "항목")} 영수증`} className="max-h-full max-w-full object-contain" />
                )}
              </div>
              <div className="flex flex-col gap-1 bg-black/60 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 text-sm">
                <p className="flex justify-between gap-2">
                  <span className="min-w-0 truncate font-semibold">{itemName(i, "가맹점 미입력")}</span>
                  <span className="shrink-0 font-semibold tabular-nums">{i.amount !== null ? formatWon(i.amount) : "-"}</span>
                </p>
                <p className="text-white/70">
                  {i.expense_date?.replaceAll("-", ".") ?? "날짜 없음"} · {classLabel(i)} · {i.payment_method === "corporate_card" ? "법인" : "개인(사비)"}
                </p>
                {edited.length > 0 && <p className="self-start rounded-full bg-violet-500/30 px-2 py-0.5 text-xs text-violet-100">직원 수정: {edited.join("·")}</p>}
              </div>
            </section>
          );
        })}
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-1/2 hidden -translate-y-1/2 justify-between px-2 md:flex">
        <button type="button" disabled={index === 0} onClick={() => go(index - 1)} className="pointer-events-auto inline-flex size-12 items-center justify-center rounded-full bg-white/15 hover:bg-white/25 disabled:opacity-30" aria-label="이전 영수증">
          <ChevronLeft className="size-6" />
        </button>
        <button type="button" disabled={index >= items.length - 1} onClick={() => go(index + 1)} className="pointer-events-auto inline-flex size-12 items-center justify-center rounded-full bg-white/15 hover:bg-white/25 disabled:opacity-30" aria-label="다음 영수증">
          <ChevronRight className="size-6" />
        </button>
      </div>
    </div>
  );
}

// 서버 화면(직원 결의서 상세)에서 쓰는 [영수증 모아보기] 버튼
export function GalleryButton({ claimId, items }: { claimId: string; items: DetailItem[] }) {
  const [open, setOpen] = useState(false);
  if (!items.length) return null;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-zinc-300 bg-white px-3 text-sm font-medium hover:bg-zinc-50">
        <Images className="size-4" /> 영수증 모아보기
      </button>
      {open && <ReceiptGallery claimId={claimId} items={items} onClose={() => setOpen(false)} />}
    </>
  );
}
