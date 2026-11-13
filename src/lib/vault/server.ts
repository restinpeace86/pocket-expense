import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { VAULT_BUCKET, vaultErrorMessage, vaultPaths, type VaultScope } from "./format";
import { BRAND } from "@/lib/brand";

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;
type Check = { member_id: string; company_id: string; message_id: string; path: string; thumb_path: string | null };

// 채팅 파일 영구 보관(D-245): 사용자 권한으로 확인 → 서버가 chat-files → vault-files 복사(트래픽 없이 저장소 안에서) → 기록.
// 기록이 실패하면(동시에 한도를 넘는 등) 복사한 파일을 지운다
export async function keepChatFile(messageId: string, scope: VaultScope): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("vault_keep_check", { p_message: messageId });
  if (error || !data) return { ok: false, error: vaultErrorMessage(error?.message ?? "") };
  const c = data as unknown as Check;
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: vaultErrorMessage("") };
  const { path, thumb } = vaultPaths(c.company_id, crypto.randomUUID(), c.path, !!c.thumb_path);
  const copied: string[] = [];
  const src = admin.storage.from("chat-files");
  const main = await src.copy(c.path, path, { destinationBucket: VAULT_BUCKET });
  if (main.error) return { ok: false, error: vaultErrorMessage("EXPIRED") };
  copied.push(path);
  let thumbPath: string | null = null;
  let thumbSize = 0;
  if (thumb && c.thumb_path) {
    const t = await src.copy(c.thumb_path, thumb, { destinationBucket: VAULT_BUCKET });
    if (!t.error) {
      copied.push(thumb);
      thumbPath = thumb;
      const { data: msg } = await admin.from("chat_messages").select("attachment_thumb_size").eq("id", c.message_id).maybeSingle();
      thumbSize = msg?.attachment_thumb_size ?? 0;
    }
  }
  const { error: addError } = await admin.rpc("vault_add", { p_member: c.member_id, p_message: c.message_id, p_scope: scope, p_path: path, p_thumb_path: thumbPath as string, p_thumb_size: thumbSize });
  if (addError) {
    await admin.storage.from(VAULT_BUCKET).remove(copied);
    return { ok: false, error: vaultErrorMessage(addError.message) };
  }
  return { ok: true };
}

// 지우기 = 휴지통으로(D-266): 파일은 그대로, 플랜 일수 안에 복구 가능
export async function deleteVaultFile(id: string): Promise<{ ok: true; days: number } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("vault_delete", { p_id: id });
  if (error || !data) return { ok: false, error: vaultErrorMessage(error?.message ?? "") };
  return { ok: true, days: Number((data as unknown as { days?: number }).days ?? 30) };
}

type Paths = { path: string; thumb_path: string | null };
const flat = (rows: Paths[]) => rows.flatMap((r) => [r.path, ...(r.thumb_path ? [r.thumb_path] : [])]);

// 휴지통에서 영구 삭제(한 개·비우기): 권한·기록 삭제는 DB 함수, 파일 삭제는 서버
export async function purgeVaultFile(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("vault_purge", { p_id: id });
  if (error || !data) return { ok: false, error: vaultErrorMessage(error?.message ?? "") };
  const admin = createAdminClient();
  if (admin) await admin.storage.from(VAULT_BUCKET).remove(flat([data as unknown as Paths]));
  return { ok: true };
}
export async function emptyVaultTrash(): Promise<{ ok: true; removed: number } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("vault_empty_trash");
  if (error) return { ok: false, error: vaultErrorMessage(error.message) };
  const rows = (data as unknown as Paths[]) ?? [];
  const admin = createAdminClient();
  if (admin && rows.length) await admin.storage.from(VAULT_BUCKET).remove(flat(rows));
  return { ok: true, removed: rows.length };
}

// 새벽 작업: 휴지통 기간(플랜별)이 지난 파일 영구 삭제
export async function purgeVaultTrash(admin: Admin): Promise<{ removed: number }> {
  const { data, error } = await admin.rpc("vault_trash_due");
  if (error) throw new Error(error.message);
  const due = (data as unknown as (Paths & { id: string })[]) ?? [];
  if (!due.length) return { removed: 0 };
  await admin.storage.from(VAULT_BUCKET).remove(flat(due));
  const { data: n } = await admin.rpc("vault_files_remove", { p_ids: due.map((f) => f.id) });
  return { removed: Number(n ?? 0) };
}

// 새벽 작업: 퇴사 30일 지난 사람의 나만 보기 파일 삭제(7일 전 안내는 DB 함수가 보냄)
export async function purgeVaultLeavers(admin: Admin): Promise<{ removed: number }> {
  const { data, error } = await admin.rpc("vault_leaver_files_due");
  if (error) throw new Error(error.message);
  const due = (data as unknown as { id: string; path: string; thumb_path: string | null }[]) ?? [];
  if (!due.length) return { removed: 0 };
  await admin.storage.from(VAULT_BUCKET).remove(due.flatMap((f) => [f.path, ...(f.thumb_path ? [f.thumb_path] : [])]));
  const { data: n } = await admin.rpc("vault_files_remove", { p_ids: due.map((f) => f.id) });
  return { removed: Number(n ?? 0) };
}

// 운영 점검(예상 못 한 청구 막기): 전체 저장 용량이 Supabase Pro 포함량(100GB)의 70%를 넘으면 운영자 디스코드로
export const STORAGE_INCLUDED_BYTES = 100 * 1024 ** 3;
export async function checkStorageTotal(admin: Admin): Promise<{ bytes: number; alerted: boolean }> {
  const { data, error } = await admin.rpc("storage_total_bytes");
  if (error) throw new Error(error.message);
  const bytes = Number(data ?? 0);
  const hook = process.env.DISCORD_WEBHOOK_URL;
  if (bytes < STORAGE_INCLUDED_BYTES * 0.7 || !hook) return { bytes, alerted: false };
  const gb = Math.round((bytes / 1024 ** 3) * 10) / 10;
  await fetch(hook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: `⚠️ [${BRAND.name}] 저장 공간 ${gb}GB — Supabase 포함량(100GB)의 ${Math.round((bytes / STORAGE_INCLUDED_BYTES) * 100)}%예요. 사용량 화면에서 트래픽도 확인해 주세요.` }),
  }).catch(() => {});
  return { bytes, alerted: true };
}
