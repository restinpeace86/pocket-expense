"use client";

import { FileDown, Loader2 } from "lucide-react";
import { useParams } from "next/navigation";
import { useState } from "react";
import { leaveDocAction, requestDocAction } from "@/lib/company-forms/leave-doc-actions";

// 회사 양식 받기: 회사 양식 모양 PDF(브라우저에서 만듦)·엑셀(서버). 회사 양식으로 낸 신청에만 보인다
// 휴가신청서(8-104 C) · 근태 정정·휴일근무 신청서(9-33c). 결재란: 신청한 사람 · 승인한 사람(승인 전이면 "결재 전")
type Target = { kind: "leave" | "correction" | "holiday"; id: string };
const LABEL = { leave: "휴가신청서", correction: "근태 정정 신청서", holiday: "휴일근무 신청서" } as const;

export function FormDocButtons({ target, compact = false }: { target: Target; compact?: boolean }) {
  const { id } = useParams<{ id: string }>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const label = LABEL[target.kind];
  const leave = target.kind === "leave";
  const pdf = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = leave ? await leaveDocAction(id, target.id) : await requestDocAction(id, target.id);
      if (!r) throw new Error("none");
      const { buildDocPdf } = await import("@/lib/doc-convert/pdf-client");
      const bytes = await buildDocPdf(r.doc);
      const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `${r.fileName}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (e) {
      console.error("form-doc pdf", e);
      setError(`${label}를 만들지 못했어요. 잠시 뒤 다시 해 주세요.`);
    } finally {
      setBusy(false);
    }
  };
  const btn = `inline-flex items-center justify-center gap-1.5 rounded-xl border border-zinc-300 bg-white font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-60 ${compact ? "h-9 px-3 text-[13px]" : "h-11 flex-1 px-3 text-sm"}`;
  const xlsx = leave ? `/workspace/${id}/leave-doc/${target.id}/xlsx` : `/workspace/${id}/request-doc/${target.id}/xlsx`;
  return (
    <div className="flex flex-col gap-1" {...(leave ? { "data-leave-doc": target.id } : { "data-request-doc": target.id })}>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => void pdf()} disabled={busy} className={btn} {...(leave ? { "data-leave-pdf": "" } : { "data-request-pdf": "" })}>
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <FileDown className="size-4" aria-hidden />}
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
    </div>
  );
}

export function LeaveDocButtons({ leaveId, compact = false }: { leaveId: string; compact?: boolean }) {
  return <FormDocButtons target={{ kind: "leave", id: leaveId }} compact={compact} />;
}
