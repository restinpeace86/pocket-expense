"use server";

import { refresh } from "next/cache";
import { getMembership } from "@/lib/auth/session";
import { messageForDbError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "../actions";

// 법인카드 (spec/features/corporate-cards.md). 별칭·앞 6자리·뒤 4자리·담당자만 저장한다 — 카드번호 전체·유효기간·CVC는 받지도 저장하지도 않는다(D-083).
function errorMessage(error: { code?: string; message?: string }): string {
  if (error.code === "23505") return "같은 카드번호(앞 6자리·뒤 4자리)로 사용 중인 카드가 이미 있어요.";
  if (error.code === "23514") return "별칭은 1~30자, 카드번호는 앞 6자리·뒤 4자리 숫자로 입력해 주세요.";
  if (error.code === "23503") return "담당자를 다시 골라 주세요.";
  if (error.code === "42501") return messageForDbError({ message: "NOT_ALLOWED" });
  return messageForDbError(error);
}

export type CardInput = { nickname: string; bin6: string; last4: string; holderMemberId: string | null };

export async function addCardAction(input: CardInput): Promise<ActionResult> {
  const membership = await getMembership();
  if (!membership || membership.status !== "approved") return { error: messageForDbError({ message: "NOT_A_MEMBER" }) };
  const bin6 = input.bin6.replace(/\D/g, "");
  const last4 = input.last4.replace(/\D/g, "");
  if (!/^\d{6}$/.test(bin6)) return { error: "카드번호 앞 6자리를 숫자로 입력해 주세요." };
  if (!/^\d{4}$/.test(last4)) return { error: "카드번호 뒤 4자리를 숫자로 입력해 주세요." };
  const supabase = await createClient();
  const { error } = await supabase.from("corporate_cards").insert({
    company_id: membership.company_id,
    nickname: input.nickname.trim(),
    bin6,
    last4,
    holder_member_id: input.holderMemberId || null,
  });
  if (error) return { error: errorMessage(error) };
  refresh();
  return { error: null };
}

// 뒤 4자리는 바꾸지 않는다. 앞 6자리는 고치거나(오타) 예전 카드에 채울 수 있고, 비워 두면 그대로 둔다
export async function updateCardAction(id: string, input: Omit<CardInput, "last4">): Promise<ActionResult> {
  const bin6 = input.bin6.replace(/\D/g, "");
  if (bin6 && !/^\d{6}$/.test(bin6)) return { error: "카드번호 앞 6자리를 숫자로 입력해 주세요." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("corporate_cards")
    .update({ nickname: input.nickname.trim(), holder_member_id: input.holderMemberId || null, ...(bin6 ? { bin6 } : {}), updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id");
  if (error) return { error: errorMessage(error) };
  if (!data?.length) return { error: messageForDbError({ message: "NOT_FOUND" }) };
  refresh();
  return { error: null };
}

// 해지한 카드는 삭제 대신 사용 안 함(지난 영수증 연결 보존)
export async function setCardActiveAction(id: string, active: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("corporate_cards").update({ is_active: active, updated_at: new Date().toISOString() }).eq("id", id).select("id");
  if (error) return { error: errorMessage(error) };
  if (!data?.length) return { error: messageForDbError({ message: "NOT_FOUND" }) };
  refresh();
  return { error: null };
}
