"use server";

import { refresh } from "next/cache";
import { convertErrorMessage, validDoc } from "@/lib/doc-convert/model";
import { convertChatFile, convertUploadedFile, deleteConversion } from "@/lib/doc-convert/server";
import { createClient } from "@/lib/supabase/server";

// 서류 → 엑셀 변환(8-104 A). 크레딧 숫자는 직원에게 보내지 않는다(2026-11-11) — 모자라면 "관리자에게 문의"만
export async function convertChatFileAction(messageId: string) {
  if (!/^[0-9a-f-]{36}$/.test(messageId)) return { ok: false as const, error: convertErrorMessage("NOT_FOUND") };
  return convertChatFile(messageId);
}

export async function convertUploadAction(id: string, name: string, mime: string) {
  return convertUploadedFile(id, String(name ?? ""), String(mime ?? ""));
}

export async function saveConversionAction(id: string, sheets: unknown): Promise<{ ok: boolean; error?: string }> {
  if (!validDoc(sheets)) return { ok: false, error: "표 모양이 올바르지 않아요. 새로고침한 뒤 다시 고쳐 주세요." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("doc_convert_save", { p_id: id, p_sheets: sheets as never });
  if (error) return { ok: false, error: convertErrorMessage(error.message) };
  return { ok: true };
}

export async function confirmConversionAction(id: string, scope: "private" | "company"): Promise<{ ok: boolean; error?: string }> {
  if (scope !== "private" && scope !== "company") return { ok: false, error: convertErrorMessage("") };
  const supabase = await createClient();
  const { error } = await supabase.rpc("doc_convert_confirm", { p_id: id, p_scope: scope });
  if (error) return { ok: false, error: convertErrorMessage(error.message) };
  refresh();
  return { ok: true };
}

export async function deleteConversionAction(id: string) {
  const r = await deleteConversion(id);
  if (r.ok) refresh();
  return r;
}
