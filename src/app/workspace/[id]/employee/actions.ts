"use server";

import { redirect } from "next/navigation";
import { getMembership } from "@/lib/auth/session";
import { getMyClaims } from "@/lib/employee/queries";
import { filterStatuses, parseMonth } from "@/lib/expense/status";
import { messageForDbError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";

// 새 지출결의서(draft) 만들기 → 편집 화면으로 (worker-dashboard.md §3: 누르면 draft를 만들고 바로 촬영/선택 시트)
export async function createDraftClaimAction(): Promise<{ error: string } | never> {
  const membership = await getMembership();
  if (!membership || membership.status !== "approved") return { error: messageForDbError({ message: "NOT_A_MEMBER" }) };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("expense_claims")
    .insert({ company_id: membership.company_id, member_id: membership.member_id, title: "" })
    .select("id")
    .single();
  if (error || !data) return { error: messageForDbError(error) };
  redirect(`/workspace/${membership.company_id}/employee/claims/${data.id}/edit?add=1`);
}

// 내 결의서 다음 쪽 (커서 페이지, performance.md §3)
export async function loadMoreMyClaimsAction(month: string, filter: string, cursor: string) {
  const membership = await getMembership();
  if (!membership || membership.status !== "approved") return { items: [], nextCursor: null };
  return getMyClaims(membership.company_id, membership.member_id, { month: parseMonth(month), statuses: filterStatuses(filter), cursor });
}
