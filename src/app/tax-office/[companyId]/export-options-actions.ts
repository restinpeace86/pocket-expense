"use server";

import { refresh } from "next/cache";
import { messageForDbError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";

// 세무용 엑셀 설정(D-189). 고객사를 볼 수 있는지·사무소 관리자인지는 DB 함수가 확인
type Result = { ok: true } | { ok: false; error: string };

export async function setCardViaHometaxAction(companyId: string, value: boolean): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_company_card_via_hometax", { p_company_id: companyId, p_value: value });
  if (error) return { ok: false, error: messageForDbError(error) };
  refresh();
  return { ok: true };
}

export async function setMainTemplateAction(templateId: string | null): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_tax_office_main_template", { p_template_id: templateId as string });
  if (error) return { ok: false, error: messageForDbError(error) };
  refresh();
  return { ok: true };
}
