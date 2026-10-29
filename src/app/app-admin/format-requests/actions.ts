"use server";

import { refresh } from "next/cache";
import { getAppAdmin } from "@/lib/app-admin/guard";

// 회계 양식 접수 '준비 완료' 표시·되돌리기 (D-180): 앱 운영자만. 회사 화면의 상태(접수됨/준비 완료)가 바뀐다
export async function setFormatRequestDoneAction(id: string, done: boolean): Promise<{ error: string | null }> {
  const ok = await getAppAdmin();
  if (!ok) return { error: "운영자만 바꿀 수 있어요." };
  const { error } = await ok.admin
    .from("accounting_format_requests")
    .update({ status: done ? "done" : "received", done_at: done ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) return { error: "바꾸지 못했어요. 다시 시도해 주세요." };
  refresh();
  return { error: null };
}
