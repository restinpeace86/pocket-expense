"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "../actions";

// 카카오 알림톡 켜기·끄기(D-297): 관리자만, 자기 회사만, 프로 이상 요금제만 켬 — DB 함수 alimtalk_set_enabled가 확인
export async function setAlimtalkEnabledAction(enabled: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("alimtalk_set_enabled", { p_enabled: enabled });
  if (error) {
    if (error.message === "ALIMTALK_PLAN") return { error: "카카오 알림톡은 프로(49,000원) 이상 요금제에서 켤 수 있어요." };
    if (error.message === "NOT_ALLOWED") return { error: "관리자만 바꿀 수 있어요." };
    return { error: "저장하지 못했어요. 잠시 뒤 다시 시도해 주세요." };
  }
  refresh();
  return { error: null };
}
