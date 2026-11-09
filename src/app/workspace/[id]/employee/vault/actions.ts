"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { vaultErrorMessage, type VaultScope } from "@/lib/vault/format";
import { deleteVaultFile, keepChatFile } from "@/lib/vault/server";

// 파일 영구 보관(D-245): 채팅 사진·파일을 보관함으로
export async function keepChatFileAction(messageId: string, scope: VaultScope) {
  if (scope !== "private" && scope !== "company") return { ok: false as const, error: vaultErrorMessage("") };
  return keepChatFile(messageId, scope);
}

export async function setVaultScopeAction(id: string, scope: VaultScope): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("vault_set_scope", { p_id: id, p_scope: scope });
  if (error) return { ok: false, error: vaultErrorMessage(error.message) };
  refresh();
  return { ok: true };
}

export async function deleteVaultFileAction(id: string) {
  const r = await deleteVaultFile(id);
  if (r.ok) refresh();
  return r;
}
