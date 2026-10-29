"use server";

import { refresh } from "next/cache";
import { after } from "next/server";
import { getMembership } from "@/lib/auth/session";
import { sendTaxOfficeInvite } from "@/lib/notify/dispatch";
import { messageForDbError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "../actions";

// 우리 회사 세무사무소 지정 (D-149). 권한(관리자 이상)·회사는 DB 함수가 확인한다.
export type CompanyTaxOfficeInput = { officeName: string; officeEmail: string; agentName: string; agentEmail: string; agentPhone: string };

export async function saveCompanyTaxOfficeAction(input: CompanyTaxOfficeInput): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_company_tax_office", {
    p_office_name: input.officeName,
    p_office_email: input.officeEmail,
    p_agent_name: input.agentName,
    p_agent_email: input.agentEmail,
    p_agent_phone: input.agentPhone,
  });
  if (error) return { error: messageForDbError(error) };
  // 담당 세무사 연락처가 있고 아직 연결 전이면 초대 알림톡(D-173, 발송 대행사 연결 전에는 기록만)
  const companyId = (await getMembership())?.company_id;
  if (companyId && input.agentPhone.trim()) after(() => sendTaxOfficeInvite(companyId));
  refresh();
  return { error: null };
}

export async function clearCompanyTaxOfficeAction(): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("clear_company_tax_office");
  if (error) return { error: messageForDbError(error) };
  refresh();
  return { error: null };
}
