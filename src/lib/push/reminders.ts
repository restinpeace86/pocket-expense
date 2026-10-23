import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { pushToMembers } from "./server";

// 매일 아침 웹푸시 리마인더 (D-116). cron이 부른다(service role).
// 1) 정산 마감 D-3·당일: 회사 청구 기한이 "월 단위"(말일 / 다음 달 N일)인 회사의, 작성 중·반려 결의서가 있는 직원
// 2) 결재 대기 독촉: 상신 뒤 24시간 넘게 처리 안 된 결의서 — 검토자(사전 검토 단계) 또는 관리자(최종 단계)
// 같은 날 같은 알림은 한 번만(push_logs).
const md = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;

export async function runPushReminders(today?: string): Promise<{ deadline: number; approval: number }> {
  const admin = createAdminClient();
  if (!admin) return { deadline: 0, approval: 0 };
  let deadline = 0;
  let approval = 0;

  const { data: dl } = await admin.rpc("push_deadline_targets", today ? { p_today: today } : {});
  for (const t of (dl ?? []) as { company_id: string; member_id: string; deadline: string; days_left: number; open_claims: number }[]) {
    const title = t.days_left === 0 ? "오늘이 지출 정산 마감일이에요" : `지출 정산 마감 ${t.days_left}일 전`;
    const body =
      t.days_left === 0
        ? `오늘(${md(t.deadline)})까지 작성 중인 결의서 ${t.open_claims}건을 상신해 주세요.`
        : `이번 달 지출 정산 마감이 ${t.days_left}일 남았어요(${md(t.deadline)}까지). 작성 중인 결의서 ${t.open_claims}건을 상신해 주세요.`;
    const r = await pushToMembers(t.company_id, [t.member_id], { title, body, url: `/workspace/${t.company_id}/employee`, tag: "deadline" }, { kind: "deadline", ref: `${t.deadline}:${t.days_left}` });
    deadline += r.sent;
  }

  const { data: ap } = await admin.rpc("push_approval_targets", {});
  const rows = (ap ?? []) as { company_id: string; member_id: string; pending: number }[];
  const { data: roles } = rows.length ? await admin.from("members").select("id, role").in("id", rows.map((r) => r.member_id)) : { data: [] };
  const isAdmin = new Map((roles ?? []).map((m) => [m.id, m.role === "admin" || m.role === "super_admin"]));
  for (const t of rows) {
    const url = isAdmin.get(t.member_id) ? `/workspace/${t.company_id}/admin/claims` : `/workspace/${t.company_id}/approvals`;
    const r = await pushToMembers(t.company_id, [t.member_id], { title: `결재 대기 ${t.pending}건`, body: `현재 결재 대기 중인 지출결의서가 ${t.pending}건 있어요. 확인해 주세요.`, url, tag: "approval" }, { kind: "approval_pending", ref: "daily" });
    approval += r.sent;
  }
  return { deadline, approval };
}
