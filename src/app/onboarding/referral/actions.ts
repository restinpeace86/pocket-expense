"use server";

import { redirect } from "next/navigation";
import { workspaceHome } from "@/lib/auth/paths";
import { getMembership } from "@/lib/auth/session";
import { messageForDbError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";

export type ReferralState = { error: string | null };
export type ReferralCompany = { id: string; name: string };

// 추천 회사 검색(이름 2자 이상, 8곳까지, 자기 회사 제외 — DB 함수에서 제한, D-147)
export async function searchReferralCompaniesAction(query: string): Promise<ReferralCompany[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_referral_companies", { p_query: q.slice(0, 50) });
  if (error) return [];
  return (data ?? []) as ReferralCompany[];
}

// 추천 저장(회사당 1회) → 관리자 홈
export async function saveReferralAction(_prev: ReferralState, formData: FormData): Promise<ReferralState> {
  const kind = String(formData.get("kind") ?? "");
  const supabase = await createClient();
  const text = (key: string) => String(formData.get(key) ?? "");
  // 고르지 않은 쪽은 null (생성 타입은 null을 표현하지 못함)
  const { error } = await supabase.rpc("save_company_referral", {
    p_kind: kind,
    p_referrer_company_id: (kind === "company" ? text("companyId") || null : null) as string,
    p_referrer_name: (kind === "person" ? text("name") : null) as string,
    p_referrer_phone: (kind === "person" ? text("phone") : null) as string,
  });
  if (error) {
    // 이미 저장됐으면 다시 적을 일이 없으니 그냥 홈으로
    if (error.message !== "REFERRAL_ALREADY_SAVED") return { error: messageForDbError(error) };
  }
  const membership = await getMembership();
  redirect(membership ? workspaceHome(membership) : "/onboarding");
}
