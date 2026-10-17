import "server-only";
import type { MemberRow } from "@/components/admin/members-view";
import { createClient } from "@/lib/supabase/server";

// 관리자 화면 조회. 사용자 세션으로 조회하므로 RLS가 자기 회사만 돌려준다(회사 필터를 명시해 인덱스도 탄다).
export async function getMembers(companyId: string): Promise<MemberRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("members")
    .select("id, name, phone, email, position, role, status, created_at, department:departments(name)")
    .eq("company_id", companyId)
    .order("created_at", { ascending: true });
  return (data ?? []).map((m) => ({
    id: m.id,
    name: m.name,
    phone: m.phone,
    email: m.email,
    position: m.position,
    role: m.role,
    status: m.status,
    created_at: m.created_at,
    department: (m.department as { name: string } | null)?.name ?? null,
  }));
}

export async function getCompanySummary(companyId: string) {
  const supabase = await createClient();
  const [{ data: company }, { count: pendingCount }] = await Promise.all([
    supabase.from("companies").select("name, invite_code, receipt_credits_granted, receipt_credits_used").eq("id", companyId).single(),
    supabase.from("members").select("id", { count: "exact", head: true }).eq("company_id", companyId).eq("status", "pending"),
  ]);
  return { company, pendingCount: pendingCount ?? 0 };
}
