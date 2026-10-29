"use server";

import { refresh } from "next/cache";
import { getMembership } from "@/lib/auth/session";
import { isAdminRole } from "@/lib/auth/paths";
import { messageForDbError } from "@/lib/errors";
import { HOMETAX_BUCKET, HOMETAX_EXT, HOMETAX_KINDS, HOMETAX_MAX_BYTES, type HometaxKind } from "@/lib/hometax/kinds";
import { readHometaxTable } from "@/lib/hometax/parse";
import { hometaxZipFiles } from "@/lib/hometax/server";
import { payoutProofZipFiles } from "@/lib/claims/payout-proof-server";
import { getTaxMonth, MONTH } from "@/lib/tax/closing";
import { createAdminClient } from "@/lib/supabase/admin";
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
  const month = String(formData.get("month") ?? "");
  const kind = String(formData.get("kind") ?? "") as HometaxKind;
  const memo = String(formData.get("memo") ?? "").slice(0, 200);
  const file = formData.get("file");
  if (!MONTH.test(month)) return fail(messageForDbError({ message: "INVALID_MONTH" }));
  if (!HOMETAX_KINDS.includes(kind)) return fail("자료 종류를 골라 주세요.");
  if (!(file instanceof File) || file.size === 0) return fail("파일을 골라 주세요.");
  if (file.size > HOMETAX_MAX_BYTES) return fail("10MB 이하 파일만 올릴 수 있어요.");
  const ext = HOMETAX_EXT.exec(file.name)?.[1]?.toLowerCase();
  if (!ext) return fail("홈택스에서 내려받은 엑셀(.xlsx·.xls)이나 .csv 파일만 올릴 수 있어요.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const table = readHometaxTable(bytes, file.name);
  if (!table) return fail("파일을 읽지 못했어요. 홈택스에서 내려받은 그대로인지, 암호가 걸려 있지 않은지 확인해 주세요.");
  const storage = createAdminClient();
  if (!storage) return fail("지금은 파일을 저장할 수 없어요. 잠시 뒤 다시 시도해 주세요.");
  const path = `${m.company_id}/${crypto.randomUUID()}.${ext}`;
  const { error: upError } = await storage.storage.from(HOMETAX_BUCKET).upload(path, bytes, { contentType: file.type || "application/octet-stream" });
  if (upError) return fail("파일을 저장하지 못했어요. 잠시 뒤 다시 시도해 주세요.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("add_hometax_upload", {
    p_month: month,
    p_kind: kind,
    p_file_path: path,
    p_file_name: file.name.slice(0, 200),
    p_file_size: file.size,
    p_header: table.header,
    p_preview: table.preview,
    p_row_count: table.rowCount,
    p_memo: memo,
  });
  if (error) {
    await storage.storage.from(HOMETAX_BUCKET).remove([path]);
    return fail(messageForDbError(error));
  }
  refresh();
  return { ok: true, rowCount: table.rowCount };
}

export async function deleteHometaxAction(id: string): Promise<Result> {
  if (!(await admin())) return fail(messageForDbError({ message: "NOT_ALLOWED" }));
  const supabase = await createClient();
  const { data: path, error } = await supabase.rpc("delete_hometax_upload", { p_id: id });
  if (error) return fail(messageForDbError(error));
  const storage = createAdminClient();
  if (path && storage) await storage.storage.from(HOMETAX_BUCKET).remove([path]);
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
