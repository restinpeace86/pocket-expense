import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import { FEEDBACK_BUCKET } from "./format";

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

// 운영자: 캡처 보기(운영 키, 화면 안에서 열림)
export async function feedbackShotResponse(admin: Admin, id: string): Promise<Response> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return new Response("Not Found", { status: 404 });
  const { data: row } = await admin.from("feedback_logs").select("shot_path").eq("id", id).maybeSingle();
  if (!row?.shot_path) return new Response("Not Found", { status: 404 });
  const { data: blob } = await admin.storage.from(FEEDBACK_BUCKET).download(row.shot_path);
  if (!blob) return new Response("Not Found", { status: 404 });
  return new Response(blob, { headers: { "Content-Type": blob.type || "image/jpeg", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}

// 새벽 정리: 해결된 지 1년 지난 의견과 캡처
export async function purgeFeedback(admin: Admin): Promise<{ removed: number }> {
  const { data, error } = await admin.rpc("feedback_due");
  if (error) throw new Error(error.message);
  const paths = (data ?? []).map((r) => r.shot_path).filter((p): p is string => !!p);
  if (paths.length) await admin.storage.from(FEEDBACK_BUCKET).remove(paths);
  return { removed: (data ?? []).length };
}
