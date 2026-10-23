"use client";

import { FileText, Loader2 } from "lucide-react";
import { useState } from "react";
import { claimDocumentAction } from "@/app/workspace/[id]/admin/form-template/actions";

// 결의서 한 건을 회사 양식으로 PDF 내려받기(관리자, D-118). 영수증 원본은 [영수증 모아보기]·세무 마감 ZIP에서
export function ClaimPdfButton({ claimId }: { claimId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await claimDocumentAction(claimId);
      if (!r.ok) return setError(r.error);
      const [{ buildClaimsPdf }, { saveBlob }] = await Promise.all([import("@/lib/tax/pdf-client"), import("@/lib/tax/zip-client")]);
      const pdf = await buildClaimsPdf({ docs: [r.doc], companyName: r.companyName, layout: r.layout });
      const name = `지출결의서_${(r.doc.title || "결의서").replace(/[\\/:*?"<>|\s]/g, "").slice(0, 30)}_${r.doc.id.slice(0, 8)}.pdf`;
      saveBlob(new Blob([pdf as BlobPart], { type: "application/pdf" }), name);
    } catch {
      setError("PDF를 만들지 못했어요(글꼴을 받지 못함). 잠시 후 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <button type="button" onClick={run} disabled={busy} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-zinc-300 bg-white px-3 text-sm font-medium hover:bg-zinc-50 disabled:opacity-60">
        {busy ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />} 지출결의서 PDF
      </button>
      {error && (
        <p className="w-full text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
