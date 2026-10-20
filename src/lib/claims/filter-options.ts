import "server-only";
import { createClient } from "@/lib/supabase/server";

// 필터 고르기 목록: 부서, 직원(활성·비활성 모두 — 퇴사자 소명서도 찾을 수 있게)
export async function getFilterOptions(companyId: string) {
  const supabase = await createClient();
  const [{ data: departments }, { data: members }] = await Promise.all([
    supabase.from("departments").select("id, name").eq("company_id", companyId).order("sort_order"),
    supabase.from("members").select("id, name").eq("company_id", companyId).in("status", ["approved", "inactive"]).order("name"),
  ]);
  return { departments: departments ?? [], members: members ?? [] };
}
