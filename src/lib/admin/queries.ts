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

export type MemberDetail = MemberRow & {
  department_id: string | null;
  employee_number: string | null;
  receives_car_allowance: boolean;
  meal_limit_override: number | null;
};

export async function getMember(companyId: string, memberId: string): Promise<MemberDetail | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("members")
    .select("id, name, phone, email, position, role, status, created_at, department_id, employee_number, receives_car_allowance, meal_limit_override, department:departments(name)")
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
  odometer_photo_required: boolean;
  claim_deadline_type: "none" | "end_of_month" | "days_after" | "next_month_day";
  claim_deadline_days: number | null;
};

export async function getCompanySettings(companyId: string): Promise<CompanySettings | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("companies")
    .select(
      "name, business_number, invite_code, meal_limit_enabled, meal_limit_per_person, meal_limit_mode, fuel_enabled, fuel_rate_per_km, odometer_photo_required, claim_deadline_type, claim_deadline_days",
    )
    .eq("id", companyId)
    .maybeSingle();
  return data;
}

export type AccountTitleRow = { id: string; name: string; code: string | null; sort_order: number; used: boolean };
export type MappingRow = {
  id: string;
  category: "meal" | "trip" | "meeting" | "purchase";
  trip_type: string | null;
  purchase_type: string | null;
  account_title_id: string;
};

export async function getAccountTitles(companyId: string): Promise<{ titles: AccountTitleRow[]; mappings: MappingRow[] }> {
  const supabase = await createClient();
  const [{ data: titles }, { data: mappings }] = await Promise.all([
    supabase.from("account_titles").select("id, name, code, sort_order").eq("company_id", companyId).order("sort_order").order("name"),
    supabase.from("account_title_mappings").select("id, category, trip_type, purchase_type, account_title_id").eq("company_id", companyId),
  ]);
  const used = new Set((mappings ?? []).map((m) => m.account_title_id));
  return {
    titles: (titles ?? []).map((t) => ({ ...t, used: used.has(t.id) })),
    mappings: (mappings ?? []) as MappingRow[],
  };
}

export type CorporateCardRow = {
  id: string;
  nickname: string;
  bin6: string | null; // 예전 카드는 없음(뒤 4자리만)
  last4: string;
  is_active: boolean;
  holder_member_id: string | null;
  holder_name: string | null;
  month_total: number;
};

export async function getCorporateCards(companyId: string, monthStart: string, monthEnd: string) {
  const supabase = await createClient();
  const [{ data: cards }, { data: items }, { data: members }] = await Promise.all([
    supabase
      .from("corporate_cards")
      .select("id, nickname, bin6, last4, is_active, holder_member_id, holder:members(name)")
      .eq("company_id", companyId)
      .order("is_active", { ascending: false })
      .order("created_at"),
    // 이번 달 사용 합계 (date 컬럼은 YYYY-MM-DD와 비교 — performance.md §3)
    supabase
      .from("expense_items")
      .select("corporate_card_id, amount")
      .eq("company_id", companyId)
      .not("corporate_card_id", "is", null)
      .gte("expense_date", monthStart)
      .lt("expense_date", monthEnd),
    supabase.from("members").select("id, name").eq("company_id", companyId).eq("status", "approved").order("name"),
  ]);
  const totals = new Map<string, number>();
  for (const i of items ?? []) if (i.corporate_card_id) totals.set(i.corporate_card_id, (totals.get(i.corporate_card_id) ?? 0) + (i.amount ?? 0));
  const rows: CorporateCardRow[] = (cards ?? []).map((c) => ({
    id: c.id,
    nickname: c.nickname,
    bin6: c.bin6,
    last4: c.last4,
    is_active: c.is_active,
    holder_member_id: c.holder_member_id,
    holder_name: (c.holder as { name: string } | null)?.name ?? null,
    month_total: totals.get(c.id) ?? 0,
  }));
  return { cards: rows, members: members ?? [] };
}

// 개인별 식대 예외 한도 입력란에 보여 줄 회사 기본 한도(식대 한도를 쓰지 않으면 null → 입력란 숨김)
export async function getCompanyMealLimit(companyId: string): Promise<number | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("companies").select("meal_limit_enabled, meal_limit_per_person").eq("id", companyId).maybeSingle();
  return data?.meal_limit_enabled ? data.meal_limit_per_person : null;
}

// 회사차량 (D-105): 목록 + 이번 달 차량유지비(그 차량을 고른 회사차량 결의서 + 출장의 회사차량 주유·통행료, 사용일 기준, D-106)
export type CompanyVehicleRow = { id: string; nickname: string; plate_number: string; is_active: boolean; month_total: number };
export async function getCompanyVehicles(companyId: string, monthStart: string, monthEnd: string): Promise<CompanyVehicleRow[]> {
  const supabase = await createClient();
  const [{ data: vehicles }, { data: items }] = await Promise.all([
    supabase.from("company_vehicles").select("id, nickname, plate_number, is_active").eq("company_id", companyId).order("is_active", { ascending: false }).order("created_at"),
    supabase
      .from("expense_items")
      .select("amount, category, trip_type, claim:expense_claims!inner(vehicle_id)")
      .eq("company_id", companyId)
      .not("claim.vehicle_id", "is", null)
      .gte("expense_date", monthStart)
      .lt("expense_date", monthEnd),
  ]);
  const totals = new Map<string, number>();
  for (const i of items ?? []) {
    const vid = (i.claim as { vehicle_id: string | null } | null)?.vehicle_id;
    const carCost = i.category === "company_car" || (i.category === "trip" && (i.trip_type === "car_fuel" || i.trip_type === "car_toll"));
    if (vid && carCost) totals.set(vid, (totals.get(vid) ?? 0) + (i.amount ?? 0));
  }
  return (vehicles ?? []).map((v) => ({ ...v, month_total: totals.get(v.id) ?? 0 }));
}
