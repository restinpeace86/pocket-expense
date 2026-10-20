"use server";

import { refresh } from "next/cache";
import { getMembership } from "@/lib/auth/session";
import { isAdminRole } from "@/lib/auth/paths";
import { messageForDbError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "../actions";

// 이벤트 추가 지급 배너 [확인] (pricing-policy.md §5). 관리자 이상, 자기 회사만(RLS companies_update).
export async function acknowledgeEventBonusAction(): Promise<ActionResult> {
  const m = await getMembership();
  if (!m || m.status !== "approved" || !isAdminRole(m.role)) return { error: messageForDbError({ message: "NOT_ALLOWED" }) };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("companies")
    .update({ event_bonus_acknowledged_at: new Date().toISOString() })
    .eq("id", m.company_id)
    .select("id");
  if (error) return { error: messageForDbError(error) };
  if (!data?.length) return { error: messageForDbError({ message: "NOT_ALLOWED" }) };
  refresh();
  return { error: null };
}
