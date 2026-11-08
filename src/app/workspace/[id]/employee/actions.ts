"use server";

import { redirect } from "next/navigation";
import { getMembership } from "@/lib/auth/session";
import { creditEventEnabled } from "@/lib/credits";
import { getMyClaims, getMySummary } from "@/lib/employee/queries";
import { filterStatuses, parseMonth } from "@/lib/expense/status";
import { messageForDbError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";

// 새 지출결의서(draft) 만들기 → 편집 화면으로 (worker-dashboard.md §3: 누르면 draft를 만들고 바로 촬영/선택 시트)
export async function createDraftClaimAction(): Promise<{ error: string } | never> {
  const membership = await getMembership();
  if (!membership || membership.status !== "approved") return { error: messageForDbError({ message: "NOT_A_MEMBER" }) };
  // 회사 무료 사용량을 다 썼고 이벤트도 꺼져 있으면 만들지 않는다(D-046·D-054) — 하단 가운데 버튼은 어느 화면에서든 눌리므로 여기서 확인(D-235)
  if (!creditEventEnabled() && (await getMySummary()).credits_left <= 0) return { error: "회사 무료 사용량을 모두 사용했습니다. 관리자에게 문의하세요." };
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
