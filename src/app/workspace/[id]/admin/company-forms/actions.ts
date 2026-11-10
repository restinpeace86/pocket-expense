"use server";

import { refresh } from "next/cache";
import { applyDrops, formErrorMessage, validFields, type Field, type FormKind } from "@/lib/company-forms/model";
import { deleteForm, readForm, startFormFromChat, startFormFromUpload } from "@/lib/company-forms/server";
import { validDoc } from "@/lib/doc-convert/model";
import { createClient } from "@/lib/supabase/server";

// 회사 양식 등록(8-104 B). 권한은 DB 함수가 관리자만 허용한다
type Source = { chat: string } | { upload: { id: string; name: string; mime: string } };
const isKind = (k: unknown): k is FormKind => k === "leave" || k === "general";

// 시작: 파일 → 초안 → (종류가 있으면) AI로 읽기. 읽기가 실패해도 초안은 [등록 대기]에 남는다
export async function startFormAction(source: Source, group: string | null, kind: FormKind) {
  if (!isKind(kind)) return { ok: false as const, error: formErrorMessage("") };
  const started =
    "chat" in source
      ? await startFormFromChat(String(source.chat), group)
      : await startFormFromUpload(String(source.upload.id), String(source.upload.name ?? ""), String(source.upload.mime ?? ""), group);
  if (!started.ok) return started;
  const read = await readForm(started.id, kind);
  refresh();
  return read.ok ? read : { ok: false as const, error: read.error, id: started.id };
}

// 휴대폰: 채팅 파일을 [등록 대기]에 담아 두기(AI 읽기는 PC에서)
export async function holdChatFormAction(messageId: string) {
  const r = await startFormFromChat(String(messageId), null);
  if (r.ok) refresh();
  return r;
}

export async function readFormAction(id: string, kind: FormKind) {
  const r = await readForm(String(id), kind);
  refresh();
  return r;
}

async function kindOf(id: string): Promise<FormKind | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("company_forms").select("kind").eq("id", id).maybeSingle();
  return (data?.kind as FormKind | null) ?? null;
}

export async function saveFormAction(id: string, name: string, sheets: unknown, fields: unknown): Promise<{ ok: boolean; error?: string }> {
  if (!validDoc(sheets) || !validFields(fields, sheets, await kindOf(id))) return { ok: false, error: "양식 모양이 올바르지 않아요. 새로고침한 뒤 다시 고쳐 주세요." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("company_form_save", { p_id: id, p_name: String(name ?? ""), p_sheets: sheets as never, p_fields: fields as never });
  if (error) return { ok: false, error: formErrorMessage(error.message) };
  return { ok: true };
}

// 등록: 빼기 칸을 양식에서 지운 뒤 저장 → 등록(새 버전)
export async function publishFormAction(id: string, name: string, sheets: unknown, fields: unknown): Promise<{ ok: boolean; error?: string }> {
  const kind = await kindOf(id);
  if (!validDoc(sheets) || !validFields(fields, sheets, kind)) return { ok: false, error: "양식 모양이 올바르지 않아요. 새로고침한 뒤 다시 고쳐 주세요." };
  const done = applyDrops(sheets, fields as Field[]);
  const supabase = await createClient();
  const saved = await supabase.rpc("company_form_save", { p_id: id, p_name: String(name ?? ""), p_sheets: done.doc as never, p_fields: done.fields as never });
  if (saved.error) return { ok: false, error: formErrorMessage(saved.error.message) };
  const { error } = await supabase.rpc("company_form_publish", { p_id: id });
  if (error) return { ok: false, error: formErrorMessage(error.message) };
  refresh();
  return { ok: true };
}

export async function editFormAction(group: string): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("company_form_edit", { p_group: group });
  if (error || !data) return { ok: false, error: formErrorMessage(error?.message ?? "") };
  return { ok: true, id: data as string };
}

export async function deleteFormAction(id: string) {
  const r = await deleteForm(String(id));
  if (r.ok) refresh();
  return r;
}

export async function requestSlotAction(): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("form_slot_request");
  if (error) return { ok: false, error: formErrorMessage(error.message) };
  refresh();
  return { ok: true };
}

// 양식 추가 창(목록·채팅 공용): 칸 사용·신청 상태 + 지금 쓰는 양식(새 버전으로 바꿀 대상)
export type FormDialogData = { limit: number; used: number; requested: boolean; forms: { group_id: string; name: string; kind: FormKind }[] };
export async function formDialogDataAction(): Promise<{ ok: true; data: FormDialogData } | { ok: false; error: string }> {
  const supabase = await createClient();
  const [slots, forms] = await Promise.all([
    supabase.rpc("company_form_slots"),
    supabase.from("company_forms").select("group_id, name, kind").eq("status", "active").order("published_at", { ascending: true }),
  ]);
  if (slots.error || !slots.data) return { ok: false, error: formErrorMessage(slots.error?.message ?? "") };
  const s = slots.data as unknown as { limit: number; used: number; requested: boolean };
  return { ok: true, data: { ...s, forms: (forms.data ?? []).filter((f) => isKind(f.kind)).map((f) => ({ group_id: f.group_id, name: f.name, kind: f.kind as FormKind })) } };
}
