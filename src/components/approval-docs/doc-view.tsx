"use client";

import { Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { decideDocAction, recallDocAction } from "@/app/workspace/[id]/employee/docs/actions";
import { guarded } from "@/lib/action-guard";
import { stdField } from "@/lib/company-forms/doc-types";
import type { Field } from "@/lib/company-forms/model";
import { displayValue, inputFields, won, type DocFile, type DocRow, type DocStep, type Payload } from "@/lib/approval-docs/model";
import { cleanRows, tableCellText, tableTotal } from "@/lib/company-forms/table";
import { DocFileList, DocFormButtons, DocSteps, StatusChip } from "./doc-shared";

// [결재 문서] 보기(9-33e3·e4): 올린 뒤 쓴 사람·검토자·관리자가 보는 화면. 내 차례면 아래에 승인/반려, 내 문서면 회수(첫 결재 전까지)
const decide = guarded(decideDocAction);
const recall = guarded(recallDocAction);

export function DocView({
  companyId,
  doc,
  fields,
  steps,
  files,
  can,
}: {
  companyId: string;
  doc: DocRow & { payload: Payload };
  fields: Field[];
  steps: DocStep[];
  files: DocFile[];
  can: { recall: boolean; decide: "review" | "final" | null };
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"ok" | "no" | "recall" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [comment, setComment] = useState("");

  const act = async (approve: boolean) => {
    setBusy(approve ? "ok" : "no");
    setError(null);
    const r = await decide(doc.id, approve, approve ? comment.trim() || null : reason.trim());
    setBusy(null);
    if (!r.ok) {
      setError(r.error);
      router.refresh(); // 이미 처리됐으면 새 상태로
      return;
    }
    setRejecting(false);
    router.refresh();
  };
  const doRecall = async () => {
    if (!window.confirm("결재를 회수할까요? 작성 중으로 돌아가 고쳐서 다시 올릴 수 있어요.")) return;
    setBusy("recall");
    const r = await recall(doc.id);
    setBusy(null);
    if (!r.ok) setError(r.error);
    router.refresh();
  };

  const rows = inputFields(fields).map((f) => ({
    key: f.key,
    label: f.label.trim() || (f.b.k === "input" && stdField(doc.doc_type, f.b.std)?.label) || "입력",
    value: f.b.k === "input" ? (f.b.type === "check" ? (doc.payload[f.key] === "Y" ? "예" : "") : displayValue(f.b.type, doc.payload[f.key])) : "",
    table: f.b.k === "input" && f.b.type === "table" ? { cols: f.b.cols ?? [], rows: cleanRows(Array.isArray(doc.payload[f.key]) ? (doc.payload[f.key] as string[][]) : []) } : null,
  }));
  return (
    <div className="flex flex-col gap-4" data-doc-view-page={doc.id} data-status={doc.status}>
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <StatusChip status={doc.status} />
          <span className="text-[13px] text-zinc-600">{doc.form_name}</span>
        </div>
        <h1 className="break-words text-xl font-bold tracking-tight">{doc.title}</h1>
        <p className="text-[13px] text-zinc-600">
          {doc.member_name}
          {doc.amount !== null && ` · ${won(doc.amount)}`} · {doc.progress}
        </p>
      </header>

      {doc.status === "rejected" && doc.rejection_reason && (
        <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-800">
          <b>반려 사유</b> · {doc.rejection_reason}
        </p>
      )}

      <DocSteps writer={doc.member_name} steps={steps} round={doc.current_round} submittedAt={doc.submitted_at} />

      <section aria-label="내용" className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
        <dl className="divide-y divide-zinc-100 text-sm">
          {rows.map((r) => (
            <div key={r.key} className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-2 px-3.5 py-2.5">
              <dt className="text-zinc-600">{r.label}</dt>
              {r.table ? (
                <dd className="col-span-2 overflow-x-auto" data-view-table>
                  <table className="w-full min-w-[20rem] border-collapse text-[13px]">
                    <thead>
                      <tr>
                        {r.table.cols.map((k) => (
                          <th key={k.c} className="border-b border-zinc-200 px-1.5 py-1 text-left font-medium text-zinc-600">
                            {k.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {r.table.rows.map((row, y) => (
                        <tr key={y}>
                          {r.table!.cols.map((k, i) => (
                            <td key={k.c} className={`border-b border-zinc-100 px-1.5 py-1 ${k.type !== "text" ? "text-right tabular-nums" : ""}`}>
                              {tableCellText(k.type, row[i] ?? "")}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {(() => {
                    const t = tableTotal(r.table.cols, r.table.rows);
                    return t !== null ? <p className="mt-1 text-right text-[13px]">합계 <b>{won(t)}</b></p> : null;
                  })()}
                </dd>
              ) : (
                <dd className="whitespace-pre-wrap break-words">{r.value || <span className="text-zinc-400">—</span>}</dd>
              )}
            </div>
          ))}
          {!rows.length && <p className="px-3.5 py-3 text-[13px] text-zinc-600">직원이 적는 칸이 없는 양식이에요. [양식 보기]로 확인하세요.</p>}
        </dl>
      </section>

      {files.length > 0 && (
        <section aria-label="첨부" className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold">첨부 {files.length}개</h2>
          <DocFileList files={files} />
        </section>
      )}

      <DocFormButtons companyId={companyId} docId={doc.id} />

      {error && (
        <p role="alert" className="text-sm font-semibold text-red-700" data-doc-error>
          {error}
        </p>
      )}

      {can.recall && (
        <button type="button" onClick={() => void doRecall()} disabled={!!busy} className="flex h-12 items-center justify-center gap-1.5 rounded-xl border border-zinc-300 text-sm font-semibold text-zinc-800 hover:bg-zinc-50" data-doc-recall>
          {busy === "recall" && <Loader2 className="size-4 animate-spin" />}
          회수하기 <span className="font-normal text-zinc-500">(첫 결재자가 보기 전까지)</span>
        </button>
      )}

      {can.decide && (
        <section aria-label="결재하기" className="flex flex-col gap-2 rounded-2xl border border-brand-200 bg-brand-50/50 p-3.5" data-doc-decide={can.decide}>
          <h2 className="text-sm font-semibold">{can.decide === "review" ? "내 검토 차례예요" : "최종 승인 차례예요"}</h2>
          <input value={comment} onChange={(e) => setComment(e.target.value)} maxLength={300} placeholder="한마디(선택)" className="h-11 rounded-xl border border-zinc-300 bg-white px-3 text-[15px] outline-none focus:border-brand-600" aria-label="승인 의견(선택)" />
          <div className="flex gap-2">
            <button type="button" onClick={() => (setRejecting(true), setReason(""))} disabled={!!busy} className="h-12 flex-1 rounded-xl border border-zinc-300 bg-white text-sm font-semibold text-red-700 hover:bg-zinc-50" data-doc-reject>
              반려
            </button>
            <button type="button" onClick={() => void act(true)} disabled={!!busy} className="flex h-12 flex-[2] items-center justify-center gap-1.5 rounded-xl bg-brand-600 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-70" data-doc-approve>
              {busy === "ok" && <Loader2 className="size-4 animate-spin" />}
              {can.decide === "review" ? "확인 → 다음 결재로" : "최종 승인"}
            </button>
          </div>
        </section>
      )}

      {rejecting && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center" onClick={() => setRejecting(false)}>
          <section role="dialog" aria-modal="true" aria-labelledby="doc-reject-title" onClick={(e) => e.stopPropagation()} className="flex w-full max-w-md flex-col gap-2.5 rounded-t-3xl bg-white px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-5 md:rounded-3xl">
            <div className="flex items-center">
              <h2 id="doc-reject-title" className="text-lg font-bold">
                반려할까요? · {doc.member_name}
              </h2>
              <button type="button" onClick={() => setRejecting(false)} aria-label="닫기" className="ml-auto flex size-10 items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-100">
                <X className="size-5" />
              </button>
            </div>
            <label htmlFor="doc-reject-reason" className="text-[13px] text-zinc-600">
              반려 사유는 쓴 사람에게 그대로 보여요 (필수)
            </label>
            <textarea id="doc-reject-reason" rows={3} maxLength={300} autoFocus value={reason} onChange={(e) => setReason(e.target.value)} className="rounded-xl border border-zinc-300 px-3 py-2.5 text-[15px] outline-none focus:border-brand-600" placeholder="예: 견적 2곳을 비교해서 다시 올려 주세요." />
            <div className="mt-1 flex justify-end gap-2">
              <button type="button" onClick={() => setRejecting(false)} className="h-11 rounded-xl border border-zinc-300 px-4 text-sm">
                취소
              </button>
              <button type="button" disabled={!reason.trim() || busy === "no"} onClick={() => void act(false)} className="flex h-11 items-center gap-1.5 rounded-xl bg-red-600 px-4 text-sm font-semibold text-white disabled:opacity-50" data-doc-reject-confirm>
                {busy === "no" && <Loader2 className="size-4 animate-spin" />}
                반려하기
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
