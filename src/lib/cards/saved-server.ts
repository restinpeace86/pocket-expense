import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { SavedIssue, SavedReconcile } from "./saved";

// 저장된 카드 대조 결과 읽기 (D-154). RLS: 회사 관리자 또는 그 회사를 볼 수 있는 세무사무소 구성원
export async function getSavedReconcile(companyId: string, month: string): Promise<SavedReconcile | null> {
  const supabase = await createClient();
  const { data: rec } = await supabase
    .from("card_reconciliations")
    .select("id, month, file_name, period_from, period_to, matched, personal, missing, extra, cancelled, created_by_name, updated_at")
    .eq("company_id", companyId)
    .eq("month", month)
    .maybeSingle();
  if (!rec) return null;
  const { data: issues } = await supabase
    .from("card_reconcile_issues")
    .select("id, kind, expense_date, merchant, amount, last4, item_id, claim_title, member_name, status, memo, resolved_by_name, resolved_at")
    .eq("reconciliation_id", rec.id)
    .order("kind")
    .order("expense_date");
  return { ...rec, issues: (issues ?? []) as SavedIssue[] } as SavedReconcile;
}
