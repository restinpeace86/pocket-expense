"use server";

import { refresh } from "next/cache";
import { getMembership } from "@/lib/auth/session";
import { isAdminRole } from "@/lib/auth/paths";
import { messageForDbError } from "@/lib/errors";
import { getActiveForm } from "@/lib/forms/active";
import { layoutFromAi, type AiFormRead, type AiLayoutResult } from "@/lib/forms/ai-layout";
import { readFormWithGemini } from "@/lib/forms/gemini-form";
import { normalizeLayout, type FormLayout } from "@/lib/forms/layout";
import { createClient } from "@/lib/supabase/server";
import { getClaimDocsByIds, type ClaimDoc } from "@/lib/tax/claim-docs";

// 지출결의서 양식 설정 (D-118, template-configuration.md). 권한·회사 격리는 DB 함수·RLS가 다시 확인한다.
type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };
const fail = (code: string): { ok: false; error: string } => ({ ok: false, error: messageForDbError({ message: code }) });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function admin() {
  const m = await getMembership();
  return m && m.status === "approved" && isAdminRole(m.role) ? m : null;
}

// 원본 양식 파일 경로: form-templates/{company_id}/{uuid}.jpg|pdf (자기 회사 폴더만, 버킷 RLS)
const sourcePathOk = (companyId: string, p: string) => new RegExp(`^${companyId}/[0-9a-f-]{36}\\.(jpg|pdf)$`, "i").test(p);

export async function saveFormLayoutAction(input: { layout: FormLayout; sourceFilePath: string | null; aiRead: AiFormRead | null }): Promise<Result> {
  const m = await admin();
  if (!m) return fail("NOT_ALLOWED");
  if (input.sourceFilePath && !sourcePathOk(m.company_id, input.sourceFilePath)) return fail("INVALID_FORM_SOURCE");
  const layout = normalizeLayout(input.layout);
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_form_template", {
    p_schema: layout,
    p_source_file_path: input.sourceFilePath ?? undefined,
    p_ai_extracted: (input.aiRead as never) ?? undefined,
  });
  if (error) return { ok: false, error: messageForDbError(error) };
  refresh();
  return { ok: true };
}

export async function clearFormLayoutAction(): Promise<Result> {
  if (!(await admin())) return fail("NOT_ALLOWED");
  const supabase = await createClient();
  const { error } = await supabase.rpc("clear_form_template");
  if (error) return { ok: false, error: messageForDbError(error) };
  refresh();
  return { ok: true };
}

// 올린 종이 양식을 AI로 읽어 우리 데이터와 짝짓기. 실패하면 화면이 기본 포맷에서 직접 꾸미도록 안내
export async function analyzeFormAction(sourceFilePath: string): Promise<Result<{ result: AiLayoutResult; aiRead: AiFormRead }>> {
  const m = await admin();
  if (!m) return fail("NOT_ALLOWED");
  if (!sourcePathOk(m.company_id, sourceFilePath)) return fail("INVALID_FORM_SOURCE");
  const supabase = await createClient();
  const { data: file, error } = await supabase.storage.from("form-templates").download(sourceFilePath);
  if (error || !file) return { ok: false, error: "올린 양식 파일을 찾지 못했어요. 다시 올려 주세요." };
  const aiRead = await readFormWithGemini({ data: await file.arrayBuffer(), mimeType: sourceFilePath.endsWith(".pdf") ? "application/pdf" : "image/jpeg" });
  if (!aiRead) return { ok: false, error: "양식을 읽지 못했어요. 더 밝고 반듯하게 다시 찍거나, 비슷한 기본 포맷을 골라 직접 꾸며 주세요." };
  return { ok: true, result: layoutFromAi(aiRead), aiRead };
}

// 원본 양식 이미지 보기(관리자, 10분 링크)
export async function formSourceUrlAction(sourceFilePath: string): Promise<Result<{ url: string }>> {
  const m = await admin();
  if (!m) return fail("NOT_ALLOWED");
  if (!sourcePathOk(m.company_id, sourceFilePath)) return fail("INVALID_FORM_SOURCE");
  const supabase = await createClient();
  const { data } = await supabase.storage.from("form-templates").createSignedUrl(sourceFilePath, 600);
  return data?.signedUrl ? { ok: true, url: data.signedUrl } : { ok: false, error: "원본 양식을 열지 못했어요." };
}

// 결의서 한 건을 회사 양식으로 PDF 내려받기(관리자 결의서 상세). PDF는 브라우저가 만든다(D-092)
export async function claimDocumentAction(claimId: string): Promise<Result<{ doc: ClaimDoc; layout: FormLayout | null; companyName: string }>> {
  const m = await admin();
  if (!m) return fail("NOT_ALLOWED");
  if (!UUID.test(claimId)) return fail("NOT_FOUND");
  const supabase = await createClient();
  const [docs, form, company] = await Promise.all([
    getClaimDocsByIds(m.company_id, [claimId]),
    getActiveForm(m.company_id),
    supabase.from("companies").select("name").eq("id", m.company_id).single(),
  ]);
  if (!docs[0]) return { ok: false, error: "결의서를 찾지 못했어요." };
  return { ok: true, doc: docs[0], layout: form?.layout ?? null, companyName: company.data?.name ?? "" };
}
