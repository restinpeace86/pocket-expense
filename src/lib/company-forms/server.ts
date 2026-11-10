import "server-only";
import { PDFDocument } from "pdf-lib";
import { getMembership } from "@/lib/auth/session";
import { isAdminRole } from "@/lib/auth/paths";
import { DOC_BUCKET } from "@/lib/doc-convert/server";
import { isConvertible, MAX_PAGES } from "@/lib/doc-convert/model";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { readFormWithGemini } from "./gemini";
import { formErrorMessage, formFromAi, type FormKind } from "./model";

// 회사 양식 등록 서버 흐름(8-104 B). 권한·기록은 DB 함수(관리자), 파일 복사·삭제와 AI 읽기는 서버(운영 키)
type Admin = NonNullable<ReturnType<typeof createAdminClient>>;
export const FORM_BUCKET = "form-files";
const MAX_BYTES = 20 * 1024 * 1024;
const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" };
const UUID = /^[0-9a-f-]{36}$/;

type Result = { ok: true; id: string } | { ok: false; error: string };

async function removeFiles(admin: Admin, paths: (string | null | undefined)[]) {
  const list = paths.filter((p): p is string => !!p);
  if (list.length) await admin.storage.from(FORM_BUCKET).remove(list);
}

// 초안 만들기(파일은 이미 form-files/{회사}/{id}.{ext}에 있음). 실패하면 옮긴 파일을 지운다
async function start(admin: Admin, o: { id: string; group: string | null; name: string; mime: string; path: string; sourceName: string }): Promise<Result> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("company_form_start", {
    p_id: o.id, p_group: o.group as string, p_name: o.name, p_mime: o.mime, p_path: o.path, p_source_name: o.sourceName,
  });
  if (error) {
    await removeFiles(admin, [o.path]);
    return { ok: false, error: formErrorMessage(error.message) };
  }
  await removeFiles(admin, [(data as { removed?: string | null } | null)?.removed]);
  return { ok: true, id: o.id };
}

const stripExt = (n: string) => n.replace(/\.[a-z0-9]{2,5}$/i, "").trim().slice(0, 60) || "회사 양식";

// 채팅 사진·PDF → 초안(관리자 · 그 방 참여자). chat-files → form-files 복사(채팅 보관 기간과 따로)
export async function startFormFromChat(messageId: string, group: string | null): Promise<Result> {
  if (!UUID.test(messageId) || (group !== null && !UUID.test(group))) return { ok: false, error: formErrorMessage("NOT_FOUND") };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("company_form_check", { p_message: messageId });
  if (error || !data) return { ok: false, error: formErrorMessage(error?.message ?? "") };
  const c = data as unknown as { company_id: string; name: string; mime: string; size: number; path: string };
  if (c.size > MAX_BYTES) return { ok: false, error: formErrorMessage("TOO_LARGE") };
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: formErrorMessage("") };
  const id = crypto.randomUUID();
  const path = `${c.company_id}/${id}.${EXT[c.mime]}`;
  const copied = await admin.storage.from("chat-files").copy(c.path, path, { destinationBucket: FORM_BUCKET });
  if (copied.error) return { ok: false, error: formErrorMessage("EXPIRED") };
  return start(admin, { id, group, name: stripExt(c.name), mime: c.mime, path, sourceName: c.name });
}

// 기기에서 고른 파일(브라우저가 doc-files/{회사}/{나}/{id}.{ext}에 올린 뒤) → form-files로 옮겨 초안
export async function startFormFromUpload(id: string, name: string, mime: string, group: string | null): Promise<Result> {
  if (!UUID.test(id) || !isConvertible(mime) || (group !== null && !UUID.test(group))) return { ok: false, error: formErrorMessage("NOT_CONVERTIBLE") };
  const m = await getMembership();
  if (!m || m.status !== "approved" || !isAdminRole(m.role)) return { ok: false, error: formErrorMessage("NOT_ALLOWED") };
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: formErrorMessage("") };
  const from = `${m.company_id}/${m.member_id}/${id}.${EXT[mime]}`;
  const path = `${m.company_id}/${id}.${EXT[mime]}`;
  const copied = await admin.storage.from(DOC_BUCKET).copy(from, path, { destinationBucket: FORM_BUCKET });
  await admin.storage.from(DOC_BUCKET).remove([from]);
  if (copied.error) return { ok: false, error: formErrorMessage("EXPIRED") };
  const sourceName = name.slice(0, 255) || "양식";
  return start(admin, { id, group, name: stripExt(sourceName), mime, path, sourceName });
}

