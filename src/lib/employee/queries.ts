import "server-only";
import { monthRange } from "@/lib/dates";
import type { ClaimStatus } from "@/lib/expense/status";
import type { EmployeeSummary, MyClaimRow } from "./types";
import { decodeCursor, keysetFilter, toPage } from "@/lib/pagination";
import { createClient } from "@/lib/supabase/server";

// 직원 화면 조회 — 본인 결의서만(RLS도 본인·관리자·검토자만 보이게 막지만, 직원 모드에서는 본인 것만 명시적으로 고른다: workspace-architecture §2.D)

export async function getMyClaims(
  companyId: string,
  memberId: string,
  opts: { month: string; statuses: readonly ClaimStatus[] | null; cursor?: string | null; limit?: number },
) {
  const supabase = await createClient();
  const limit = opts.limit ?? 20;
  const { start, end } = monthRange(opts.month);
  let q = supabase
    .from("expense_claims")
    .select("id, title, status, is_business_trip, item_count, total_amount, settlement_required, created_at, rejection_reason, rejected_at, items:expense_items(expense_date, payment_method, category)")
    .eq("company_id", companyId)
    .eq("member_id", memberId)
    .gte("created_at", `${start}T00:00:00+09:00`)
    .lt("created_at", `${end}T00:00:00+09:00`)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1);
  if (opts.statuses) q = q.in("status", [...opts.statuses]);
  const cursor = decodeCursor(opts.cursor);
  if (cursor) q = q.or(keysetFilter("created_at", cursor));
  const { data } = await q;
  const rows: MyClaimRow[] = (data ?? []).map((c) => {
    const items = (c.items ?? []) as { expense_date: string | null; payment_method: string; category: string | null }[];
    const dates = items.map((i) => i.expense_date).filter((d): d is string => !!d).sort();
    return {
      id: c.id,
      title: c.title,
      status: c.status,
      is_business_trip: c.is_business_trip,
      item_count: c.item_count,
      total_amount: c.total_amount,
      settlement_required: c.settlement_required,
      created_at: c.created_at,
      rejection_reason: c.rejection_reason,
      rejected_at: c.rejected_at,
      dateFrom: dates[0] ?? null,
      dateTo: dates[dates.length - 1] ?? null,
      corporateCount: items.filter((i) => i.payment_method === "corporate_card").length,
      personalCount: items.filter((i) => i.payment_method === "personal_card").length,
      categories: [...new Set(items.map((i) => i.category).filter((x): x is string => !!x))],
    };
  });
  return toPage(rows, limit, (r) => r.created_at);
}

export async function getMySummary(): Promise<EmployeeSummary> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_employee_summary");
  return (data as unknown as EmployeeSummary) ?? { pending_payout: 0, rejected_count: 0, credits_left: 0 };
}
