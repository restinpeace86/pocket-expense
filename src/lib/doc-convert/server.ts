import "server-only";
import { PDFDocument } from "pdf-lib";
import { getMembership } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { readTablesWithGemini } from "./gemini";
import { convertErrorMessage, docFromAi, isConvertible, MAX_PAGES } from "./model";

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;
export const DOC_BUCKET = "doc-files";
const MAX_BYTES = 20 * 1024 * 1024;
const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" };

type Result = { ok: true; id: string } | { ok: false; error: string };

async function pageCount(data: ArrayBuffer, mime: string): Promise<number> {
  if (mime !== "application/pdf") return 1;
  const pdf = await PDFDocument.load(data, { ignoreEncryption: true, updateMetadata: false });
  return pdf.getPageCount();
}

// 공통: 쪽 수 확인 → 크레딧 차감(begin) → AI 읽기 → 표 저장(ready). 표를 못 찾거나 AI 오류면 돌려주고(fail) 원본도 지운다
async function run(admin: Admin, o: { id: string; memberId: string; name: string; mime: string; path: string; messageId: string | null }): Promise<Result> {
  const { data: blob } = await admin.storage.from(DOC_BUCKET).download(o.path);
  if (!blob) return { ok: false, error: convertErrorMessage("EXPIRED") };
  if (blob.size > MAX_BYTES) {
    await admin.storage.from(DOC_BUCKET).remove([o.path]);
    return { ok: false, error: convertErrorMessage("TOO_LARGE") };
  }
  const data = await blob.arrayBuffer();
  let pages = 1;
  try {
    pages = await pageCount(data, o.mime);
  } catch {
    await admin.storage.from(DOC_BUCKET).remove([o.path]);
    return { ok: false, error: "PDF를 열 수 없어요. 암호가 걸려 있으면 풀고 다시 올려 주세요." };
  }
  if (pages > MAX_PAGES) {
    await admin.storage.from(DOC_BUCKET).remove([o.path]);
    return { ok: false, error: convertErrorMessage("TOO_MANY_PAGES") };
  }
  const { error: beginError } = await admin.rpc("doc_convert_begin", {
    p_id: o.id, p_member: o.memberId, p_name: o.name, p_mime: o.mime, p_path: o.path, p_pages: pages, p_message: o.messageId as string,
  });
  if (beginError) {
    await admin.storage.from(DOC_BUCKET).remove([o.path]);
    return { ok: false, error: convertErrorMessage(beginError.message) };
  }
  const read = await readTablesWithGemini({ data, mimeType: o.mime });
  const doc = read ? docFromAi(read) : null;
  if (!doc) {
    await admin.rpc("doc_convert_fail", { p_id: o.id });
    await admin.storage.from(DOC_BUCKET).remove([o.path]);
    return { ok: false, error: convertErrorMessage("NO_TABLE") };
  }
  const { error } = await admin.rpc("doc_convert_ready", { p_id: o.id, p_sheets: doc as never });
  if (error) {
    await admin.rpc("doc_convert_fail", { p_id: o.id });
    await admin.storage.from(DOC_BUCKET).remove([o.path]);
    return { ok: false, error: convertErrorMessage("") };
  }
  return { ok: true, id: o.id };
}

// 채팅 사진·PDF → 변환: 사용자 권한으로 확인(방 참여자) → chat-files에서 doc-files로 복사(채팅 보관 기간과 따로)
export async function convertChatFile(messageId: string): Promise<Result> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("doc_convert_check", { p_message: messageId });
  if (error || !data) return { ok: false, error: convertErrorMessage(error?.message ?? "") };
  const c = data as unknown as { member_id: string; company_id: string; message_id: string; name: string; mime: string; size: number; path: string };
  if (c.size > MAX_BYTES) return { ok: false, error: convertErrorMessage("TOO_LARGE") };
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: convertErrorMessage("") };
  const id = crypto.randomUUID();
  const path = `${c.company_id}/${c.member_id}/${id}.${EXT[c.mime]}`;
  const copied = await admin.storage.from("chat-files").copy(c.path, path, { destinationBucket: DOC_BUCKET });
  if (copied.error) return { ok: false, error: convertErrorMessage("EXPIRED") };
  return run(admin, { id, memberId: c.member_id, name: c.name, mime: c.mime, path, messageId: c.message_id });
}

// 기기에서 고른 파일(브라우저가 doc-files/{회사}/{나}/{id}.{ext}에 올린 뒤) → 변환
export async function convertUploadedFile(id: string, name: string, mime: string): Promise<Result> {
  if (!/^[0-9a-f-]{36}$/.test(id) || !isConvertible(mime)) return { ok: false, error: convertErrorMessage("NOT_CONVERTIBLE") };
  const m = await getMembership();
  if (!m || m.status !== "approved") return { ok: false, error: convertErrorMessage("NOT_FOUND") };
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: convertErrorMessage("") };
  const path = `${m.company_id}/${m.member_id}/${id}.${EXT[mime]}`;
  return run(admin, { id, memberId: m.member_id, name: name.slice(0, 255) || "서류", mime, path, messageId: null });
}

// 지우기: 권한·기록은 DB 함수(만든 사람·회사 공유는 관리자), 원본 파일은 서버
export async function deleteConversion(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("doc_convert_delete", { p_id: id });
  if (error) return { ok: false, error: convertErrorMessage(error.message) };
  const admin = createAdminClient();
  if (admin && data) await admin.storage.from(DOC_BUCKET).remove([data as string]);
  return { ok: true };
}

// 새벽 작업: 30일 지난 초안·멈춘 변환 정리(멈춘 건 크레딧 돌려줌)
export async function purgeConversions(admin: Admin): Promise<{ removed: number }> {
  const { data, error } = await admin.rpc("doc_convert_due");
  if (error) throw new Error(error.message);
  const paths = (data as unknown as string[] | null) ?? [];
  for (let i = 0; i < paths.length; i += 100) await admin.storage.from(DOC_BUCKET).remove(paths.slice(i, i + 100));
  return { removed: paths.length };
}
