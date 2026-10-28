"use server";

import { refresh, revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recordBusinessCheck } from "@/lib/business/record";
import { messageForDbError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";

// 세무사무소 워크스페이스 작업 (D-149). 권한(사무소 관리자)·범위는 DB 함수가 다시 확인한다
export type OfficeFormState = { error: string | null };
type Result = { error: string | null };
const text = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

// 세무사무소 등록: 등록한 사람이 사무소 관리자, 이 이메일로 들어온 연결 요청이 바로 고객사가 된다
export async function registerTaxOfficeAction(_prev: OfficeFormState, formData: FormData): Promise<OfficeFormState> {
  const supabase = await createClient();
  const bizNo = text(formData, "businessNumber").replace(/\D/g, "");
  await recordBusinessCheck(supabase, bizNo);
  const { error } = await supabase.rpc("register_tax_office", {
    p_name: text(formData, "officeName"),
    p_business_number: bizNo,
    p_my_name: text(formData, "name"),
    p_my_phone: text(formData, "phone"),
    p_terms_agreed: formData.get("terms") === "on",
    p_privacy_agreed: formData.get("privacy") === "on",
  });
  if (error) return { error: messageForDbError(error) };
  // 같은 주소(/tax-office)로 돌아가므로 레이아웃(등록 화면 → 워크스페이스)을 새로 그리게 한다
  revalidatePath("/tax-office", "layout");
  redirect("/tax-office");
}

// 소속 세무사 합류(초대 코드)
export async function joinTaxOfficeAction(_prev: OfficeFormState, formData: FormData): Promise<OfficeFormState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("join_tax_office", {
    p_code: text(formData, "code"),
    p_my_name: text(formData, "name"),
    p_my_phone: text(formData, "phone"),
    p_terms_agreed: formData.get("terms") === "on",
    p_privacy_agreed: formData.get("privacy") === "on",
  });
  if (error) return { error: messageForDbError(error) };
  revalidatePath("/tax-office", "layout");
  redirect("/tax-office");
}

export async function assignTaxAgentAction(companyId: string, memberId: string | null): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("assign_tax_office_agent", { p_company_id: companyId, p_member_id: memberId as string /* null = 배정 해제 */ });
  if (error) return { error: messageForDbError(error) };
  refresh();
  return { error: null };
}

export async function setTaxOfficeMemberStatusAction(memberId: string, status: "active" | "inactive"): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_tax_office_member_status", { p_member_id: memberId, p_status: status });
  if (error) return { error: messageForDbError(error) };
  refresh();
  return { error: null };
}

export async function regenerateTaxOfficeCodeAction(): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("regenerate_tax_office_code");
  if (error) return { error: messageForDbError(error) };
  refresh();
  return { error: null };
}