async function pageCount(data: ArrayBuffer, mime: string): Promise<number> {
  if (mime !== "application/pdf") return 1;
  const pdf = await PDFDocument.load(data, { ignoreEncryption: true, updateMetadata: false });
  return pdf.getPageCount();
}

// AI로 읽기(처음·다시 읽기): 종류 정하기 + 칸 확인(DB) → 파일 읽기 → 표·칸 저장. 실패하면 읽은 횟수는 그대로
export async function readForm(id: string, kind: FormKind): Promise<Result> {
  if (!UUID.test(id) || (kind !== "leave" && kind !== "general")) return { ok: false, error: formErrorMessage("NOT_FOUND") };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("company_form_read_begin", { p_id: id, p_kind: kind });
  if (error || !data) return { ok: false, error: formErrorMessage(error?.message ?? "") };
  const b = data as unknown as { path: string; mime: string; removed: string | null };
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: formErrorMessage("") };
  await removeFiles(admin, [b.removed]);
  const { data: blob } = await admin.storage.from(FORM_BUCKET).download(b.path);
  if (!blob) return { ok: false, error: formErrorMessage("EXPIRED") };
  if (blob.size > MAX_BYTES) return { ok: false, error: formErrorMessage("TOO_LARGE") };
  const bytes = await blob.arrayBuffer();
  try {
    if ((await pageCount(bytes, b.mime)) > MAX_PAGES) return { ok: false, error: formErrorMessage("TOO_MANY_PAGES") };
  } catch {
    return { ok: false, error: "PDF를 열 수 없어요. 암호가 걸려 있으면 풀고 다시 올려 주세요." };
  }
  const pages = await readFormWithGemini({ data: bytes, mimeType: b.mime }, kind);
  const read = pages ? formFromAi(pages, kind) : null;
  if (!read) return { ok: false, error: formErrorMessage("NO_TABLE") };
  const { error: doneError } = await supabase.rpc("company_form_read_done", {
    p_id: id, p_name: read.title ?? "", p_sheets: read.doc as never, p_fields: read.fields as never,
  });
  if (doneError) return { ok: false, error: formErrorMessage(doneError.message) };
  return { ok: true, id };
}

export async function deleteForm(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!UUID.test(id)) return { ok: false, error: formErrorMessage("NOT_FOUND") };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("company_form_delete", { p_id: id });
  if (error) return { ok: false, error: formErrorMessage(error.message) };
  const admin = createAdminClient();
  if (admin) await removeFiles(admin, [data as string | null]);
  return { ok: true };
}

// 원본 보기 주소(10분). 부르는 쪽(관리자 화면)이 이미 관리자·같은 회사 양식인지 확인한 경로만 넘긴다
export async function signedFormSource(path: string): Promise<string | null> {
  const admin = createAdminClient();
  if (!admin) return null;
  const { data } = await admin.storage.from(FORM_BUCKET).createSignedUrl(path, 600);
  return data?.signedUrl ?? null;
}

// 새벽 작업: 30일 지난 초안 정리
export async function purgeFormDrafts(admin: Admin): Promise<{ removed: number }> {
  const { data, error } = await admin.rpc("company_form_due");
  if (error) throw new Error(error.message);
  const paths = (data as unknown as string[] | null) ?? [];
  for (let i = 0; i < paths.length; i += 100) await admin.storage.from(FORM_BUCKET).remove(paths.slice(i, i + 100));
  return { removed: paths.length };
}
