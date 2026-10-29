"use client";

import { FolderArchive } from "lucide-react";
import { useState } from "react";
import { officeClaimDocsAction, officeEvidenceFilesAction, officeZipAttachmentsAction } from "@/app/tax-office/[companyId]/zip-actions";
import { thrownActionMessage } from "@/lib/action-guard";
import { evidenceFile, evidenceNo, isOwnCar } from "@/lib/tax/export-rows";
import { buildTaxZip, saveBlob } from "@/lib/tax/zip-client";

type Progress = { step: string; done: number; total: number; failed: number };

// 세무사무소 증빙 묶음(ZIP) 받기 (D-153): 장부(엑셀) + 영수증(증빙번호 파일명) + 지출결의서 PDF. 마감하지 않는다(마감은 회사가)
export function OfficeZipButton({ companyId, companyName, month, closed, disabled }: { companyId: string; companyName: string; month: string; closed: boolean; disabled?: boolean }) {
  const [progress, setProgress] = useState<Progress | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const [y, m] = month.split("-");
  const zipBase = `${companyName}_${y}년${Number(m)}월_세무자료${closed ? "" : "_마감전"}`.replace(/[\\/:*?"<>|]/g, "");

  async function download(only?: string[]) {
    setMessage(null);
    try {
      setProgress({ step: "장부(엑셀) 만드는 중", done: 0, total: 0, failed: 0 });
      const xlsxRes = await fetch(`/tax-office/${companyId}/xlsx?month=${month}${only ? "" : "&zip=1"}`, { cache: "no-store" });
      if (!xlsxRes.ok) throw new Error("xlsx");
      const workbook = { name: `${y}년${Number(m)}월_세무기장용_장부${closed ? "" : "_마감전"}.xlsx`, data: new Uint8Array(await xlsxRes.arrayBuffer()) };
      const list = await officeEvidenceFilesAction(companyId, month, only);
      if (!list.ok) {
        setProgress(null);
        return setMessage({ kind: "error", text: list.error });
      }
      // 회사가 올린 홈택스 원본(홈택스자료/, D-158)·송금 확인증(지급확인증/, D-164)도 함께
      const extras = only ? null : await officeZipAttachmentsAction(companyId, month).catch(() => null);
      setProgress({ step: "영수증 받는 중", done: 0, total: list.files.length, failed: 0 });
      let pdfNote = "";
      const { parts, failed, extraAdded, attachmentsFailed } = await buildTaxZip({
        workbook,
        files: list.files,
        attachments: extras?.ok ? extras.attachments : undefined,
        refreshUrls: async (names) => {
          const r = await officeEvidenceFilesAction(companyId, month, names);
          return r.ok ? r.files : [];
        },
        onProgress: (p) => setProgress({ step: "영수증 받는 중", ...p }),
        extra: only
          ? undefined
          : async (got) => {
              setProgress({ step: "지출결의서 PDF 만드는 중", done: 0, total: 0, failed: 0 });
              const d = await officeClaimDocsAction(companyId, month);
              if (!d.ok) return null;
              const { buildClaimsPdf } = await import("@/lib/tax/pdf-client");
              const n = d.rows.length;
              const evidence = new Map(
                d.rows.map((r) => {
                  const f = evidenceFile(r, month, n);
                  const data = f ? got.get(f.name) : undefined;
                  const ext = f?.name.split(".").pop();
                  const what = isOwnCar(r) ? `자차 ${r.start_location ?? ""}→${r.end_location ?? ""}` : (r.merchant_name ?? "");
                  return [
                    r.item_id,
                    {
                      no: evidenceNo(month, r.seq, n),
                      label: `증빙 ${evidenceNo(month, r.seq, n)} · ${r.expense_date} · ${what} · ${(r.amount ?? 0).toLocaleString("ko-KR")}원 — ${r.claim_title}`,
                      image: data ? { kind: ext === "pdf" ? ("pdf" as const) : ext === "png" ? ("png" as const) : ("jpg" as const), data } : null,
                    },
                  ];
                }),
              );
              try {
                const pdf = await buildClaimsPdf({ docs: d.docs, companyName, month, evidence, layout: d.layout });
                return { name: `지출결의서_${month}.pdf`, data: pdf };
              } catch {
                pdfNote = " 지출결의서 PDF는 만들지 못했어요 — 다시 받아 주세요.";
                return null;
              }
            },
      });
      parts.forEach((b, i) => saveBlob(b, `${zipBase}${only ? "_누락분" : ""}${parts.length > 1 ? `_${i + 1}` : ""}.zip`));
      setProgress(null);
      setMissing(failed);
      const countOf = (folder: string) => (extras?.ok ? (extras.attachments.find((a) => a.folder === folder)?.files.length ?? 0) : 0) - attachmentsFailed.filter((n) => n.startsWith(`${folder}/`)).length;
      const htCount = countOf("홈택스자료");
      const proofCount = countOf("지급확인증");
      const htNote = attachmentsFailed.length ? ` 함께 넣을 파일 ${attachmentsFailed.length}개(홈택스 자료·송금 확인증)는 넣지 못했어요 — 다시 받아 주세요.` : "";
      setMessage(
        failed.length
          ? { kind: "error", text: `ZIP을 저장했지만 영수증 ${failed.length}장을 받지 못했어요. [못 받은 영수증 다시 받기]를 눌러 주세요.` }
          : { kind: pdfNote || htNote ? "error" : "ok", text: `저장했어요 (장부 + 영수증 ${list.files.length}장${extraAdded ? " + 지출결의서 PDF" : ""}${htCount ? ` + 홈택스 자료 ${htCount}개` : ""}${proofCount ? ` + 송금 확인증 ${proofCount}개` : ""}${parts.length > 1 ? `, ${parts.length}개 파일로 나눔` : ""}).${pdfNote}${htNote}` },
      );
    } catch {
      setProgress(null);
      setMessage({ kind: "error", text: navigator.onLine === false ? thrownActionMessage() : "ZIP을 만들지 못했어요. 잠시 뒤 다시 시도해 주세요." });
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-2 sm:max-w-sm">
      <button
        type="button"
        disabled={disabled || !!progress}
        onClick={() => download()}
        className="inline-flex min-h-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-brand-300 bg-white px-4 font-semibold text-brand-800 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <FolderArchive className="size-4" aria-hidden />
        {progress ? `${progress.step}${progress.total ? ` ${progress.done}/${progress.total}` : ""}` : "증빙 묶음(ZIP) 받기"}
      </button>
      {missing.length > 0 && !progress && (
        <button type="button" onClick={() => download(missing)} className="text-sm font-medium text-brand-700 underline underline-offset-2">
          못 받은 영수증 다시 받기 ({missing.length}장)
        </button>
      )}
      {message && (
        <p role={message.kind === "error" ? "alert" : "status"} className={`break-keep text-sm ${message.kind === "error" ? "text-red-700" : "text-emerald-700"}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}
