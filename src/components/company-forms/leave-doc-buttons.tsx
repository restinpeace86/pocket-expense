"use client";

import { Eye, FileDown, Loader2 } from "lucide-react";
import { useParams } from "next/navigation";
import { useState } from "react";
import type { DocModel } from "@/lib/doc-convert/model";
import { leaveDocAction, requestDocAction } from "@/lib/company-forms/leave-doc-actions";
import { FormDocDialog } from "./form-doc-dialog";

// 회사 양식 보기·받기: [양식 보기](화면에서 바로) · 회사 양식 모양 PDF(브라우저에서 만듦) · 엑셀(서버). 회사 양식으로 낸 신청에만 보인다
// 휴가신청서(8-104 C) · 근태 정정·휴일근무 신청서(9-33c). 결재란: 신청한 사람 · 승인한 사람(승인 전이면 "결재 전")
// [양식 보기](9-33e1, D-284): PDF·이미지를 만들지 않고 채운 표 데이터(수 KB)만 열 때 한 번 받아 그린다. PDF는 받은 표를 다시 쓴다
type Target = { kind: "leave" | "correction" | "holiday"; id: string };
type Loaded = { doc: DocModel; fileName: string };
const LABEL = { leave: "휴가신청서", correction: "근태 정정 신청서", holiday: "휴일근무 신청서" } as const;

export function FormDocButtons({ target, compact = false }: { target: Target; compact?: boolean }) {
  const { id } = useParams<{ id: string }>();
  const [busy, setBusy] = useState<"pdf" | "view" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [open, setOpen] = useState(false);
  const label = LABEL[target.kind];
  const leave = target.kind === "leave";
  const load = async (): Promise<Loaded> => {
    if (loaded) return loaded;
    const r = leave ? await leaveDocAction(id, target.id) : await requestDocAction(id, target.id);
    if (!r) throw new Error("none");
    setLoaded(r);
    return r;
  };
  const run = async (what: "pdf" | "view") => {
    setBusy(what);
    setError(null);
    try {
      const r = await load();
      if (what === "view") return setOpen(true);
      const { buildDocPdf } = await import("@/lib/doc-convert/pdf-client");
      const bytes = await buildDocPdf(r.doc);
      const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `${r.fileName}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (e) {
      console.error("form-doc", what, e);
      setError(`${label}를 ${what === "view" ? "열지" : "만들지"} 못했어요. 잠시 뒤 다시 해 주세요.`);
    } finally {
      setBusy(null);
    }
  };
  const btn = `inline-flex items-center justify-center gap-1.5 rounded-xl border border-zinc-300 bg-white font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-60 ${compact ? "h-9 px-3 text-[13px]" : "h-11 flex-1 px-3 text-sm"}`;
  const xlsx = leave ? `/workspace/${id}/leave-doc/${target.id}/xlsx` : `/workspace/${id}/request-doc/${target.id}/xlsx`;
  return (
    <div className="flex flex-col gap-1" {...(leave ? { "data-leave-doc": target.id } : { "data-request-doc": target.id })}>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => void run("view")} disabled={!!busy} className={`${btn} border-brand-300 text-brand-800`} data-form-view>
          {busy === "view" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Eye className="size-4" aria-hidden />}
          양식 보기
        </button>
        <button type="button" onClick={() => void run("pdf")} disabled={!!busy} className={btn} {...(leave ? { "data-leave-pdf": "" } : { "data-request-pdf": "" })}>
          {busy === "pdf" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <FileDown className="size-4" aria-hidden />}
          {label} PDF
        </button>
        <a href={xlsx} className={btn} {...(leave ? { "data-leave-xlsx": "" } : { "data-request-xlsx": "" })}>
          <FileDown className="size-4" aria-hidden />
          엑셀
        </a>
      </div>
      {error && (
        <p role="alert" className="text-[13px] font-semibold text-red-700">
          {error}
        </p>
      )}
      {open && loaded && <FormDocDialog title={label} doc={loaded.doc} onClose={() => setOpen(false)} onPdf={() => void run("pdf")} pdfBusy={busy === "pdf"} />}
    </div>
  );
}

export function LeaveDocButtons({ leaveId, compact = false }: { leaveId: string; compact?: boolean }) {
  return <FormDocButtons target={{ kind: "leave", id: leaveId }} compact={compact} />;
}
