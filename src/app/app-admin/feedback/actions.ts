"use server";

import { refresh } from "next/cache";
import { getAppAdmin } from "@/lib/app-admin/guard";
import type { FeedbackStatus } from "@/lib/feedback-desk/format";

const STATUSES: FeedbackStatus[] = ["pending", "reviewing", "resolved"];

// 의견 상태(접수 → 검토 중 → 해결)·운영자 메모 (D-246). 앱 운영자만
export async function updateFeedbackAction(id: string, status: FeedbackStatus, note: string): Promise<{ error: string | null }> {
  const ok = await getAppAdmin();
  if (!ok) return { error: "운영자만 바꿀 수 있어요." };
  if (!STATUSES.includes(status) || !/^[0-9a-f-]{36}$/.test(id)) return { error: "잘못된 요청이에요." };
  const { error } = await ok.admin
    .from("feedback_logs")
    .update({
      status,
      operator_note: note.trim().slice(0, 1000) || null,
      resolved_at: status === "resolved" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { error: "바꾸지 못했어요. 다시 시도해 주세요." };
  refresh();
  return { error: null };
}
