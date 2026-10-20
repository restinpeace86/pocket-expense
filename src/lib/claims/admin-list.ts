import "server-only";
import { monthRange } from "@/lib/dates";
import type { ClaimStatus } from "@/lib/expense/status";
import { createClient } from "@/lib/supabase/server";
import type { ClaimFilters } from "./filters";

// 지출 승인 관리 목록 (admin-expense-approvals.md §4.A·B). 같은 회사만(RLS), 작성 중(draft)은 보이지 않는다.
export type ApprovalTab = "pending" | "done" | "rejected";
export const APPROVAL_TABS: { key: ApprovalTab; label: string }[] = [
  { key: "pending", label: "승인 대기" },
  { key: "done", label: "승인 완료" },
  { key: "rejected", label: "반려됨" },
];
export const parseApprovalTab = (v: unknown): ApprovalTab => (v === "done" || v === "rejected" ? v : "pending");

export type AdminClaimRow = {
  id: string;
  title: string;
  status: ClaimStatus;
  is_business_trip: boolean;
  item_count: number;
  total_amount: number;
  settlement_required: boolean | null;
  self_approved: boolean;
  submitted_at: string | null;
  member_id: string;
  member_name: string;
  reviewing: string | null; // 사전 검토 중이면 검토자 이름
};

export async function getAdminClaimList(companyId: string, tab: ApprovalTab, filters?: ClaimFilters, limit = 100) {
  const supabase = await createClient();
  const statuses: ClaimStatus[] = tab === "pending" ? ["submitted"] : tab === "done" ? ["approved", "paid"] : ["rejected"];
  let q = supabase
    .from("expense_claims")
    .select("id, title, status, is_business_trip, item_count, total_amount, settlement_required, self_approved, submitted_at, approved_at, rejected_at, member_id")
    .eq("company_id", companyId)
    .in("status", statuses)
    .limit(limit);
  // 승인 대기는 오래된 상신 순, 나머지는 최근 순
  if (filters) {
    // 부서·직원
    let memberIds: string[] | null = null;
    if (filters.department) {
      const { data } = await supabase.from("members").select("id").eq("company_id", companyId).eq("department_id", filters.department);
      memberIds = (data ?? []).map((m) => m.id);
    }
    if (filters.member) memberIds = memberIds ? memberIds.filter((id) => id === filters.member) : [filters.member];
    if (memberIds) {
      if (memberIds.length === 0) return { list: [], pendingCount: await countPending(companyId) };
      q = q.in("member_id", memberIds);
    }
    // 월(항목 사용일자)·카테고리 → 해당 항목이 든 소명서
    if (filters.month || filters.category) {
      let iq = supabase.from("expense_items").select("claim_id").eq("company_id", companyId).limit(5000);
      if (filters.month) {
        const { start, end } = monthRange(filters.month);
        iq = iq.gte("expense_date", start).lt("expense_date", end);
      }
      if (filters.category) iq = iq.eq("category", filters.category);
      const ids = [...new Set(((await iq).data ?? []).map((i) => i.claim_id))];
      if (ids.length === 0) return { list: [], pendingCount: await countPending(companyId) };
      q = q.in("id", ids.slice(0, 1000));
    }
    // 검색: 소명서 제목 또는 가맹점명
    if (filters.q) {
      const { data } = await supabase.from("expense_items").select("claim_id").eq("company_id", companyId).ilike("merchant_name", `%${filters.q}%`).limit(1000);
      const ids = [...new Set((data ?? []).map((i) => i.claim_id))];
      q = q.or(ids.length ? `title.ilike."%${filters.q}%",id.in.(${ids.join(",")})` : `title.ilike."%${filters.q}%"`);
    }
  }
  q = tab === "pending" ? q.order("submitted_at", { ascending: true }) : tab === "done" ? q.order("approved_at", { ascending: false }) : q.order("rejected_at", { ascending: false });
  const [{ data: claims }, { count: pendingCount }] = await Promise.all([
    q,
    supabase.from("expense_claims").select("id", { count: "exact", head: true }).eq("company_id", companyId).eq("status", "submitted"),
  ]);
  const rows = claims ?? [];
  const memberIds = [...new Set(rows.map((c) => c.member_id))];
  const [{ data: members }, { data: steps }] = await Promise.all([
    memberIds.length ? supabase.from("members").select("id, name").in("id", memberIds) : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    tab === "pending" && rows.length
      ? supabase.from("claim_approvals").select("claim_id, approver_member_id").in("claim_id", rows.map((c) => c.id)).eq("status", "pending").eq("step_kind", "review")
      : Promise.resolve({ data: [] as { claim_id: string; approver_member_id: string | null }[] }),
  ]);
  const names = new Map((members ?? []).map((m) => [m.id, m.name]));
  const reviewerIds = [...new Set((steps ?? []).map((s) => s.approver_member_id).filter((x): x is string => !!x && !names.has(x)))];
  if (reviewerIds.length) {
    const { data: more } = await supabase.from("members").select("id, name").in("id", reviewerIds);
    for (const m of more ?? []) names.set(m.id, m.name);
  }
  const reviewing = new Map((steps ?? []).map((s) => [s.claim_id, s.approver_member_id ? (names.get(s.approver_member_id) ?? "사전 검토자") : "사전 검토자"]));
  const list: AdminClaimRow[] = rows.map((c) => ({
    id: c.id,
    title: c.title,
    status: c.status,
    is_business_trip: c.is_business_trip,
    item_count: c.item_count,
    total_amount: c.total_amount,
    settlement_required: c.settlement_required,
    self_approved: c.self_approved,
    submitted_at: c.submitted_at,
    member_id: c.member_id,
    member_name: names.get(c.member_id) ?? "",
    reviewing: reviewing.get(c.id) ?? null,
  }));
  return { list, pendingCount: pendingCount ?? 0 };
}

async function countPending(companyId: string) {
  const supabase = await createClient();
  const { count } = await supabase.from("expense_claims").select("id", { count: "exact", head: true }).eq("company_id", companyId).eq("status", "submitted");
  return count ?? 0;
}
