import "server-only";
import { reconcileStatus } from "@/lib/cards/saved";
import { getSavedReconcile } from "@/lib/cards/saved-server";
import { listHometax } from "@/lib/hometax/server";
import { createClient } from "@/lib/supabase/server";
import { getTaxMonth } from "@/lib/tax/closing";
import { getExportOptions } from "@/lib/tax/export-options";
import type { HometaxUpload } from "@/lib/hometax/kinds";
import type { ClosingInput } from "./closing-wizard";

// 월 마감 도우미(D-315) 데이터 — 세무 마감 화면과 같은 출처(권한·회사 격리는 각 DB 함수·RLS가 확인)
export async function getClosingData(companyId: string, month: string): Promise<{ input: ClosingInput; rows: number; hometax: HometaxUpload[] } | null> {
  const supabase = await createClient();
  const [y, m] = month.split("-").map(Number);
  const nextFirst = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
  const [res, saved, hometax, { data: pendingItems }, options, cardCount] = await Promise.all([
    getTaxMonth(month),
    getSavedReconcile(companyId, month),
    listHometax(companyId, month),
    supabase.from("expense_items").select("claim_id, expense_claims!inner(status)").eq("company_id", companyId).eq("expense_claims.status", "submitted").lt("expense_date", nextFirst).limit(1000),
    getExportOptions(companyId),
    supabase.from("corporate_cards").select("id", { count: "exact", head: true }).eq("company_id", companyId).eq("is_active", true),
  ]);
  if (!res.ok) return null;
  const st = reconcileStatus(saved);
  return {
    input: {
      month,
      pendingClaims: new Set((pendingItems ?? []).map((i) => i.claim_id)).size,
      hasCards: (cardCount.count ?? 0) > 0,
      card: st.kind === "none" ? { kind: "none" } : st.kind === "open" ? { kind: "open", open: st.open, total: st.total } : { kind: "done", total: st.total },
      hometaxFiles: hometax.length,
      closed: res.data.status === "closed",
      officeName: options.officeName,
    },
    rows: res.data.rows.length,
    hometax,
  };
}
