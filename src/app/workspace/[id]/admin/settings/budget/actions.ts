"use server";

import { refresh } from "next/cache";
import { budgetErrorMessage } from "@/lib/budget/format";
import { createClient } from "@/lib/supabase/server";

// 예산 저장(D-267): 전체 + 계정과목별을 통째로. 금액 확인·권한은 DB 함수(관리자, 프로부터)
export async function saveBudgetAction(total: number | null, titles: { account_title_id: string; amount: number }[]): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("budget_save", { p_total: total as number, p_titles: titles });
  if (error) return { ok: false, error: budgetErrorMessage(error.message) };
  refresh();
  return { ok: true };
}
