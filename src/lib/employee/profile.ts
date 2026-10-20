import "server-only";
import { createClient } from "@/lib/supabase/server";

// 직원 [내 정보] 데이터 (employee-mobile.md ⑤) — 본인 행만
export type MyProfile = {
  name: string;
  phone: string;
  position: string | null;
  employee_number: string | null;
  vehicle_number: string | null;
  department: string | null;
  role: string;
  optionalConsented: boolean;
  bank: { bank_name: string; account_number: string; account_holder: string } | null;
  login: { provider: string | null; email: string | null };
};

export async function getMyProfile(memberId: string): Promise<MyProfile | null> {
  const supabase = await createClient();
  const [{ data: m }, { data: bank }, { data: auth }] = await Promise.all([
    supabase.from("members").select("name, phone, position, employee_number, vehicle_number, department_id, role, optional_consent_at").eq("id", memberId).maybeSingle(),
    supabase.from("member_bank_accounts").select("bank_name, account_number, account_holder").eq("member_id", memberId).maybeSingle(),
    supabase.auth.getUser(),
  ]);
  if (!m) return null;
  const { data: dept } = m.department_id ? await supabase.from("departments").select("name").eq("id", m.department_id).maybeSingle() : { data: null };
  const providers = (auth.user?.app_metadata?.providers as string[] | undefined) ?? [];
  return {
    name: m.name,
    phone: m.phone,
    position: m.position,
    employee_number: m.employee_number,
    vehicle_number: m.vehicle_number,
    department: dept?.name ?? null,
    role: m.role,
    optionalConsented: !!m.optional_consent_at,
    bank: bank ?? null,
    login: { provider: providers[0] ?? (auth.user?.app_metadata?.provider as string | undefined) ?? null, email: auth.user?.email ?? null },
  };
}
