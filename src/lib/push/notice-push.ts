import "server-only";
import { pushToMembers } from "@/lib/push/server";
import type { createAdminClient } from "@/lib/supabase/admin";

// [알림]방 글 중 아직 휴대폰 알림을 안 보낸 것(30분 안)을 보낸다 — 회의 10분 전(D-206)·근태(D-238)·버스(D-243)가 함께 쓴다
type Due = { id: string; room_id: string; company_id: string; member_id: string; body: string | null; link: string | null };

export function noticeIcon(first: string): string {
  if (/버스.*도착/.test(first)) return "🚌";
  if (/퇴근|정정 신청|휴일 근무|휴가/.test(first)) return "⏰";
  return "📅";
}

export async function sendDueNoticePushes(admin: NonNullable<ReturnType<typeof createAdminClient>>): Promise<{ ok: boolean; messages: number; sent: number }> {
  const { data, error } = await admin.rpc("chat_notice_push_due");
  if (error) return { ok: false, messages: 0, sent: 0 };
  const due = (data ?? []) as unknown as Due[];
  let sent = 0;
  for (const d of due) {
    const [first, ...rest] = (d.body ?? "").split("\n");
    const r = await pushToMembers(d.company_id, [d.member_id], {
      title: `${noticeIcon(first)} ${first || "알림"}`,
      body: rest.join(" · "),
      url: d.link ?? `/workspace/${d.company_id}/chat/${d.room_id}`,
      tag: `notice-${d.id}`,
      urgency: "high",
    }).catch(() => ({ sent: 0 }));
    sent += r.sent;
  }
  return { ok: true, messages: due.length, sent };
}
