"use server";

import { refresh } from "next/cache";
import { messageForDbError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { error: string | null };

// 권한·회사 일치 검사는 DB 함수가 한다(012). 여기서는 호출과 화면 갱신만.
export async function approveMemberAction(memberId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("approve_member", { p_member_id: memberId });
  if (error) return { error: messageForDbError(error) };
  refresh();
  return { error: null };
}

export async function rejectMemberAction(memberId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("reject_member", { p_member_id: memberId });
  if (error) return { error: messageForDbError(error) };
  refresh();
  return { error: null };
}

export async function regenerateInviteCodeAction(): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("regenerate_invite_code");
  if (error) return { error: messageForDbError(error) };
  refresh();
  return { error: null };
}

// 멤버 편집·역할·넘기기·비활성화 (013). 권한(관리자는 일반 멤버만, 역할·넘기기는 최고 관리자만)은 DB 함수가 검사한다.
export type MemberEditInput = {
  memberId: string;
  name: string;
  phone: string;
  departmentId: string | null;
  position: string;
  employeeNumber: string;
  receivesCarAllowance: boolean;
  mealLimitOverride?: number | null; // undefined = 바꾸지 않음, null = 회사 기본 한도
};

export async function updateMemberAction(input: MemberEditInput): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_member", {
    p_member_id: input.memberId,
    p_name: input.name,
    p_phone: input.phone,
    p_department_id: input.departmentId as string,
    p_position: input.position,
    p_employee_number: input.employeeNumber,
    p_receives_car_allowance: input.receivesCarAllowance,
    p_meal_limit_override: (input.mealLimitOverride === undefined ? -1 : input.mealLimitOverride) as number,
  });
  if (error) return { error: messageForDbError(error) };
  refresh();
  return { error: null };
}

export async function setMemberRoleAction(memberId: string, role: "admin" | "employee"): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_member_role", { p_member_id: memberId, p_role: role });
  if (error) return { error: messageForDbError(error) };
  refresh();
  return { error: null };
}

export async function transferSuperAdminAction(memberId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("transfer_super_admin", { p_member_id: memberId });
  if (error) return { error: messageForDbError(error) };
  refresh();
  return { error: null };
}

export type DeactivationCheck = {
  unpaid_claims: number;
  payout_amount: number;
  payback_amount: number;
  open_claims: number;
  approval_line_steps: number;
  pending_reviews: number;
  blocked: boolean;
};

export async function deactivationCheckAction(memberId: string): Promise<{ error: string | null; check?: DeactivationCheck }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("member_deactivation_check", { p_member_id: memberId });
  if (error) return { error: messageForDbError(error) };
  return { error: null, check: data as unknown as DeactivationCheck };
}

export async function deactivateMemberAction(memberId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("deactivate_member", { p_member_id: memberId });
  if (error) return { error: messageForDbError(error) };
  refresh();
  return { error: null };
}

// 비활성 멤버 다시 활성화 (014, D-062)
export async function reactivateMemberAction(memberId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("reactivate_member", { p_member_id: memberId });
  if (error) return { error: messageForDbError(error) };
  refresh();
  return { error: null };
}
