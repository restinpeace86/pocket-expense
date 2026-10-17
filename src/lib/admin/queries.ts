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
  const [{ data: company }, { count: pendingCount }, { count: approvedCount }] = await Promise.all([
    supabase
      .from("companies")
      .select(
        "name, invite_code, receipt_credits_granted, receipt_credits_used, policy_confirmed_at, meal_limit_enabled, meal_limit_per_person, fuel_enabled, fuel_rate_per_km, claim_deadline_type, claim_deadline_days",
      )
      .eq("id", companyId)
      .single(),
    supabase.from("members").select("id", { count: "exact", head: true }).eq("company_id", companyId).eq("status", "pending"),
    supabase.from("members").select("id", { count: "exact", head: true }).eq("company_id", companyId).eq("status", "approved"),
  ]);
  return { company, pendingCount: pendingCount ?? 0, approvedCount: approvedCount ?? 0 };
}

export type MemberDetail = MemberRow & { department_id: string | null; employee_number: string | null };

export async function getMember(companyId: string, memberId: string): Promise<MemberDetail | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("members")
    .select("id, name, phone, email, position, role, status, created_at, department_id, employee_number, department:departments(name)")
    .eq("company_id", companyId)
    .eq("id", memberId)
    .maybeSingle();
  if (!data) return null;
  return { ...data, department: (data.department as { name: string } | null)?.name ?? null };
}

export type DepartmentRow = { id: string; name: string; sort_order: number; memberCount: number; hasApprovalLine: boolean };

export async function getDepartments(companyId: string): Promise<DepartmentRow[]> {
  const supabase = await createClient();
  const [{ data: departments }, { data: members }, { data: lines }] = await Promise.all([
    supabase.from("departments").select("id, name, sort_order").eq("company_id", companyId).order("sort_order").order("name"),
    supabase.from("members").select("department_id").eq("company_id", companyId).neq("status", "inactive"),
    supabase.from("approval_lines").select("department_id").eq("company_id", companyId).not("department_id", "is", null),
  ]);
  const counts = new Map<string, number>();
  for (const m of members ?? []) if (m.department_id) counts.set(m.department_id, (counts.get(m.department_id) ?? 0) + 1);
  const withLine = new Set((lines ?? []).map((l) => l.department_id));
  return (departments ?? []).map((d) => ({ ...d, memberCount: counts.get(d.id) ?? 0, hasApprovalLine: withLine.has(d.id) }));
}

export type CompanySettings = {
  name: string;
  business_number: string;
  invite_code: string;
  meal_limit_enabled: boolean;
  meal_limit_per_person: number;
  meal_limit_mode: "split" | "notify";
  fuel_enabled: boolean;
  fuel_rate_per_km: number;
  claim_deadline_type: "none" | "end_of_month" | "days_after" | "next_month_day";
  claim_deadline_days: number | null;
};

export async function getCompanySettings(companyId: string): Promise<CompanySettings | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("companies")
    .select(
      "name, business_number, invite_code, meal_limit_enabled, meal_limit_per_person, meal_limit_mode, fuel_enabled, fuel_rate_per_km, claim_deadline_type, claim_deadline_days",
    )
    .eq("id", companyId)
    .maybeSingle();
  return data;
}
