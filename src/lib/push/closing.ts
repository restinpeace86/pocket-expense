import "server-only";
import { closingNotice, type ClosingKind } from "@/lib/notify/templates";
import { createAdminClient } from "@/lib/supabase/admin";
import { postNoticeCards } from "@/lib/notify/card";
import { pushConfigured, pushToMembers } from "./server";

// 관리자 월말 마감 알림 (D-161, 개선사항 1). 매일 아침 cron이 부른다(service role).
// 1일 마감 주간 시작(전체 관리자) / 3일 홈택스 자료 0개·승인 대기 / 5일 세무 마감 안 함·승인 대기(D-166) — 쉬는 날이면 앞 영업일(DB가 계산).
// 앱 알림(웹푸시)만 — 알림톡은 보내지 않는다(D-213, 관리자 홈 배너·세무 마감 화면에도 보임). 같은 날 같은 알림은 한 번만(push_logs).
type Target = { company_id: string; member_id: string; kind: ClosingKind; month: string; cutoff: string; due: string; pending: number; hometax_missing: boolean; closed: boolean; has_cards?: boolean; card_missing?: boolean };

export async function runClosingReminders(today?: string): Promise<{ targets: number; pushed: number; alimtalk: number }> {
  const admin = createAdminClient();
  if (!admin) return { targets: 0, pushed: 0, alimtalk: 0 };
  const { data } = await admin.rpc("closing_admin_targets", today ? { p_today: today } : {});
  const rows = (data ?? []) as Target[];
  if (!rows.length) return { targets: 0, pushed: 0, alimtalk: 0 };
  const { data: companies } = await admin.from("companies").select("id, name").in("id", [...new Set(rows.map((r) => r.company_id))]);
  const names = new Map((companies ?? []).map((c) => [c.id, c.name]));
  let pushed = 0;
  const alimtalk = 0; // D-213: 월말 마감은 앱 알림만
  for (const t of rows) {
    // 오늘 처음인 대상만(cron이 여러 번 불려도 한 번)
    const { data: fresh } = await admin
      .from("push_logs")
      .upsert({ company_id: t.company_id, member_id: t.member_id, kind: "closing", ref: `${t.kind}:${t.month}` }, { onConflict: "member_id,kind,ref,sent_on", ignoreDuplicates: true })
      .select("member_id");
    if (!fresh?.length) continue;
    const input = {
      companyId: t.company_id,
      companyName: names.get(t.company_id) ?? "",
      kind: t.kind,
      month: t.month,
      cutoff: t.cutoff,
      due: t.due,
      pending: Number(t.pending ?? 0),
      hometaxMissing: !!t.hometax_missing,
      closed: !!t.closed,
      hasCards: !!t.has_cards,
      cardMissing: !!t.card_missing,
    };
    const msg = closingNotice(input);
    const title =
        t.kind === "week_start"
          ? "지출 마감 주간 시작"
          : input.pending > 0
            ? `승인 대기 ${input.pending}건 — ${t.kind === "close_due" ? "오늘" : "마감 전"}까지 처리해 주세요`
            : t.kind === "hometax_missing"
              ? input.hometaxMissing
                ? "홈택스 자료를 올려 주세요"
                : "법인카드 내역 대조를 해 주세요"
              : "오늘이 세무 마감일이에요";
    if (pushConfigured()) {
      const r = await pushToMembers(t.company_id, [t.member_id], { title, body: msg.text, url: msg.buttonPath, tag: "closing" });
      pushed += r.sent;
    }
    // 채팅 [알림]방 카드(D-224) — 앱 알림을 못 받는 기기여도 채팅에서 보인다
    await postNoticeCards(admin, t.company_id, [t.member_id], { title, lines: msg.text.split("\n").map((l) => l.replace(/^\[Moa-on\]\s*/, "").trim()).filter(Boolean), url: msg.buttonPath }).catch(() => 0);
  }
  return { targets: rows.length, pushed, alimtalk };
}
