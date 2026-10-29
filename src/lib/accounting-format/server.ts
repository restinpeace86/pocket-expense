import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { FORMAT_BUCKET, FORMAT_EXT, FORMAT_MAX_BYTES, FORMAT_PROGRAM_LABEL, FORMAT_PROGRAMS, type FormatProgram, type FormatRequest } from "./programs";

const MIME: Record<string, string> = {
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xls: "application/vnd.ms-excel",
  csv: "text/csv; charset=utf-8",
};

// 회사 관리자: 등록한 양식(최근 것부터)
export async function listFormatRequests(companyId: string): Promise<FormatRequest[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("accounting_format_requests")
    .select("id, program, file_name, memo, status, created_at, done_at")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(20);
  return (data ?? []) as FormatRequest[];
}

export type PreparedFormat = { program: FormatProgram; memo: string; path: string; fileName: string; fileSize: number; cleanup: () => Promise<void> };

// 확인 → 보관함 저장. 기록(DB 함수)은 부르는 쪽이, 실패하면 cleanup으로 파일을 지운다
export async function prepareFormatUpload(companyId: string, formData: FormData): Promise<PreparedFormat | { error: string }> {
  const program = String(formData.get("program") ?? "") as FormatProgram;
  const memo = String(formData.get("memo") ?? "").slice(0, 300);
  const file = formData.get("file");
  if (!FORMAT_PROGRAMS.includes(program)) return { error: "회계 프로그램을 골라 주세요." };
  if (!(file instanceof File) || file.size === 0) return { error: "파일을 골라 주세요." };
  if (file.size > FORMAT_MAX_BYTES) return { error: "5MB 이하 파일만 올릴 수 있어요." };
  const ext = FORMAT_EXT.exec(file.name)?.[1]?.toLowerCase();
  if (!ext) return { error: "엑셀(.xlsx·.xls)이나 .csv 파일만 올릴 수 있어요." };
  const storage = createAdminClient();
  if (!storage) return { error: "지금은 파일을 저장할 수 없어요. 잠시 뒤 다시 시도해 주세요." };
  const path = `${companyId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await storage.storage.from(FORMAT_BUCKET).upload(path, new Uint8Array(await file.arrayBuffer()), { contentType: MIME[ext] });
  if (error) return { error: "파일을 저장하지 못했어요. 잠시 뒤 다시 시도해 주세요." };
  return {
    program,
    memo,
    path,
    fileName: file.name.slice(0, 200),
    fileSize: file.size,
    cleanup: async () => {
      await storage.storage.from(FORMAT_BUCKET).remove([path]);
    },
  };
}

// 운영자 알림(디스코드). 주소가 없거나 실패해도 접수는 그대로(운영자 화면 [양식 접수]에 남는다)
export async function notifyFormatRequest(companyName: string, program: FormatProgram): Promise<void> {
  const url = process.env.DISCORD_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: `📥 [PocketExpense] 회계 양식 접수: ${companyName} · ${FORMAT_PROGRAM_LABEL[program]} — 운영자 화면 [양식 접수]에서 확인` }),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // 알림 실패는 무시
  }
}

// 운영자: 원본 받기(운영 키)
export async function formatFileResponse(admin: NonNullable<ReturnType<typeof createAdminClient>>, id: string): Promise<Response> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return new Response("Not Found", { status: 404 });
  const { data: row } = await admin.from("accounting_format_requests").select("file_path, file_name").eq("id", id).maybeSingle();
  if (!row) return new Response("Not Found", { status: 404 });
  const { data: blob } = await admin.storage.from(FORMAT_BUCKET).download(row.file_path);
  if (!blob) return new Response("Not Found", { status: 404 });
  const ext = row.file_path.split(".").pop() ?? "";
  return new Response(blob, {
    headers: {
      "Content-Type": MIME[ext] ?? "application/octet-stream",
      "Content-Disposition": `attachment; filename="format.${ext}"; filename*=UTF-8''${encodeURIComponent(row.file_name)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
