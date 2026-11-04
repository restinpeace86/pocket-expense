"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "../actions";

// 채팅 사진·파일 보관 기간(D-212): 관리자만·자기 회사만·메신저가 켜진 회사만·30·60·90일만 — DB 함수(chat_set_attachment_days)가 확인
const ERRORS: Record<string, string> = {
  INVALID_DAYS: "30일·60일·90일 중에서 골라 주세요.",
  FEATURE_DISABLED: "사내 채팅이 켜진 회사만 바꿀 수 있어요.",
};

export async function setChatAttachmentDaysAction(days: number): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("chat_set_attachment_days", { p_days: days });
  if (error) {
    const code = Object.keys(ERRORS).find((k) => error.message?.includes(k));
    return { error: code ? ERRORS[code] : error.code === "42501" ? "관리자만 바꿀 수 있어요." : "저장하지 못했어요. 잠시 후 다시 시도해 주세요." };
  }
  refresh();
  return { error: null };
}
