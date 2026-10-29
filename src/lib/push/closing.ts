import "server-only";
import { sendClosingNotice } from "@/lib/notify/dispatch";
import { closingNotice, type ClosingKind } from "@/lib/notify/templates";
import { createAdminClient } from "@/lib/supabase/admin";
import { pushConfigured, pushToMembers } from "./server";

// 관리자 월말 마감 알림 (D-161, 개선사항 1). 매일 아침 cron이 부른다(service role).
// 1일 마감 주간 시작(전체 관리자) / 3일 그 달 홈택스 자료 0개 / 5일 그 달 세무 마감 안 함 — 쉬는 날이면 앞 영업일(DB가 계산).
// 웹푸시 + 알림톡(대행사 연결 전에는 기록만, O-01). 같은 날 같은 알림은 한 번만(push_logs).
type Target = { company_id: string; member_id: string; kind: ClosingKind; month: string; cutoff: string; due: string };

export async function runClosingReminders(today?: string): Promise<{ targets: number; pushed: number; alimtalk: number }> {
  const admin = createAdminClient();
  if (!admin) return { targets: 0, pushed: 0, alimtalk: 0 };
  const { data } = await admin.rpc("closing_admin_targets", today ? { p_today: today } : {});
  const rows = (data ?? []) as Target[];
  if (!rows.length) return { targets: 0, pushed: 0, alimtalk: 0 };
  const { data: companies } = await admin.from("companies").select("id, name").in("id", [...new Set(rows.map((r) => r.company_id))]);
  const names = new Map((companies ?? []).map((c) => [c.id, c.name]));
  let pushed = 0;
  let alimtalk = 0;
  for (const t of rows) {
    // 오늘 처음인 대상만(cron이 여러 번 불려도 한 번)
    const { data: fresh } = await admin
      .from("push_logs")
      .upsert({ company_id: t.company_id, member_id: t.member_id, kind: "closing", ref: `${t.kind}:${t.month}` }, { onConflict: "member_id,kind,ref,sent_on", ignoreDuplicates: true })
      .select("member_id");
    if (!fresh?.length) continue;
    const msg = closingNotice({ companyId: t.company_id, companyName: names.get(t.company_id) ?? "", kind: t.kind, month: t.month, cutoff: t.cutoff, due: t.due });
    if (pushConfigured()) {
      const title = t.kind === "week_start" ? "지출 마감 주간 시작" : t.kind === "hometax_missing" ? "홈택스 자료를 올려 주세요" : "오늘이 세무 마감일이에요";
      const r = await pushToMembers(t.company_id, [t.member_id], { title, body: msg.text, url: msg.buttonPath, tag: "closing" });
      pushed += r.sent;
    }
    if (await sendClosingNotice({ companyId: t.company_id, companyName: names.get(t.company_id) ?? "", memberId: t.member_id, kind: t.kind, month: t.month, cutoff: t.cutoff, due: t.due })) alimtalk++;
  }
  return { targets: rows.length, pushed, alimtalk };
}
