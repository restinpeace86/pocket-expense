// 여러 고객사 한 번에 받기(D-268): 고객사마다 [증빙 묶음(ZIP) 받기]와 같은 내용을 "고객사/2026-10/" 폴더로 한 ZIP에.
// 브라우저에서 한 곳씩 차례로(서버 응답 크기 제한 때문에 ZIP은 서버에서 만들지 않음, D-073)
import { officeClaimDocsAction, officeEvidenceFilesAction, officeZipAttachmentsAction } from "@/app/tax-office/[companyId]/zip-actions";
import { evidenceFile, evidenceNo, isOwnCar } from "@/lib/tax/export-rows";
import { buildTaxZip, type ZipSink } from "@/lib/tax/zip-client";

export const BULK_ZIP_MAX = 20;

// 폴더·파일 이름에 못 쓰는 글자 빼기
export const safeName = (s: string) => s.replace(/[\\/:*?"<>|]/g, "").trim() || "고객사";

export function bulkZipName(month: string): string {
  const [y, m] = month.split("-");
  return `세무자료_${y}년${Number(m)}월.zip`;
}

export function companyFolder(companyName: string, month: string, closed: boolean): string {
  return `${safeName(companyName)}${closed ? "" : "_마감전"}/${month}/`;
}

export type BulkResult = { ok: boolean; receipts: number; failed: number; pdf: boolean };

export async function addOfficeCompany(opts: {
  companyId: string;
  companyName: string;
  month: string;
  closed: boolean;
  sink: ZipSink;
  onStep: (step: string, done?: number, total?: number) => void;
}): Promise<BulkResult> {
  const { companyId, companyName, month, closed, sink } = opts;
  const [y, m] = month.split("-");
  const xlsxRes = await fetch(`/tax-office/${companyId}/xlsx?month=${month}&zip=1`, { cache: "no-store" });
  if (!xlsxRes.ok) return { ok: false, receipts: 0, failed: 0, pdf: false };
  const workbook = { name: `${y}년${Number(m)}월_세무기장용_장부${closed ? "" : "_마감전"}.xlsx`, data: new Uint8Array(await xlsxRes.arrayBuffer()) };
  const list = await officeEvidenceFilesAction(companyId, month);
  if (!list.ok) return { ok: false, receipts: 0, failed: 0, pdf: false };
  const extras = await officeZipAttachmentsAction(companyId, month).catch(() => null);
  const { failed, extraAdded } = await buildTaxZip({
    sink,
    prefix: companyFolder(companyName, month, closed),
    workbook,
    files: list.files,
    attachments: extras?.ok ? extras.attachments : undefined,
    refreshUrls: async (names) => {
      const r = await officeEvidenceFilesAction(companyId, month, names);
      return r.ok ? r.files : [];
    },
    onProgress: (p) => opts.onStep("영수증 받는 중", p.done, p.total),
    extra: async (got) => {
      opts.onStep("지출결의서 PDF 만드는 중");
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
        return { name: `지출결의서_${month}.pdf`, data: await buildClaimsPdf({ docs: d.docs, companyName, month, evidence, layout: d.layout }) };
      } catch {
        return null;
      }
    },
  });
  return { ok: true, receipts: list.files.length - failed.length, failed: failed.length, pdf: extraAdded };
}
