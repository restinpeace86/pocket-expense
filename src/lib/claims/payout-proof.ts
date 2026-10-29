"use server";

import { refresh } from "next/cache";
import { getMembership } from "@/lib/auth/session";
import { isAdminRole } from "@/lib/auth/paths";
import { messageForDbError } from "@/lib/errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// 송금 확인증 (D-164): 지급 완료된 결의서에 이체 확인 캡처·PDF 1개. 같은 파일을 여러 결의서에 붙일 수 있다(한 번 이체)
const BUCKET = "payout-proofs";
const MAX = 10 * 1024 * 1024;
const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" };

export async function uploadPayoutProofAction(formData: FormData): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const m = await getMembership();
  if (!m || m.status !== "approved" || !isAdminRole(m.role)) return { ok: false, error: messageForDbError({ message: "NOT_ALLOWED" }) };
  const file = formData.get("file");
  let ids: string[] = [];
  try {
    ids = JSON.parse(String(formData.get("claimIds") ?? "[]"));
  } catch {
    ids = [];
  }
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 200) return { ok: false, error: "결의서를 골라 주세요." };
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "파일을 골라 주세요." };
  if (file.size > MAX) return { ok: false, error: "10MB 이하 파일만 올릴 수 있어요." };
  const ext = EXT[file.type];
  if (!ext) return { ok: false, error: "사진(jpg·png) 또는 PDF만 올릴 수 있어요." };
  const storage = createAdminClient();
  if (!storage) return { ok: false, error: "지금은 파일을 저장할 수 없어요. 잠시 뒤 다시 시도해 주세요." };
  const path = `${m.company_id}/${crypto.randomUUID()}.${ext}`;
  const { error: upError } = await storage.storage.from(BUCKET).upload(path, new Uint8Array(await file.arrayBuffer()), { contentType: file.type });
  if (upError) return { ok: false, error: "파일을 저장하지 못했어요. 잠시 뒤 다시 시도해 주세요." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_payout_proof", { p_claim_ids: ids, p_path: path, p_name: file.name.slice(0, 200) || `확인증.${ext}` });
  if (error) {
    await storage.storage.from(BUCKET).remove([path]);
    return { ok: false, error: messageForDbError(error) };
  }
  refresh();
  return { ok: true, count: Number(data) };
}
