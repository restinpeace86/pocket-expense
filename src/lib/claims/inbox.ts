import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { AdminClaimRow } from "./admin-list";

// 내 결재함 (approver.md ②) — 사전 검토자용: 대기(내 차례인 검토 단계) / 처리완료(내가 승인·반려한 소명서)
export async function getReviewerInbox(companyId: string, memberId: string, tab: "waiting" | "done"): Promise<AdminClaimRow[]> {
  const supabase = await createClient();
  const stepQ = supabase.from("claim_approvals").select("claim_id, acted_at").eq("company_id", companyId).eq("step_kind", "review");
  const { data: steps } =
    tab === "waiting"
      ? await stepQ.eq("approver_member_id", memberId).eq("status", "pending")
      : await stepQ.eq("acted_by_member_id", memberId).in("status", ["approved", "rejected"]).order("acted_at", { ascending: false }).limit(100);
  const ids = [...new Set((steps ?? []).map((s) => s.claim_id))];
  if (ids.length === 0) return [];
  const { data: claims } = await supabase
    .from("expense_claims")
    .select("id, title, status, is_business_trip, item_count, total_amount, settlement_required, self_approved, submitted_at, member_id")
    .in("id", ids)
    .eq("company_id", companyId);
  const memberIds = [...new Set((claims ?? []).map((c) => c.member_id))];
  const { data: members } = memberIds.length ? await supabase.from("members").select("id, name").in("id", memberIds) : { data: [] as { id: string; name: string }[] };
  const names = new Map((members ?? []).map((m) => [m.id, m.name]));
  const rows = (claims ?? []).map((c) => ({ ...c, member_name: names.get(c.member_id) ?? "", reviewing: null }));
  // 대기는 오래된 상신 순, 처리완료는 내가 처리한 순서(최근 먼저)
  const order = new Map(ids.map((id, i) => [id, i]));
  return tab === "waiting" ? rows.sort((a, b) => (a.submitted_at ?? "").localeCompare(b.submitted_at ?? "")) : rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

// 하단 메뉴 [결재함] 표시 여부와 대기 건수: 결재라인에 검토자로 들어 있거나 검토 차례가 있는 사람
export async function getReviewerBadge(companyId: string, memberId: string): Promise<{ isReviewer: boolean; waiting: number }> {
  const supabase = await createClient();
  const [{ count: waiting }, { count: inLine }] = await Promise.all([
    supabase.from("claim_approvals").select("id", { count: "exact", head: true }).eq("company_id", companyId).eq("approver_member_id", memberId).eq("status", "pending"),
    supabase.from("approval_line_steps").select("id", { count: "exact", head: true }).eq("company_id", companyId).eq("approver_member_id", memberId),
  ]);
  return { isReviewer: (waiting ?? 0) > 0 || (inLine ?? 0) > 0, waiting: waiting ?? 0 };
}

// 직원 하단 메뉴 [결재함] 표시 (D-082): 관리자 이상이 아닌 사전 검토자만, 내 검토 차례 건수.
// 관리자 이상은 결재를 관리자 모드 [지출 승인 관리]에서 하므로 직원 하단 메뉴에 결재함을 두지 않는다
// (누르면 관리자 화면으로 넘어가 하단 메뉴가 사라지던 문제).
export async function getInboxBadge(membership: { company_id: string; member_id: string; role: string }): Promise<{ waiting: number } | null> {
  if (membership.role === "super_admin" || membership.role === "admin") return null;
  const r = await getReviewerBadge(membership.company_id, membership.member_id);
  return r.isReviewer ? { waiting: r.waiting } : null;
}
