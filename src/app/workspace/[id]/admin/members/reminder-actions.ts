"use server";

import { refresh } from "next/cache";
import { getMembership } from "@/lib/auth/session";
import { isAdminRole } from "@/lib/auth/paths";
import { messageForDbError } from "@/lib/errors";
import { sendReminders } from "@/lib/notify/dispatch";
import { createClient } from "@/lib/supabase/server";

// 미제출자 독촉 보내기 (admin-team-members.md §E, D-043, D-094). 대상·하루 1회는 DB 함수 reminder_candidates(관리자만·자기 회사만)로 확인한다.
export async function sendRemindersAction(memberIds: string[]): Promise<{ ok: true; sent: number; skipped: string[] } | { ok: false; error: string }> {
  const m = await getMembership();
  if (!m || m.status !== "approved" || !isAdminRole(m.role)) return { ok: false, error: messageForDbError({ message: "NOT_ALLOWED" }) };
  if (!memberIds.length || memberIds.length > 500) return { ok: false, error: "보낼 사람을 골라 주세요." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("reminder_candidates");
  if (error) return { ok: false, error: messageForDbError(error) };
  const byId = new Map((data ?? []).map((c) => [c.member_id, c]));
  const skipped: string[] = [];
  const targets: { memberId: string; openClaims: number }[] = [];
  for (const id of memberIds) {
    const c = byId.get(id);
    if (!c) continue; // 대상이 아니게 됨(그 사이 상신함 등)
    if (c.reminded_today) skipped.push(`${c.name}(오늘 이미 보냄)`);
    else targets.push({ memberId: id, openClaims: c.open_claims });
  }
  const sent = await sendReminders(m.company_id, targets);
  refresh();
  return { ok: true, sent, skipped };
}
