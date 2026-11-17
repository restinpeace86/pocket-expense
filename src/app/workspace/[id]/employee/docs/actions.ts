"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { getMembership } from "@/lib/auth/session";
import { docErrorText, type Payload } from "@/lib/approval-docs/model";
import { getApprovalDocModel } from "@/lib/approval-docs/server";
import type { DocModel } from "@/lib/doc-convert/model";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// [결재 문서](9-33e). 검사·권한은 모두 DB 함수(migration 163)가 한다 — 여기선 부르고 글자만 바꾼다
export type DocResult = { ok: true } | { ok: false; error: string; missing?: string };
const code = (m: string) => m.match(/[A-Z_]{5,}/)?.[0] ?? m;
const fail = (e: { message: string; details?: string | null }): DocResult => ({ ok: false, error: docErrorText(code(e.message)), ...(code(e.message) === "REQUIRED_MISSING" && e.details ? { missing: e.details } : {}) });

async function ws(companyId: string) {
  const m = await getMembership();
  if (!m || m.status !== "approved" || m.company_id !== companyId) return null;
  return m;
}

// 새로 쓰기 → 쓰기 화면으로
export async function createDocAction(companyId: string, formId: string): Promise<DocResult> {
  if (!(await ws(companyId))) return { ok: false, error: "다시 로그인해 주세요." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("approval_doc_create", { p_form: formId });
  if (error) return fail(error);
  redirect(`/workspace/${companyId}/employee/docs/${data}`);
}

// 자동 저장(제목 + 입력값)
export async function saveDocAction(docId: string, title: string, payload: Payload): Promise<{ ok: true; at: string } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("approval_doc_save", { p_id: docId, p_title: title, p_payload: payload });
  if (error) return { ok: false, error: docErrorText(code(error.message)) };
  return { ok: true, at: String(data) };
}

export async function deleteDocAction(companyId: string, docId: string): Promise<DocResult> {
  if (!(await ws(companyId))) return { ok: false, error: "다시 로그인해 주세요." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("approval_doc_delete", { p_id: docId });
  if (error) return fail(error);
  const paths = (data ?? []) as string[];
  // 첨부 원본은 DB에서 문서가 지워진 뒤 서버 키로 지운다(이 회사 폴더 경로만 — DB 함수가 돌려준 것)
  if (paths.length) await createAdminClient()?.storage.from("approval-files").remove(paths.filter((p) => p.startsWith(`${companyId}/`)));
  redirect(`/workspace/${companyId}/employee/docs`);
}

export async function addDocFileAction(docId: string, file: { path: string; name: string; mime: string; size: number }): Promise<DocResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("approval_doc_file_add", { p_id: docId, p_path: file.path, p_name: file.name, p_mime: file.mime, p_size: file.size });
  if (error) {
    await supabase.storage.from("approval-files").remove([file.path]);
    return fail(error);
  }
  refresh();
  return { ok: true };
}

export async function removeDocFileAction(fileId: string): Promise<DocResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("approval_doc_file_remove", { p_file: fileId });
  if (error) return fail(error);
  if (data) await supabase.storage.from("approval-files").remove([String(data)]);
  refresh();
  return { ok: true };
}

// 올리기: 마지막 내용을 저장한 뒤 올린다
export async function submitDocAction(docId: string, title: string, payload: Payload): Promise<DocResult & { status?: string }> {
  const supabase = await createClient();
  const saved = await supabase.rpc("approval_doc_save", { p_id: docId, p_title: title, p_payload: payload });
  if (saved.error) return fail(saved.error);
  const { data, error } = await supabase.rpc("approval_doc_submit", { p_id: docId });
  if (error) return fail(error);
  refresh();
  return { ok: true, status: String(data) };
}

export async function recallDocAction(docId: string): Promise<DocResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("approval_doc_recall", { p_id: docId });
  if (error) return fail(error);
  refresh();
  return { ok: true };
}

export async function decideDocAction(docId: string, approve: boolean, text: string | null): Promise<DocResult> {
  const supabase = await createClient();
  const { error } = approve ? await supabase.rpc("approval_doc_approve", { p_id: docId, p_comment: text ?? undefined }) : await supabase.rpc("approval_doc_reject", { p_id: docId, p_reason: text ?? "" });
  if (error) return fail(error);
  refresh();
  return { ok: true };
}

// [양식 보기]·PDF: 채운 표만 넘긴다(브라우저가 그림·PDF 만듦)
export async function docModelAction(companyId: string, docId: string): Promise<{ doc: DocModel; fileName: string; title: string } | null> {
  if (!(await ws(companyId))) return null;
  return getApprovalDocModel(docId);
}

// 첨부 열기: 볼 수 있는 사람만(저장소 정책) 잠깐 쓰는 주소
export async function docFileUrlAction(path: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.storage.from("approval-files").createSignedUrl(path, 120);
  return data?.signedUrl ?? null;
}
