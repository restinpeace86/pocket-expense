"use client";

import { FileDown, Loader2, X } from "lucide-react";
import { useEffect, useRef } from "react";
import type { DocModel } from "@/lib/doc-convert/model";
import { SheetView } from "./sheet-view";

// 채운 회사 양식을 화면에서 바로 보기(9-33e1, D-284). 휴가·근태 신청서와 [결재 문서] 상세가 같이 쓴다.
// 표 데이터만 그리므로 PDF·이미지를 받지 않는다. 휴대폰에선 표가 넓으면 옆으로 밀어 본다
const NO_LOOK = () => undefined;

export function FormDocDialog({ title, doc, onClose, onPdf, pdfBusy }: { title: string; doc: DocModel; onClose: () => void; onPdf?: () => void; pdfBusy?: boolean }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center" onClick={onClose}>
      <section role="dialog" aria-modal="true" aria-label={`${title} 보기`} onClick={(e) => e.stopPropagation()} className="flex max-h-[92dvh] w-full max-w-3xl flex-col gap-3 rounded-t-3xl bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] md:rounded-3xl" data-form-doc-dialog>
        <div className="flex items-center gap-2">
          <h2 className="min-w-0 flex-1 truncate text-lg font-bold">{title}</h2>
          {onPdf && (
            <button type="button" onClick={onPdf} disabled={pdfBusy} className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-zinc-300 px-3 text-[13px] font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-60">
              {pdfBusy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <FileDown className="size-4" aria-hidden />}
              PDF
            </button>
          )}
          <button ref={closeRef} type="button" onClick={onClose} aria-label="닫기" className="flex size-10 items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-100">
            <X className="size-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-zinc-200 bg-zinc-50 p-2" data-form-doc-body>
          {doc.sheets.map((sh, i) => (
            <div key={i} className="mb-3 last:mb-0">
              <SheetView sheet={sh} s={i} look={NO_LOOK} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
