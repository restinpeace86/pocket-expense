"use server";

import { refresh } from "next/cache";
import { after } from "next/server";
import { messageForDbError } from "@/lib/errors";
import { notifyCompanyRequest } from "@/lib/notify/dispatch";
import { createClient } from "@/lib/supabase/server";

// 세무사무소 현황판 일괄 처리(D-268): 여러 고객사에 같은 자료 요청 · 공지 · 사무소 확인. 권한(맡은 고객사)은 DB 함수가 확인
type Result = { ok: true; count: number } | { ok: false; error: string };

export async function bulkTaxRequestAction(companyIds: string[], month: string, body: string): Promise<Result> {
  const ids = [...new Set(companyIds)].slice(0, 50);
  if (!ids.length) return { ok: false, error: "고객사를 골라 주세요." };
  const supabase = await createClient();
  const made: { companyId: string; id: string }[] = [];
  for (const companyId of ids) {
    const { data: id, error } = await supabase.rpc("create_tax_office_request", { p_company_id: companyId, p_month: month, p_item_id: null as unknown as string, p_body: body });
    if (error) return made.length ? { ok: false, error: `${made.length}곳에 보낸 뒤 멈췄어요: ${messageForDbError(error)}` } : { ok: false, error: messageForDbError(error) };
    made.push({ companyId, id: id as string });
  }
  const { data: rows } = await supabase.from("tax_office_requests").select("id, company_id, office_name, office_id, body").in("id", made.map((m) => m.id));
  after(async () => {
    for (const r of rows ?? []) await notifyCompanyRequest(r.company_id, { officeName: r.office_name ?? "세무사무소", month, body: r.body, officeId: r.office_id, requestId: r.id }).catch(() => {});
  });
  refresh();
  return { ok: true, count: made.length };
}

export async function sendOfficeNoticeAction(companyIds: string[], body: string): Promise<Result> {
  const ids = [...new Set(companyIds)].slice(0, 50);
  if (!ids.length) return { ok: false, error: "고객사를 골라 주세요." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("tax_office_send_notice", { p_companies: ids, p_body: body });
  if (error) return { ok: false, error: messageForDbError(error) };
  return { ok: true, count: Number(data ?? 0) };
}

export async function setClientCheckAction(companyId: string, month: string, on: boolean): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("office_set_client_check", { p_company: companyId, p_month: month, p_on: on });
  if (error) return { ok: false, error: messageForDbError(error) };
  refresh();
  return { ok: true };
}
