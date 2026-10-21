"use server";

import { refresh } from "next/cache";
import { getMembership } from "@/lib/auth/session";
import { isAdminRole } from "@/lib/auth/paths";
import { messageForDbError } from "@/lib/errors";
import { resendLog } from "@/lib/notify/dispatch";

// 실패한 알림 [재발송] (T11-4). 관리자만, 자기 회사 기록만(resendLog가 회사로 한정)
export async function resendNotificationAction(logId: string): Promise<{ ok: true; result: "sent" | "failed" } | { ok: false; error: string }> {
  const m = await getMembership();
  if (!m || m.status !== "approved" || !isAdminRole(m.role)) return { ok: false, error: messageForDbError({ message: "NOT_ALLOWED" }) };
  if (!/^[0-9a-f-]{36}$/i.test(logId)) return { ok: false, error: messageForDbError({ message: "NOT_FOUND" }) };
  const r = await resendLog(m.company_id, logId);
  if (r === "not_found") return { ok: false, error: "다시 보낼 수 없는 알림이에요(이미 처리됐거나 초대가 끝났어요). 화면을 새로고침해 주세요." };
  refresh();
  return { ok: true, result: r };
}
