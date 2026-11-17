"use client";

import { Eye, FileDown, FileText, ImageIcon, Loader2 } from "lucide-react";
import { useState } from "react";
import { docFileUrlAction, docModelAction } from "@/app/workspace/[id]/employee/docs/actions";
import { FormDocDialog } from "@/components/company-forms/form-doc-dialog";
import { fileSizeLabel } from "@/lib/attendance/vacation";
import type { DocModel } from "@/lib/doc-convert/model";
import { STATUS_LABEL, STATUS_TONE, type DocFile, type DocStatus, type DocStep } from "@/lib/approval-docs/model";

// [결재 문서] 화면 조각(9-33e): 상태 칩 · 결재 진행(단계) · 첨부 · 양식 보기/PDF/엑셀
export function StatusChip({ status }: { status: DocStatus }) {
  return <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-xs font-semibold ${STATUS_TONE[status]}`}>{STATUS_LABEL[status]}</span>;
}

const when = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() + 9 * 3600_000).toISOString().slice(5, 16).replace("-", "/").replace("T", " ") : "");
const STEP_TEXT: Record<DocStep["status"], string> = { waiting: "기다림", pending: "지금 차례", approved: "확인", rejected: "반려", skipped: "건너뜀", canceled: "회수됨" };

// 결재 진행: 쓴 사람 → 검토자 → 관리자 최종. 지난 회차는 접어서
export function DocSteps({ writer, steps, round, submittedAt }: { writer: string; steps: DocStep[]; round: number; submittedAt: string | null }) {
  const cur = steps.filter((s) => s.round === round);
  const past = [...new Set(steps.filter((s) => s.round < round).map((s) => s.round))];
  const line = (list: DocStep[]) => (
    <ol className="flex flex-wrap items-center gap-1.5 text-[13px]">
      <li className="rounded-lg border border-green-300 bg-green-50 px-2 py-1 text-green-800">
        {writer} <span className="text-xs">쓴 사람</span>
      </li>
      {list.map((s) => {
        const who = s.step_kind === "final" ? (s.acted_by_name ?? "관리자") : (s.approver_name ?? s.acted_by_name ?? "검토자");
        const tone = s.status === "approved" ? "border-green-300 bg-green-50 text-green-800" : s.status === "pending" ? "border-brand-500 bg-brand-50 font-semibold text-brand-800" : s.status === "rejected" ? "border-red-300 bg-red-50 text-red-700" : "border-zinc-200 bg-white text-zinc-600";
        return (
          <li key={s.id} className="flex items-center gap-1.5">
            <span aria-hidden className="text-zinc-400">
              →
            </span>
            <span className={`rounded-lg border px-2 py-1 ${tone}`} data-step-status={s.status}>
              {who} <span className="text-xs">{s.step_kind === "final" ? "최종" : "검토"} · {STEP_TEXT[s.status]}</span>
              {s.acted_at && s.status !== "skipped" && <span className="block text-[11px] font-normal">{when(s.acted_at)}</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
  return (
    <section aria-label="결재 진행" className="flex flex-col gap-2 rounded-2xl border border-zinc-200 bg-white px-3.5 py-3" data-doc-steps>
      <h2 className="text-sm font-semibold">
        결재 진행 {round > 1 && <span className="font-normal text-zinc-500">· {round}회차</span>}
        {submittedAt && <span className="ml-1 text-xs font-normal text-zinc-500">{when(submittedAt)} 올림</span>}
      </h2>
      {cur.length ? line(cur) : <p className="text-[13px] text-zinc-600">아직 올리지 않았어요.</p>}
      {cur
        .filter((s) => s.comment)
        .map((s) => (
          <p key={s.id} className={`rounded-lg px-2.5 py-1.5 text-[13px] ${s.status === "rejected" ? "bg-red-50 text-red-800" : "bg-zinc-50 text-zinc-700"}`}>
            {s.step_kind === "final" ? (s.acted_by_name ?? "관리자") : (s.approver_name ?? "검토자")}: {s.comment}
          </p>
        ))}
      {past.length > 0 && (
        <details className="text-[13px] text-zinc-600">
          <summary className="cursor-pointer">지난 결재 {past.length}번</summary>
          <div className="mt-2 flex flex-col gap-2">
            {past.map((r) => (
              <div key={r} className="flex flex-col gap-1">
                <span className="text-xs text-zinc-500">{r}회차</span>
                {line(steps.filter((s) => s.round === r))}
                {steps
                  .filter((s) => s.round === r && s.comment)
                  .map((s) => (
                    <span key={s.id} className="text-xs">
                      {s.acted_by_name ?? s.approver_name}: {s.comment}
                    </span>
                  ))}
              </div>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}

export function DocFileList({ files, onRemove }: { files: DocFile[]; onRemove?: (f: DocFile) => void }) {
  const open = async (path: string) => {
    const w = window.open("", "_blank");
    const url = await docFileUrlAction(path);
    if (url && w) w.location.href = url;
    else w?.close();
  };
  if (!files.length) return null;
  return (
    <ul className="flex flex-col gap-1.5" data-doc-files>
      {files.map((f) => (
        <li key={f.id} className="flex min-w-0 items-center gap-2 rounded-xl border border-zinc-200 bg-white py-1.5 pl-2.5 pr-1 text-[13px]">
          {f.mime === "application/pdf" ? <FileText className="size-5 shrink-0 text-zinc-500" aria-hidden /> : <ImageIcon className="size-5 shrink-0 text-zinc-500" aria-hidden />}
          <button type="button" onClick={() => void open(f.path)} className="min-w-0 flex-1 truncate text-left font-semibold text-brand-700 hover:underline">
            {f.name}
          </button>
          <span className="shrink-0 text-xs text-zinc-500">{fileSizeLabel(f.size)}</span>
          {onRemove && (
            <button type="button" onClick={() => onRemove(f)} aria-label={`${f.name} 빼기`} className="flex size-9 shrink-0 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100">
              ✕
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

// 회사 양식 모양: [양식 보기] · PDF · 엑셀. 보기 전 저장이 필요하면 before()
export function DocFormButtons({ companyId, docId, before, xlsx = true }: { companyId: string; docId: string; before?: () => Promise<boolean>; xlsx?: boolean }) {
  const [busy, setBusy] = useState<"view" | "pdf" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shown, setShown] = useState<{ doc: DocModel; fileName: string; title: string } | null>(null);
  const load = async () => {
    if (before && !(await before())) throw new Error("save");
    const r = await docModelAction(companyId, docId);
    if (!r) throw new Error("none");
    return r;
  };
  const pdf = async (r: { doc: DocModel; fileName: string }) => {
    const { buildDocPdf } = await import("@/lib/doc-convert/pdf-client");
    const bytes = await buildDocPdf(r.doc);
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${r.fileName}.pdf`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };
  const run = async (what: "view" | "pdf") => {
    setBusy(what);
    setError(null);
    try {
      const r = shown && what === "pdf" ? shown : await load();
      if (what === "view") setShown(r);
      else await pdf(r);
    } catch (e) {
      console.error("approval-doc", what, e);
      setError(`회사 양식을 ${what === "view" ? "열지" : "만들지"} 못했어요. 잠시 뒤 다시 해 주세요.`);
    } finally {
      setBusy(null);
    }
  };
  const btn = "inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-60";
  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-2">
        <button type="button" onClick={() => void run("view")} disabled={!!busy} className={`${btn} border-brand-300 text-brand-800`} data-doc-view>
          {busy === "view" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Eye className="size-4" aria-hidden />}
          {before ? "미리보기" : "양식 보기"}
        </button>
        <button type="button" onClick={() => void run("pdf")} disabled={!!busy} className={btn} data-doc-pdf>
          {busy === "pdf" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <FileDown className="size-4" aria-hidden />}
          PDF
        </button>
        {xlsx && (
          <a href={`/workspace/${companyId}/approval-doc/${docId}/xlsx`} className={btn} data-doc-xlsx>
            <FileDown className="size-4" aria-hidden />
            엑셀
          </a>
        )}
      </div>
      {error && (
        <p role="alert" className="text-[13px] font-semibold text-red-700">
          {error}
        </p>
      )}
      {shown && <FormDocDialog title={shown.title} doc={shown.doc} onClose={() => setShown(null)} onPdf={() => void run("pdf")} pdfBusy={busy === "pdf"} />}
    </div>
  );
}
