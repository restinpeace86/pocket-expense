"use server";

import { headers } from "next/headers";
import { getMembership } from "@/lib/auth/session";
import { messageForDbError } from "@/lib/errors";
import { FEEDBACK_BUCKET, FEEDBACK_ERROR, FEEDBACK_SHOT_TYPES, feedbackInputError, feedbackNotifyText, feedbackPagePath, type FeedbackCategory } from "@/lib/feedback-desk/format";
import { notifyFeedback } from "@/lib/feedback-desk/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const SHOT_LIMIT = 5 * 1024 * 1024;

// 의견 보내기(D-246): 운영자에게 버그 신고·기능 개선. 회사·보낸 사람은 로그인에서, 하루 5건(회사)은 DB 함수가 다시 확인
export async function submitFeedbackAction(formData: FormData): Promise<{ ok: true } | { ok: false; error: string; login?: boolean }> {
  const m = await getMembership();
  if (!m) return { ok: false, error: "로그인이 풀렸어요. 다시 로그인한 뒤 보내 주세요.", login: true };
  if (m.status !== "approved") return { ok: false, error: messageForDbError({ message: "NOT_A_MEMBER" }) };
  const category = String(formData.get("category") ?? "");
  const content = String(formData.get("content") ?? "");
  const invalid = feedbackInputError(category, content);
  if (invalid) return { ok: false, error: invalid };
  const cat = category as FeedbackCategory;
  const shot = formData.get("shot");
  const id = crypto.randomUUID();
  let shotPath: string | null = null;
  const admin = createAdminClient();
  if (cat === "bug" && shot instanceof File && shot.size > 0) {
    const ext = FEEDBACK_SHOT_TYPES[shot.type];
    if (!ext) return { ok: false, error: FEEDBACK_ERROR.shotType };
    if (shot.size > SHOT_LIMIT) return { ok: false, error: FEEDBACK_ERROR.shotSize };
    if (!admin) return { ok: false, error: FEEDBACK_ERROR.failed };
    shotPath = `${m.company_id}/${id}.${ext}`;
    const { error } = await admin.storage.from(FEEDBACK_BUCKET).upload(shotPath, new Uint8Array(await shot.arrayBuffer()), { contentType: shot.type });
    if (error) return { ok: false, error: FEEDBACK_ERROR.failed };
  }
  const h = await headers();
  const supabase = await createClient();
  const { error } = await supabase.rpc("feedback_submit", {
    p_id: id,
    p_category: cat,
    p_content: content,
    p_page_url: feedbackPagePath(String(formData.get("page") ?? "")),
    p_user_agent: (h.get("user-agent") ?? "").slice(0, 300),
    p_viewport: String(formData.get("viewport") ?? "").slice(0, 20),
    p_app_version: (process.env.VERCEL_GIT_COMMIT_SHA ?? "local").slice(0, 7),
    p_shot_path: shotPath as string,
  });
  if (error) {
    if (shotPath && admin) await admin.storage.from(FEEDBACK_BUCKET).remove([shotPath]);
    return { ok: false, error: messageForDbError(error) };
  }
  await notifyFeedback(feedbackNotifyText(m.company_name, m.name ?? "직원", cat, content, !!shotPath));
  return { ok: true };
}
