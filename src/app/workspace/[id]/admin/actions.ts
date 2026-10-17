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
