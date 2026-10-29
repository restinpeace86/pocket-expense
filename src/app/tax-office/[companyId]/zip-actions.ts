"use server";

import { messageForDbError } from "@/lib/errors";
import { getActiveForm } from "@/lib/forms/active";
import type { FormLayout } from "@/lib/forms/layout";
import { createAdminClient } from "@/lib/supabase/admin";
import { getClaimDocs, type ClaimDoc } from "@/lib/tax/claim-docs";
import { MONTH } from "@/lib/tax/closing";
import { evidenceFile, type ExportRow } from "@/lib/tax/export-rows";
import { getTaxOfficeMonth } from "@/lib/tax-office/queries";
import { hometaxZipFiles } from "@/lib/hometax/server";
import { payoutProofZipFiles } from "@/lib/claims/payout-proof-server";

// 세무사무소 증빙 묶음(ZIP) (D-153): 회사 세무 마감 ZIP과 같은 구성(장부 + 영수증 + 지출결의서 PDF).
// 볼 수 있는 고객사인지는 tax_office_month_export가 확인하고, 그 결과의 행·결의서만 운영 키로 읽는다(그 회사 폴더·그 회사 결의서만).
// 지출결의서 PDF에는 직원 정산 계좌를 넣지 않는다(세무 자료에 필요 없음).
type Result<T> = ({ ok: true } & T) | { ok: false; error: string };
const fail = (code: string) => ({ ok: false as const, error: messageForDbError({ message: code }) });

export async function officeEvidenceFilesAction(companyId: string, month: string, only?: string[]): Promise<Result<{ files: { name: string; url: string | null }[] }>> {
  if (!MONTH.test(month)) return fail("INVALID_MONTH");
  const data = await getTaxOfficeMonth(companyId, month);
  if (!data) return fail("NOT_FOUND");
  const admin = createAdminClient();
  if (!admin) return fail("NOT_FOUND");
  const total = data.rows.length;
  let list = data.rows
    .map((r) => evidenceFile(r, month, total))
    .filter((f): f is { name: string; path: string } => !!f && f.path.startsWith(`${companyId}/`));
  if (only?.length) list = list.filter((f) => only.includes(f.name));
  const urls = new Map<string, string>();
  for (let i = 0; i < list.length; i += 200) {
    const { data: signed } = await admin.storage.from("receipts").createSignedUrls(list.slice(i, i + 200).map((f) => f.path), 600);
    for (const s of signed ?? []) if (s.path && s.signedUrl && !s.error) urls.set(s.path, s.signedUrl);
  }
  return { ok: true, files: list.map((f) => ({ name: f.name, url: urls.get(f.path) ?? null })) };
}

export async function officeClaimDocsAction(companyId: string, month: string): Promise<Result<{ docs: ClaimDoc[]; rows: ExportRow[]; layout: FormLayout | null }>> {
  if (!MONTH.test(month)) return fail("INVALID_MONTH");
  const data = await getTaxOfficeMonth(companyId, month);
  if (!data) return fail("NOT_FOUND");
  const admin = createAdminClient();
  if (!admin) return fail("NOT_FOUND");
  const client = admin as unknown as NonNullable<Parameters<typeof getActiveForm>[1]>;
  const [docs, form] = await Promise.all([getClaimDocs(companyId, data.rows, { client, withBank: false }), getActiveForm(companyId, client)]);
  return { ok: true, docs, rows: data.rows, layout: form?.layout ?? null };
}

// 함께 넣을 폴더: 회사가 올린 홈택스 원본(홈택스자료/, D-158) · 송금 확인증(지급확인증/, D-164).
// 볼 수 있는 고객사인지는 tax_office_month_export가 확인하고, 그 결과의 결의서만 운영 키로 읽는다
export async function officeZipAttachmentsAction(companyId: string, month: string): Promise<Result<{ attachments: { folder: string; files: { name: string; url: string | null }[] }[] }>> {
  if (!MONTH.test(month)) return fail("INVALID_MONTH");
  const data = await getTaxOfficeMonth(companyId, month);
  if (!data) return fail("NOT_FOUND");
  const [hometax, proofs] = await Promise.all([hometaxZipFiles(companyId, month), payoutProofZipFiles(companyId, data.rows.map((r) => r.claim_id))]);
  return { ok: true, attachments: [{ folder: "홈택스자료", files: hometax }, { folder: "지급확인증", files: proofs }].filter((a) => a.files.length) };
}
