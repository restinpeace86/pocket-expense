"use server";

import { refresh } from "next/cache";
import { messageForDbError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "../actions";

// 담당 세무사 연결 (D-148). 권한(관리자 이상)·회사는 DB 함수가 확인한다.
export type TaxAgentInput = { officeName: string; agentName: string; agentEmail: string; agentPhone: string };

export async function saveTaxAgentAction(input: TaxAgentInput): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_tax_agent", {
    p_office_name: input.officeName,
    p_agent_name: input.agentName,
    p_agent_email: input.agentEmail,
    p_agent_phone: input.agentPhone,
  });
  if (error) return { error: messageForDbError(error) };
  refresh();
  return { error: null };
}

export async function clearTaxAgentAction(): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("clear_tax_agent");
  if (error) return { error: messageForDbError(error) };
  refresh();
  return { error: null };
}
