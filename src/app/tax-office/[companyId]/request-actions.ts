"use server";

import { refresh } from "next/cache";
import { after } from "next/server";
import { messageForDbError } from "@/lib/errors";
import { notifyCompanyRequest } from "@/lib/notify/dispatch";
import { createClient } from "@/lib/supabase/server";

// 세무사무소 → 회사 자료 요청 (D-169). 볼 수 있는 고객사인지·영수증이 그 회사 것인지는 DB 함수가 확인
type Result = { ok: true } | { ok: false; error: string };

export async function createTaxRequestAction(companyId: string, month: string, itemId: string | null, body: string): Promise<Result> {
  const supabase = await createClient();
  const { data: id, error } = await supabase.rpc("create_tax_office_request", { p_company_id: companyId, p_month: month, p_item_id: itemId as string, p_body: body });
  if (error) return { ok: false, error: messageForDbError(error) };
  const { data: r } = await supabase.from("tax_office_requests").select("office_name, item_label, body").eq("id", id as string).maybeSingle();
  if (r) after(() => notifyCompanyRequest(companyId, { officeName: r.office_name ?? "세무사무소", month, body: r.body, itemLabel: r.item_label }));
  refresh();
  return { ok: true };
}

export async function setTaxRequestStatusAction(id: string, resolved: boolean): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_tax_office_request_status", { p_id: id, p_resolved: resolved });
  if (error) return { ok: false, error: messageForDbError(error) };
  refresh();
  return { ok: true };
}
