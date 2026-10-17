"use server";

import { redirect } from "next/navigation";
import { checkBusinessNumber } from "@/lib/business/nts";
import { messageForDbError } from "@/lib/errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type FormState = { error: string | null };

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();
const optional = (formData: FormData, key: string) => text(formData, key) || null;

// 사업자등록번호 국세청 조회 (D-057). 판정·차단은 DB의 create_company가 한다 — 여기서는 조회 결과만 기록한다.
async function recordBusinessCheck(supabase: Awaited<ReturnType<typeof createClient>>, bNo: string) {
  const { data: mode } = await supabase.rpc("business_verify_mode");
  if (!mode || mode === "off" || !/^\d{10}$/.test(bNo)) return;
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  const admin = createAdminClient();
  if (!userId || !admin) return; // 기록할 수 없으면 DB가 '확인 대기'로 처리
  const result = await checkBusinessNumber(bNo, process.env.NTS_SERVICE_KEY);
  await admin.from("business_verifications").insert({
    b_no: bNo,
    auth_user_id: userId,
    status: result.status,
    status_label: result.label,
    raw: result.raw as never,
  });
}

// 회사 생성 (첫 관리자 = 최고 관리자, spec/features/auth-onboarding.md §2)
export async function createCompanyAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const supabase = await createClient();
  const departments = formData.getAll("departments").map((d) => String(d).trim()).filter(Boolean);
  const businessNumber = text(formData, "businessNumber").replace(/\D/g, "");
  await recordBusinessCheck(supabase, businessNumber);

  const { data: companyId, error } = await supabase.rpc("create_company", {
    p_company_name: text(formData, "companyName"),
    p_business_number: businessNumber,
    p_departments: departments,
    p_my_name: text(formData, "name"),
    p_my_phone: text(formData, "phone"),
    // "부서 없음"(대표·임원)은 빈 값으로 보낸다 (D-058)
    p_my_department: text(formData, "myDepartment") === "__none__" ? "" : text(formData, "myDepartment"),
    p_my_position: optional(formData, "position") ?? "",
    p_privacy_agreed: formData.get("privacy") === "on",
    p_terms_agreed: formData.get("terms") === "on",
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
    p_terms_agreed: formData.get("terms") === "on",
    p_optional_agreed: formData.get("optional") === "on",
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
