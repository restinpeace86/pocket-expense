"use server";

import { refresh } from "next/cache";
import { getMembership } from "@/lib/auth/session";
import { isAdminRole } from "@/lib/auth/paths";
import { messageForDbError } from "@/lib/errors";
import { prepareHometaxUpload, removeHometaxFile } from "@/lib/hometax/upload";
import { hometaxZipFiles } from "@/lib/hometax/server";
import { payoutProofZipFiles } from "@/lib/claims/payout-proof-server";
import { getTaxMonth, MONTH } from "@/lib/tax/closing";
import { createClient } from "@/lib/supabase/server";

// 회사 관리자: 홈택스에서 내려받은 파일을 그 달 세무 자료에 올리기·지우기 (D-158). 권한·회사 격리는 DB 함수가 다시 확인한다
type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

async function admin() {
  const m = await getMembership();
  return m && m.status === "approved" && isAdminRole(m.role) ? m : null;
}

export async function uploadHometaxAction(formData: FormData): Promise<Result<{ rowCount: number }>> {
  const m = await admin();
  if (!m) return fail(messageForDbError({ message: "NOT_ALLOWED" }));
  const up = await prepareHometaxUpload(m.company_id, formData);
  if ("error" in up) return fail(up.error);
  const supabase = await createClient();
  const { error } = await supabase.rpc("add_hometax_upload", {
    p_month: up.month,
    p_kind: up.kind,
    p_file_path: up.path,
    p_file_name: up.fileName,
    p_file_size: up.fileSize,
    p_header: up.table.header,
    p_preview: up.table.preview,
    p_row_count: up.table.rowCount,
    p_memo: up.memo,
  });
  if (error) {
    await up.cleanup();
    return fail(messageForDbError(error));
  }
  refresh();
  return { ok: true, rowCount: up.table.rowCount };
}

// 회사가 올린 것만 지운다(사무소가 올린 것은 사무소가, D-172)
export async function deleteHometaxAction(id: string): Promise<Result> {
  if (!(await admin())) return fail(messageForDbError({ message: "NOT_ALLOWED" }));
  const supabase = await createClient();
  const { data: path, error } = await supabase.rpc("delete_hometax_upload", { p_id: id });
  if (error) return fail(messageForDbError(error));
  await removeHometaxFile(path);
  refresh();
  return { ok: true };
}

// 세무 마감 ZIP에 함께 넣을 폴더: 홈택스자료/(D-158) · 지급확인증/(그 달 결의서의 송금 확인증, D-164)
export type ZipAttachments = { folder: string; files: { name: string; url: string | null }[] }[];
export async function zipAttachmentsAction(month: string): Promise<Result<{ attachments: ZipAttachments }>> {
  const m = await admin();
  if (!m) return fail(messageForDbError({ message: "NOT_ALLOWED" }));
  if (!MONTH.test(month)) return fail(messageForDbError({ message: "INVALID_MONTH" }));
  const res = await getTaxMonth(month);
  const claimIds = res.ok ? res.data.rows.map((r) => r.claim_id) : [];
  const [hometax, proofs] = await Promise.all([hometaxZipFiles(m.company_id, month), payoutProofZipFiles(m.company_id, claimIds)]);
  return { ok: true, attachments: [{ folder: "홈택스자료", files: hometax }, { folder: "지급확인증", files: proofs }].filter((a) => a.files.length) };
}
