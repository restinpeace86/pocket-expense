"use server";

import { refresh } from "next/cache";
import { getAppAdmin } from "@/lib/app-admin/guard";

// 회사 양식 칸 늘리기·줄이기(8-104 B-4): 결제가 꺼진 동안 [추가 신청]을 운영자가 처리. 늘리면 그 회사 신청이 '처리됨'
export async function grantFormSlotAction(companyId: string, add: 1 | -1): Promise<{ error: string | null }> {
  const ok = await getAppAdmin();
  if (!ok) return { error: "운영자만 바꿀 수 있어요." };
  if (add !== 1 && add !== -1) return { error: "잘못된 요청이에요." };
  const { error } = await ok.admin.rpc("form_slot_grant", { p_company: companyId, p_add: add });
  if (error) return { error: "바꾸지 못했어요. 다시 시도해 주세요." };
  refresh();
  return { error: null };
}
