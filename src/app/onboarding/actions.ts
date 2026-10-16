"use server";

import { redirect } from "next/navigation";
import { messageForDbError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";

export type FormState = { error: string | null };

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();
const optional = (formData: FormData, key: string) => text(formData, key) || null;

// 회사 생성 (첫 관리자 = 최고 관리자, spec/features/auth-onboarding.md §2)
export async function createCompanyAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const supabase = await createClient();
  const departments = formData.getAll("departments").map((d) => String(d).trim()).filter(Boolean);

  const { data: companyId, error } = await supabase.rpc("create_company", {
    p_company_name: text(formData, "companyName"),
    p_business_number: text(formData, "businessNumber"),
    p_departments: departments,
    p_my_name: text(formData, "name"),
    p_my_phone: text(formData, "phone"),
    p_my_department: text(formData, "myDepartment"),
    p_my_position: optional(formData, "position") ?? "",
    p_privacy_agreed: formData.get("privacy") === "on",
  });
  if (error || !companyId) return { error: messageForDbError(error) };
  redirect(`/workspace/${companyId}/admin`);
}

// 직원 가입: 공용 코드(승인 대기) 또는 개별 초대 토큰(즉시 활성) (D-042)
export async function joinAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const supabase = await createClient();
  const token = optional(formData, "token");
  const code = optional(formData, "code");
  const common = {
    p_name: text(formData, "name"),
    p_phone: text(formData, "phone"),
    p_department_id: text(formData, "departmentId"),
    p_position: optional(formData, "position") ?? "",
    p_employee_number: optional(formData, "employeeNumber") ?? "",
    p_vehicle_number: optional(formData, "vehicleNumber") ?? "",
    p_bank_name: optional(formData, "bankName") ?? "",
    p_account_number: optional(formData, "accountNumber") ?? "",
    p_account_holder: optional(formData, "accountHolder") ?? "",
    p_privacy_agreed: formData.get("privacy") === "on",
  };
  if (!common.p_department_id) return { error: messageForDbError({ message: "INVALID_DEPARTMENT" }) };

  if (token) {
    const { error } = await supabase.rpc("accept_invitation", { p_token: token, ...common });
    if (error) return { error: messageForDbError(error) };
    const { data } = await supabase.rpc("my_membership");
    const companyId = (data as { company_id?: string } | null)?.company_id;
    redirect(companyId ? `/workspace/${companyId}/employee` : "/onboarding");
  }

  if (!code) return { error: messageForDbError({ message: "INVALID_INVITE_CODE" }) };
  const { error } = await supabase.rpc("join_company", { p_code: code, ...common });
  if (error) return { error: messageForDbError(error) };
  redirect("/onboarding/pending");
}
