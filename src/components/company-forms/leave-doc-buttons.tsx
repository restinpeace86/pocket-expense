"use client";

import { FileDown, Loader2 } from "lucide-react";
import { useParams } from "next/navigation";
import { useState } from "react";
import { leaveDocAction } from "@/lib/company-forms/leave-doc-actions";

// 휴가신청서 받기(8-104 C): 회사 양식 모양 PDF(브라우저에서 만듦)·엑셀(서버). 회사 양식으로 낸 휴가에만 보인다
// 결재란: 신청한 사람 · 승인한 사람(승인 전이면 "결재 전")
export function LeaveDocButtons({ leaveId, compact = false }: { leaveId: string; compact?: boolean }) {
  const { id } = useParams<{ id: string }>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pdf = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await leaveDocAction(id, leaveId);
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
      console.error("leave-doc pdf", e);
      setError("휴가신청서를 만들지 못했어요. 잠시 뒤 다시 해 주세요.");
    } finally {
      setBusy(false);
    }
  };
  const btn = `inline-flex items-center justify-center gap-1.5 rounded-xl border border-zinc-300 bg-white font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-60 ${compact ? "h-9 px-3 text-[13px]" : "h-11 flex-1 px-3 text-sm"}`;
  return (
    <div className="flex flex-col gap-1" data-leave-doc={leaveId}>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => void pdf()} disabled={busy} className={btn} data-leave-pdf>
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <FileDown className="size-4" aria-hidden />}
          휴가신청서 PDF
        </button>
        <a href={`/workspace/${id}/leave-doc/${leaveId}/xlsx`} className={btn} data-leave-xlsx>
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
